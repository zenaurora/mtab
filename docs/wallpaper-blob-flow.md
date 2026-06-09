# 壁纸上传为什么改成 Blob

这次壁纸上传逻辑的核心变化，是不再把本地图片当成一大段 base64 字符串到处传，而是把它当成浏览器原生的 `Blob` 来处理。

先讲一句人话版：

`Blob` 可以理解成“浏览器里的一个文件块”。它不关心里面具体是图片、音频还是别的二进制内容，只表示：这里有一坨原始数据，并且它有一个类型，比如 `image/webp`、`image/jpeg`。

和 base64 最大的区别是，base64 是“把文件内容转成一长串文本”。这很方便塞进 JSON，但代价也很明显：字符串会变大，进 Vue/Pinia 响应式状态后也更重。`Blob` 则更接近浏览器天然处理文件的方式。我们可以把它交给 IndexedDB 保存，也可以临时生成一个 `blob:` URL 给 CSS 背景图使用。

## Blob、base64、blob URL 分别是什么

这三个东西容易混在一起，但它们不是一回事。

base64 是文本。  
像 `data:image/png;base64,iVBORw0KG...` 这种东西，就是把图片文件编码成字符串。它适合复制、放进 JSON，但不适合长期挂在响应式状态里。

Blob 是二进制数据。  
它更像浏览器里的 `File`。事实上，用户上传拿到的 `File` 本身就是一种特殊的 `Blob`。Blob 可以直接存进 IndexedDB，不需要先变成字符串。

blob URL 是临时地址。  
`URL.createObjectURL(blob)` 会得到一个类似 `blob:chrome-extension://...` 的地址。这个地址可以放进 `<img src>` 或 CSS `background-image`，但它只在当前页面生命周期里有效，不能当成配置长期保存。

所以现在的原则是：

运行时显示，用 `blob:` URL。  
持久化保存，用 `Blob` 本体。  
配置导入导出，不带壁纸文件。

## 现在上传一张本地壁纸会发生什么

入口在 `WallpaperPicker.vue`。用户选择文件后，代码直接拿到浏览器给的 `File` 对象：

```ts
const file = input.files?.[0]
```

这里没有再用 `FileReader.readAsDataURL(file)`。也就是说，上传一开始不会先生成一整段完整 base64 字符串。

接着代码用：

```ts
const objectUrl = URL.createObjectURL(file)
```

给这个本地文件临时生成一个地址。这个地址只是为了让浏览器能把图片加载进 `Image`，方便我们知道它的真实宽高。

图片加载完成后，会进入缩图逻辑。代码会看当前屏幕尺寸和 `devicePixelRatio`，算出壁纸真正需要的最大分辨率：

```ts
const maxW = screen.width * (window.devicePixelRatio || 1)
const maxH = screen.height * (window.devicePixelRatio || 1)
```

如果上传的图片本来就不大，就直接保存原始 `File`。因为 `File` 本来也是 `Blob`，没必要多处理一遍。

如果图片太大，比如用户传了 4K 或更大的图，就用 canvas 画一张缩小版，再通过：

```ts
canvas.toBlob(...)
```

输出新的图片 Blob。优先尝试 `image/webp`，失败时再尝试 `image/jpeg`，如果都失败就退回原图。这样不会因为某个编码路径不可用而让壁纸上传直接坏掉。

最后，临时的 object URL 会被释放：

```ts
URL.revokeObjectURL(objectUrl)
```

这一步很重要。`blob:` URL 是浏览器临时资源，用完不释放，页面开久了就容易积累无用引用。

对应代码在 `src/components/settings/WallpaperPicker.vue`。

## 存储时保存的是什么

上传处理完后，组件会调用：

```ts
store.setWallpaperBlob(blob)
```

store 里做三件事。

第一，释放旧的壁纸 `blob:` URL。  
如果之前已经有一张本地壁纸在显示，先 `URL.revokeObjectURL(...)`，避免旧图片资源还被浏览器留着。

第二，给新的 Blob 生成运行时 URL。  
这个 URL 会存在 `wallpaperBlobUrl` 里，给背景组件使用。

