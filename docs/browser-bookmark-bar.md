# 顶部收藏栏是怎么工作的

这个顶部收藏栏做的事情，其实是在 mtab 里复刻 Chrome 原生书签栏的一部分体验：

它会读取 Chrome 自己的书签栏，横向展示能放得下的书签。放不下的部分收进右侧“更多”按钮。文件夹可以点开，下级文件夹可以继续悬停展开。

这篇只讲当前实现的思路，不按函数挨个解释。主要代码在 `src/components/BrowserBookmarkBar.vue` 和 `src/components/BookmarkFolderMenu.vue`。

## 数据从 Chrome 书签栏来

顶部收藏栏不是读 mtab 自己的桌面图标配置，而是直接读 Chrome 的书签 API。

优先走的是：

```ts
chrome.bookmarks.getChildren('1', ...)
```

Chrome 里 id 为 `1` 的节点通常就是书签栏。读到 children 后，会转成我们自己的轻量结构：

```ts
{
  id,
  title,
  url,
  children,
  childrenLoaded,
}
```

有 `url` 的是普通书签，没有 `url` 的就是文件夹。

如果 `getChildren('1')` 失败，或者拿到的是空数组，会再走一次 `chrome.bookmarks.getTree()`。这算一个兜底：从整棵书签树里找 id 为 `1` 的节点，找不到的话再按标题里包含 `bookmark / 书签 / 收藏` 来猜，最后再退到 root 下第一个子节点。

所以这套加载逻辑分两层：

第一层，直接拿 Chrome 标准书签栏。  
第二层，如果第一层不可靠，就从完整书签树里找一个最像书签栏的节点。

## 渲染前会先过滤掉空项

Chrome 书签节点里可能会出现没有标题、没有 URL、也没有子项的节点。页面不会直接渲染所有节点，而是先做一层过滤：

```ts
bookmarkBar.value.filter((item) => item.title || item.url || item.children?.length)
```

这个结果叫 `visibleItems`。

后面所有布局、更多按钮、文件夹菜单，都是基于 `visibleItems` 做的。

## 为什么需要“测量层”

原来顶部栏的问题是：书签很多的时候，所有项都挤在同一行里，最后每个按钮都被压小，文字全变省略号。

现在的做法不是让 flex 自己挤，而是先测量每个书签真实需要多宽，再决定哪些能放在主栏，哪些放进右侧更多菜单。

页面里有一个隐藏的测量区域：

```html
<div ref="measureEl" class="bookmark-measure" aria-hidden="true">
```

它不可见，也不能点击，但里面会用同样的按钮样式渲染一份完整书签。这样浏览器能算出每个书签按钮的真实宽度。

测量结果会进入 `widthById`：

```ts
widthById.set(id, Math.ceil(el.getBoundingClientRect().width))
```

这就是布局算法的基础。不是凭字符数量猜宽度，而是让浏览器按真实样式测出来。

## 怎么决定哪些显示在主栏

核心逻辑在 `recomputeVisibleItems()`。

它先算出顶部栏可用宽度：

```ts
const availableWidth = bar.clientWidth - paddingLeft - paddingRight
```

然后从左到右尝试放书签。每放一个，就把它的宽度和 gap 加到 `usedWidth`。

但这里还有一个细节：如果后面还有书签放不下，就必须给右侧“更多”按钮预留空间。

也就是说，算法不是简单问：

“这个书签能不能放下？”

而是问：

“这个书签放下后，如果后面还有溢出，右侧更多按钮还能不能放下？”

能放就加入 `primaryItemIds`，放不下就停止。停止之后，剩下的书签自然就进入 `overflowItems`。

主栏显示的是：

```ts
primaryItems
```

更多菜单里显示的是：

```ts
overflowItems
```

这就是为什么现在不会把前面的书签挤小。能完整展示的才留在主栏，剩下的统一交给更多菜单。

## 为什么窗口变化后会重新计算

顶部栏宽度会因为窗口变化而变化，所以组件用了 `ResizeObserver` 监听收藏栏容器：

```ts
resizeObserver.observe(barEl.value)
```

只要尺寸变化，就调度一次布局重算。

这里没有每次 resize 都立刻同步计算，而是用 `requestAnimationFrame` 合并：

```ts
layoutRaf = requestAnimationFrame(...)
```

这样可以避免窗口拖动时频繁触发布局测量，减少抖动和额外计算。

另外，书签数据变化时也会触发重算。`layoutKey` 会把当前书签的 id、标题、类型拼成一个字符串。只要这串 key 变了，就说明书签列表结构变了，需要重新测量和分配。

## 文件夹点击为什么能展开

顶部栏里普通书签和文件夹是分开渲染的。

普通书签是一个按钮，点击后：

```ts
window.location.href = item.url
```

文件夹没有 `url`，所以点击时走 `toggleFolder(item)`。

它会做三件事：

