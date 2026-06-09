# 图标拖拽这件小事

这套桌面图标的拖拽，表面上看只是“拖一下，放过去”。但真正让它显得顺手的，不是拖拽本身，而是两件事：

一件是，图标放到别的图标位置上时，周围会自己让位，而不是简单报冲突。

另一件是，不管鼠标落点多随意，最终位置都会吸附到一套稳定的网格上，所以界面始终是整齐的。

这篇文档不按函数列表来讲，而是按人能感受到的行为来讲。对应实现主要在 [DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:1)。

## 先把桌面想成一张“有坐标的棋盘”

代码里没有把图标当成自由像素坐标去存，而是存成网格坐标 `gridX / gridY`。每个书签图标占 `1 x 1` 个格子，组件可以占多个格子。

网格本身不是写死 80px 这种固定值。当前单元格大小来自：

- 图标尺寸 `iconSize`
- 额外留白

对应代码在 [DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:82)。当前实现是：

```ts
const cellSize = computed(() =>
  Math.max(96, store.data.iconSize + 28)
)
```

也就是说，用户把图标调大，网格也会跟着长大。这样图标之间的视觉间距不会塌掉。

桌面并不是从浏览器左上角开始排，而是通过 `canvasOffset` 整体平移到一个更像“桌面中区”的位置上，顺便避开顶部栏。[DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:86)

所以最后真正渲染时，走的是这样一层换算：

1. 先决定图标应该落在哪个网格坐标。
2. 再把网格坐标换算成屏幕上的像素位置。
3. 用 `transform: translate3d(...)` 渲染出来。

对应代码是 [DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:142) 的 `gridStyle()`。

这一步很关键。因为只要“数据层”一直是网格坐标，拖拽、碰撞、对齐、窗口缩放后的修正，都会简单很多。

## 为什么拖起来不会一碰就误触

很多拖拽界面有个常见问题：你本来只是想点开图标，结果组件立刻开始拖。

这里专门做了一层缓冲。按下鼠标时，并不会立刻进入正式拖拽，而是先进入 `pendingDrag` 状态，记录起点、偏移量、原始位置这些信息。[DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:319)

只有当鼠标移动距离超过阈值 `DRAG_THRESHOLD = 6` 之后，才真正切到 `isDragging`。[DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:13) [DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:375)

这让点击和拖动被自然地区分开了：

- 移动很小：算点击
- 移动超过阈值：算拖拽

所以你看到的“拖起来挺稳”，其实不是浏览器默认行为，而是这层判断在兜底。

## 网格对齐是怎么发生的

真正的“吸附感”来自 `pointerToGrid()`。[DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:263)

拖动过程中，鼠标位置先减去画布偏移，再结合当前拖拽元素的尺寸，换算出它应该属于哪个格子。这里不是向下取整，而是 `Math.round(...)`，也就是按“离哪个格子最近”来吸附。

这件事的手感很重要：

- 如果用 `floor`，图标会更像被左上角拖着走，吸附感会偏硬。
- 这里用 `round`，更接近“图标中心靠近哪个格子，就落哪个格子”。

换句话说，用户拖的是一个视觉块，系统判断的是“这个块的重心更接近哪一格”。

同时，`clampGridPosition()` 会把结果限制在当前视口允许的网格范围内。[DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:124)

这意味着两件事：

- 图标不会被拖到屏幕外面
- 即使窗口尺寸变化，已有布局也能被重新夹回可见区域

后者是由 `clampCurrentLayoutToViewport()` 在窗口变化后做的。[DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:595)

所以“自动网格对齐”并不是放手那一瞬间才做，而是从拖动预览开始，到最终落点提交，再到窗口变化后的布局修正，整条链路都在坚持网格坐标。

## 拖到两个图标之间，为什么别的图标会自己挪开

这是这套实现里最像桌面系统的部分。

当你把一个图标拖到某个已经被图标占住的格子上时，系统不会立刻判定“这里不能放”。它会先尝试给原来的图标腾位置。这个逻辑入口是 `planIconDrop()`。[DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:524)

它先看目标格子里是什么：

- 如果是另一个图标：走“级联挪位”
- 如果是 widget：不给硬挤，改成找最近空位
- 如果是空位：直接放进去

### 这里没有“插入缝隙”这个显式概念

从用户感觉上，你像是在把一个图标插到两个图标之间。

但从代码角度，它其实不是在算“两个图标的中点”或者“列表插入位”。它做的事情更朴素：

1. 先把当前鼠标位置吸附到某一个目标格子。
2. 如果这个格子已经有图标，就把原图标往拖拽方向推一格。
3. 如果推过去的位置还有图标，就继续往前推。
4. 如果前面被 widget 挡住，或者已经到边界，就找最近的空位安置。

这个行为由 `planCascadeShift()` 完成。[DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:488)

## “往哪边推”不是随机的

推开的方向由 `getPushDirection()` 决定。[DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:462)

它会比较目标位置相对于拖拽起点的横向位移 `dx` 和纵向位移 `dy`：