第三，把 Blob 保存到 IndexedDB。  
这里不是保存 base64 字符串，而是直接保存 Blob：

```ts
saveLargeStorageValue(WALLPAPER_BASE64_KEY, blob)
```

变量名里还带着 `BASE64`，是历史原因：旧版本这个 key 下面确实存过 base64。现在为了不破坏旧数据位置，仍然沿用这个 key，但值已经可以是 Blob。

对应代码在 `src/stores/settings.ts`。

## 页面显示壁纸时怎么拿到图片

背景组件不直接读 IndexedDB，也不碰 base64。

它只看两个来源：

```ts
const src = store.wallpaperBlobUrl || store.data.wallpaperUrl
```

如果是本地上传的壁纸，走 `store.wallpaperBlobUrl`。  
如果是远程 URL 或 Wallhaven 壁纸，走 `store.data.wallpaperUrl`。

然后照常塞给 CSS：

```ts
backgroundImage: `url(${src})`
```

这就是为什么本地壁纸现在不会把大 base64 字符串放进 CSS 里。CSS 看到的是一个短的 `blob:` URL，实际图片数据由浏览器自己管理。

对应代码在 `src/components/WallpaperBg.vue`。

## 刷新页面后怎么恢复本地壁纸

`blob:` URL 不能长期保存。刷新页面后，旧的 `blob:` URL 会失效。

所以刷新后恢复壁纸的过程是：

1. store 启动时从 IndexedDB 读取本地壁纸 Blob。
2. 如果读到了 Blob，就重新 `URL.createObjectURL(blob)`。
3. 把新的 `blob:` URL 放进 `wallpaperBlobUrl`。
4. 背景组件重新用这个 URL 显示壁纸。

这就是文档开头说的原则：保存的是 Blob，显示时临时生成 blob URL。

## 旧 base64 壁纸怎么兼容

旧版本可能已经把壁纸保存成 base64 了。为了不让老用户升级后壁纸丢失，store 里保留了迁移逻辑。

如果从旧存储里读到的是 base64 字符串，就会走：

```ts
base64ToBlob(...)
```

把它转成 Blob，再重新保存到 IndexedDB。之后运行时还是用 `blob:` URL 显示。

这条兼容路径只服务旧数据。新的上传流程不会再主动创建完整 base64 data URL。

## 为什么壁纸不参与导入导出

现在导入导出只负责配置，比如图标、搜索、布局、开关之类。

壁纸文件本身不导出，也不从配置文件导入。原因很简单：壁纸可能很大，把它塞进 JSON 会让配置文件变重，也会重新引入 base64 那套问题。

所以导出时会主动清空这些字段：

```ts
wallpaperUrl
wallpaperBase64
wallpaperColor
wallpaperHistory
```

导入时也会忽略这些字段，不覆盖当前设备已有的壁纸。

这样配置同步和壁纸管理就分开了：配置文件保持轻量，本地壁纸留在本机。

## 这套逻辑的好处

第一，上传时少了一次完整 base64 生成。  
过去是先把文件读成一大段字符串，现在是直接用 File/Blob 和 object URL。

第二，运行时状态更轻。  
Pinia 里不再挂着几 MB 甚至十几 MB 的 base64 字符串。

第三，CSS 背景更干净。  
背景图用的是短 `blob:` URL，不是超长 data URL。

第四，大图会被缩到屏幕实际需要的尺寸。  
用户传 4K 图时，不会无条件按 4K 原图保存和显示。

第五，旧数据还能读。  
已有 base64 壁纸会迁移成 Blob，不需要用户重新上传。

## 一句话总结

现在的壁纸链路是：

上传时拿 `File`，必要时用 canvas 缩成 `Blob`，保存时把 `Blob` 放进 IndexedDB，显示时临时生成 `blob:` URL，导入导出时完全不带壁纸文件。

这样做的重点不是“Blob 比 base64 神奇”，而是让图片继续作为图片文件来管理，不再把它伪装成一大段配置文本。