第一，如果子项还没加载，就调用 `loadFolderChildren(item)`。  
第二，关掉右侧更多菜单。  
第三，把 `openFolderId` 设置成当前文件夹 id，或者如果本来就是它，就设回 `null`。

模板里根据这个状态决定菜单是否打开：

```vue
:class="{ 'is-open': openFolderId === item.id }"
```

CSS 里 `.folder-menu` 默认 `display: none`，只有 `.is-open` 时才 `display: flex`。

所以文件夹展开本质上不是创建弹窗，而是这个文件夹旁边本来就有一个菜单组件，只是通过状态控制显示隐藏。

## 文件夹菜单是怎么定位的

每个顶部文件夹外面都有一个容器：

```css
.bookmark-folder {
  position: relative;
}
```

菜单本身是绝对定位：

```css
.folder-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
}
```

所以顶部文件夹的菜单，会贴着这个文件夹按钮的左下方展开。

右侧更多菜单也是复用同一个菜单组件，只是定位不一样：

```css
.more-menu {
  right: 0;
  left: auto;
}
```

也就是说，更多菜单会靠右对齐，避免从最右侧按钮展开后跑出屏幕太多。

这里有一个之前踩过的坑：主栏容器不能用 `overflow: hidden`。  
如果主栏容器裁剪溢出内容，文件夹菜单虽然状态打开了，但视觉上会被父容器切掉，看起来就像“点不开”。所以当前 `.browser-bookmark-content` 是 `overflow: visible`。

## 更多菜单为什么也能显示文件夹

右侧更多菜单不是另写了一套逻辑，它直接复用 `BookmarkFolderMenu`：

```vue
<BookmarkFolderMenu :items="overflowItems" />
```

这意味着溢出的普通书签可以点击打开，溢出的文件夹也可以继续展开子菜单。

更多按钮自己只负责打开和关闭这个菜单：

```ts
moreMenuOpen.value = !moreMenuOpen.value
```

它不会改书签数据，也不负责解析文件夹内容。

## 子文件夹是怎么继续展开的

子菜单逻辑在 `BookmarkFolderMenu.vue`。

这个组件是递归组件。遇到普通书签，渲染一个按钮。遇到文件夹，渲染一个文件夹按钮，并在里面再放一个 `BookmarkFolderMenu`。

子文件夹不是点击主栏那种“设置 openFolderId”，而是靠 hover/focus 展开：

```vue
@mouseenter="expandFolder(item)"
@focusin="expandFolder(item)"
```

CSS 里控制：

```css
.folder-menu-folder:hover > .folder-submenu {
  display: flex;
}
```

子菜单的位置是：

```css
.folder-submenu {
  top: -5px;
  left: calc(100% + 4px);
}
```

也就是从父菜单项右侧展开，形成常见的多级菜单效果。

## 文件夹内容为什么有时要懒加载

有些节点一开始就带了 `children`，这种会标记为 `childrenLoaded: true`。有些节点只是一个文件夹壳，children 还没拿到。

当用户真的点开或悬停到这个文件夹时，才调用：

```ts
chrome.bookmarks.getChildren(item.id, ...)
```

把它的子项读出来。

这么做的好处是：顶部栏初次渲染不用把整棵书签树都展开处理。书签很多、层级很多的时候，这会更轻。

## 点击外面为什么会关闭菜单

组件挂载时会在 document 上加一个 `pointerdown` 监听：

```ts
document.addEventListener('pointerdown', onDocumentPointerDown, true)
```

如果点击位置不在顶部收藏栏里，就关闭：

```ts
openFolderId.value = null
moreMenuOpen.value = false
```

这里用的是 capture 阶段监听，所以即使菜单内部有一些点击逻辑，外部点击关闭也能比较稳定地捕获到。

而文件夹按钮和菜单项内部的点击一般会用 `@click.stop`，避免自己的点击被当成外部操作。

## 现在这套结构的关键状态

可以把顶部收藏栏理解成几个状态拼起来：

`bookmarkBar` 是从 Chrome 读到的原始书签栏数据。

`visibleItems` 是过滤空节点后的书签。

`primaryItemIds` 是当前能显示在主栏里的 id 列表。

`primaryItems` 是真正渲染在顶部栏左侧的项目。

`overflowItems` 是放进右侧更多菜单的项目。

`openFolderId` 表示当前主栏里打开的是哪个文件夹。

`moreMenuOpen` 表示右侧更多菜单是否打开。

`measureEl` 是隐藏测量层，用来计算每个按钮宽度。

## 一句话总结

顶部收藏栏现在的逻辑是：

先从 Chrome 读书签栏，转成统一结构；再用隐藏测量层算出每个项目宽度；主栏只放得下的项目，剩下的放进更多菜单；文件夹通过 `openFolderId` 控制展开，子文件夹通过递归菜单和 hover 展开；菜单定位依赖相对定位的文件夹容器和绝对定位的菜单层。

它最重要的设计点不是“把书签显示出来”，而是把 Chrome 书签栏常见的三种行为分开处理：数据读取、宽度收纳、文件夹菜单。