- 横向位移更明显，就按左右推
- 纵向位移更明显，就按上下推

这点很像人在脑子里的预期。

比如你从左往右把一个图标拖进一排图标里，你通常期待右边那几个往右让，而不是莫名其妙往下掉。这里的实现正是顺着这个直觉来的。

所以“插到两个图标之间时自动移动”本质上不是在做列表重排，而是在做一个有方向感的推挤。

## 级联挪位为什么不会把布局搞乱

因为它不是一边改真实数据一边试，而是先在一份快照里模拟。

拖拽开始时，会把当前占用情况存成一个 `OccupancySnapshot`，里面分两类：

- 哪些格子被书签图标占了
- 哪些格子被 widget 占了

见 [DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:185)。

后面的碰撞推演、预览位置计算，基本都在这份快照上做。真正的好处是：

- 不会拖一下就把真实数据改来改去
- 可以安全地递归推下一个图标
- 可以先得到一整套“最后应该怎么落”的补丁列表

也就是 `DropPlan` 里的 `patches`。[DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:54)

到鼠标松开时，才一次性提交。[DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:680)

这种做法让交互表现更像“先演算，再落子”，而不是边拖边破坏当前布局。

## 拖动过程中，旁边图标为什么会提前让位

因为预览不是只画了一个虚线框，而是真的提前计算了受影响图标的新位置。

`updatePreviewPositions()` 会在拖拽经过新格子时调用 `planIconDrop()`，拿到这一刻的落点方案，然后把方案里的每个图标临时写进 `previewPositions`。[DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:633)

渲染时，图标位置优先取预览位置，而不是原位置：

```ts
function iconGridStyle(id: string, gridX: number, gridY: number) {
  const preview = previewPositions[id]
  return gridStyle(preview?.gridX ?? gridX, preview?.gridY ?? gridY)
}
```

见 [DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:156)。

所以用户看到的不是“松手后突然重排”，而是“拖过去时，旁边图标已经识趣地先挪开了”。

这就是手感自然的来源。

## 为什么还要再做一次碰撞修正

理论上，前面的拖拽推演已经很完整了。但真正提交前，代码还是会走一层 `resolvePatchCollisions()`。[DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:557)

这层像最后一道保险，作用是：

- 再次把位置夹回边界
- 防止补丁之间自己撞车
- 如果某个目标点仍然被占，就再找最近空位

这是个很务实的设计。因为拖拽预览和真实提交之间，总会有边界情况，尤其是涉及 Add 按钮、widget、窗口尺寸变化时。最后再做一次归一化，能明显降低布局错位的概率。

## Add 按钮其实也按同一套规则运行

页面上的 `Add` 不是特例 UI，而是被当成一个特殊 id 的图标：`__add_btn__`。[DesktopCanvas.vue](/Users/mkh/code1/mtab/src/components/DesktopCanvas.vue:14)

它会参与：

- 占位快照
- 拖拽预览
- 碰撞检测
- 自动让位

只是最终提交时，不写进书签数组，而是单独写到 `addButtonGridX / addButtonGridY`。[settings.ts](/Users/mkh/code1/mtab/src/stores/settings.ts:293)

这点挺重要，因为它让整套逻辑少了很多分支判断。维护起来也更稳。

## 这套实现的核心，不是“能拖”，而是“拖完还像原来那个桌面”

如果只看功能，很多实现都能做到把图标从 A 点拖到 B 点。

但这里真正做对的，是把下面几件事绑成了一套连续体验：

- 鼠标先过阈值才进入拖拽，避免误触
- 拖动过程中持续吸附到最近网格
- 图标占位冲突时按拖拽方向级联让位
- widget 不参与被推挤，只作为硬边界
- 真正写入前再做一次碰撞归一化
- 窗口变化后还会把越界布局夹回可见区域

所以最后看上去，它不像一组散落在页面上的 DOM，而更像一张有秩序、会自我修复的桌面。

## 如果以后要继续改，这几个点最值得小心

第一，`pointerToGrid()` 的吸附公式不要轻易改。  
它直接决定“拖拽重心”是不是符合人手预期。

第二，`planCascadeShift()` 和 `resolvePatchCollisions()` 是两层不同职责。  
前者负责推演出“应该怎么让位”，后者负责提交前兜底。把两者揉成一层，代码通常会更难维护。

第三，Add 按钮虽然是特殊元素，但最好继续维持“按图标处理”的思路。  
这能让占位、预览、提交三段逻辑保持统一。

第四，窗口尺寸变化后的 `clampCurrentLayoutToViewport()` 很容易被忽视。  
如果以后改网格规则、边距规则、顶部栏高度，这里要一起检查，否则布局可能在缩放后悄悄出界。

## 最后用一句话总结

目前这套图标系统，本质上是“基于网格坐标的拖拽 + 基于占位快照的级联推挤 + 提交前的最终归一化”。

用户感受到的是：图标会吸附、会让位、不会乱。

代码真正做的是：先算清楚，再一次性落下去。
