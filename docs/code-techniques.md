# 项目里的代码技巧

这里记录 mtab 为解决具体问题用到的小技巧。每条说明问题、关键思路和适用边界，方便以后遇到相似情况时复用。

## 1. 用 Promise 接力，让异步修改一次只执行一个

**用在何处：**续看列表的添加、标记完成和撤销。代码在 [background.ts](../src/background.ts)，并发场景由 [read-later-concurrency.test.mjs](../tests/read-later-concurrency.test.mjs) 验证。

### 要解决的问题

续看列表保存在浏览器存储的同一个键里。添加页面时，必须先读取原列表，按 URL 去重，再写回新列表。两个操作同时进行时，可能都读到相同的旧列表：

```text
A 读到 []         B 读到 []
A 写入 [A]        B 写入 [B]  ← A 被覆盖
```

**要排队的是“读、修改、写”整个过程。**如果只让最后的写入排队，两个操作仍会基于同一份旧数据计算，问题没有解决。

### 做法

用一个 Promise 记住上一项任务何时结束。下一项任务通过 `.then()` 接在它后面：

```ts
let mutationTail: Promise<void> = Promise.resolve()

function queueMutation<T>(mutate: () => Promise<T>): Promise<T> {
  const result = mutationTail.then(mutate)
  mutationTail = result.then(() => undefined, () => undefined)
  return result
}
```

可以把 `mutationTail` 想成接力棒：

1. 初始的 `Promise.resolve()` 表示现在没人占用。
2. `mutationTail.then(mutate)` 表示等前一项结束，再开始这一项。
3. `result` 原样返回给调用者，所以这一项成功或失败都能被调用者知道。
4. 更新 `mutationTail` 时同时处理成功和失败，让一次失败不会卡住后面的任务。

以添加单个页面为例，**读取必须写在传给队列的函数里面**：

```ts
return queueMutation(async () => {
  const items = await readItems()
  const existing = items.find((item) => item.url === tab.url)
  const selected = toReadLaterItem(tab, existing)
  if (!selected) return
  const next = mergeReadLaterItems([selected], items)
  await chrome.storage.local.set({ [READ_LATER_STORAGE_KEY]: next })
})
```

于是 A 完成写入后，B 才开始读取。B 读到 `[A]`，再写入 `[B, A]`。

续看列表的写入都由后台处理；页面通过存储变更事件更新显示，不把收到的数据自动写回。这样其他页面也不会绕过队列，用旧状态覆盖新状态。

### 这种做法常见吗？

**思路很常见。**当多个异步操作必须按顺序修改同一份状态时，通常要将它们串行化。用 Promise 链做一个轻量队列，是 JavaScript/TypeScript 中常见的实现方式；它不是 Chrome 扩展专有功能，也不是数据库事务。

它适合本项目这种**由同一个后台实例负责写入**的小型共享列表。队列只存在于当前 JavaScript 运行环境的内存里；如果以后有其他进程、服务器或页面直接写同一个键，就需要让它们也经过同一入口，或改用具备事务能力的存储。互不依赖的任务不必排队，可以并行执行。

## 2. 用“修改前、修改后、最新值”合并多页面设置

**用在何处：**多个新标签页同时编辑设置。页面侧见 [useSettingsStorage.ts](../src/composables/useSettingsStorage.ts)，合并规则见 [mergeChanges.ts](../src/settings/mergeChanges.ts)。

一个页面保存时，手里可能只有旧设置。直接写回整份对象，会覆盖其他页面刚改的字段。现在页面提交“修改前”和“修改后”，后台先读出当前最新值，再把两者之间真正变化的字段应用上去。例如 A 改主题、B 改笔记，两个改动可以同时保留。

后台仍用前一节的队列包住**读取、合并、写入**，防止两个请求同时基于旧值计算。已打开的页面收到存储更新后，也用同一规则保留自己尚未提交的编辑。带 `id` 的列表按条目合并，因此改动不同书签时不会互相覆盖；同一字段的并发修改则以最后一次写入为准。
