import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createSSRApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { renderToString } from '@vue/server-renderer'
import { createServer } from 'vite'

async function loadDesktopCanvasSetup() {
  globalThis.window = {
    innerWidth: 1440,
    innerHeight: 900,
    location: { href: '' },
  }
  globalThis.requestAnimationFrame = (callback) => {
    callback(0)
    return 1
  }
  globalThis.cancelAnimationFrame = () => {}
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  }

  const pinia = createPinia()
  setActivePinia(pinia)

  const server = await createServer({
    appType: 'custom',
    server: { hmr: false, middlewareMode: true, ws: false },
  })

  try {
    const { default: DesktopCanvas } = await server.ssrLoadModule(
      '/src/components/DesktopCanvas.vue',
    )
    const originalSetup = DesktopCanvas.setup
    let setupState
    DesktopCanvas.setup = (props, context) => {
      setupState = originalSetup(props, context)
      return setupState
    }

    const app = createSSRApp(DesktopCanvas)
    app.use(pinia)
    await renderToString(app)
    return setupState
  } finally {
    await server.close()
  }
}

test('Add icon previews its snapped position like a regular dragged icon', async () => {
  const canvas = await loadDesktopCanvasSetup()
  const target = { gridX: 3, gridY: 8 }
  const addButtonId = '__add_btn__'

  canvas.store.data.addButtonGridX = 10
  canvas.store.data.addButtonGridY = 8
  canvas.dragKind.value = 'icon'
  canvas.draggingId.value = addButtonId
  canvas.dragStartGridX.value = 10
  canvas.dragStartGridY.value = 8

  canvas.updatePreviewPositions(target.gridX, target.gridY)

  assert.deepEqual(canvas.previewPositions[addButtonId], target)
})

test('Add icon animates out of the way when another icon is dragged onto it', async () => {
  const canvas = await loadDesktopCanvasSetup()
  const addButtonId = '__add_btn__'
  const bookmark = canvas.store.data.bookmarks[0]

  canvas.store.data.addButtonGridX = 10
  canvas.store.data.addButtonGridY = 8
  canvas.dragKind.value = 'icon'
  canvas.draggingId.value = bookmark.id
  canvas.dragStartGridX.value = bookmark.gridX
  canvas.dragStartGridY.value = bookmark.gridY

  canvas.updatePreviewPositions(10, 8)

  assert.deepEqual(canvas.previewPositions[bookmark.id], { gridX: 10, gridY: 8 })
  assert.deepEqual(canvas.previewPositions[addButtonId], { gridX: 11, gridY: 8 })
})

test('icons preview a free position when a multi-cell widget is dragged over them', async () => {
  const canvas = await loadDesktopCanvasSetup()
  const bookmark = canvas.store.data.bookmarks[0]
  const widget = {
    id: 'widget_currency',
    type: 'currency',
    gridX: 1,
    gridY: 1,
    gridW: 3,
    gridH: 3,
  }
  bookmark.gridX = 1
  bookmark.gridY = 9
  canvas.store.data.widgets = [widget]
  canvas.dragKind.value = 'widget'
  canvas.draggingId.value = widget.id

  canvas.updatePreviewPositions(bookmark.gridX, bookmark.gridY)

  const preview = canvas.previewPositions[bookmark.id]
  assert.ok(preview, 'the covered icon should receive a preview position')
  assert.equal(
    preview.gridX >= bookmark.gridX &&
      preview.gridX < bookmark.gridX + widget.gridW &&
      preview.gridY >= bookmark.gridY &&
      preview.gridY < bookmark.gridY + widget.gridH,
    false,
    'the preview position should be outside the widget footprint',
  )
})

test('global pointer listeners only stay active during a drag interaction', async () => {
  const canvas = await loadDesktopCanvasSetup()
  const added = []
  const removed = []
  window.addEventListener = (type) => added.push(type)
  window.removeEventListener = (type) => removed.push(type)

  canvas.startDragListeners()
  canvas.startDragListeners()

  assert.deepEqual(added, ['pointermove', 'pointerup', 'pointercancel'])

  canvas.stopDragListeners()
  canvas.stopDragListeners()

  assert.deepEqual(removed, ['pointermove', 'pointerup', 'pointercancel'])
})

test('layout reconciliation moves widgets away from the responsive search bar', async () => {
  const canvas = await loadDesktopCanvasSetup()
  const search = canvas.searchGridRect.value
  const widget = {
    id: 'widget_clock',
    type: 'clock',
    gridX: search.gridX,
    gridY: search.gridY,
    gridW: 2,
    gridH: 2,
  }
  canvas.store.data.widgets = [widget]

  canvas.clampCurrentLayoutToViewport()

  const moved = canvas.store.data.widgets[0]
  const overlapsSearch =
    moved.gridX < search.gridX + search.gridW &&
    moved.gridX + moved.gridW > search.gridX &&
    moved.gridY < search.gridY + search.gridH &&
    moved.gridY + moved.gridH > search.gridY
  assert.equal(overlapsSearch, false)
})

test('icon positions are clamped inside the configured horizontal activity area', async () => {
  const canvas = await loadDesktopCanvasSetup()
  canvas.store.data.iconArea.leftPercent = 20
  canvas.store.data.iconArea.rightPercent = 25

  const bounds = canvas.iconGridBounds.value
  assert.ok(bounds.minX > canvas.gridBounds(1, 1).minX)
  assert.ok(bounds.maxX < canvas.gridBounds(1, 1).maxX)

  assert.deepEqual(
    canvas.clampIconGridPosition(bounds.minX - 10, 8),
    { gridX: bounds.minX, gridY: 8 },
  )
  assert.deepEqual(
    canvas.clampIconGridPosition(bounds.maxX + 10, 8),
    { gridX: bounds.maxX, gridY: 8 },
  )
})

test('the visible icon-area frame uses symmetric screen-edge padding at zero insets', async () => {
  const canvas = await loadDesktopCanvasSetup()
  canvas.store.data.iconArea.leftPercent = 0
  canvas.store.data.iconArea.rightPercent = 0

  const style = canvas.iconAreaGuideStyle.value
  const [, translatedX] = /translate3d\(([-\d.]+)px,/.exec(style.transform)
  const left = Number(translatedX)
  const right = window.innerWidth - left - Number.parseFloat(style.width)

  assert.equal(left, 24)
  assert.equal(right, 24)
})

test('an over-constrained icon area expands just enough to keep every icon in a unique cell', async () => {
  const canvas = await loadDesktopCanvasSetup()
  canvas.store.data.iconArea.leftPercent = 40
  canvas.store.data.iconArea.rightPercent = 40

  const requested = canvas.iconAreaLayout.value.requestedGridBounds
  const effective = canvas.iconGridBounds.value
  assert.ok(
    effective.minX < requested.minX || effective.maxX > requested.maxX,
    'the effective range should expand when the requested range has too few cells',
  )

  canvas.clampCurrentLayoutToViewport()

  const positions = [
    ...canvas.store.data.bookmarks.map(({ gridX, gridY }) => ({ gridX, gridY })),
    {
      gridX: canvas.store.data.addButtonGridX,
      gridY: canvas.store.data.addButtonGridY,
    },
  ]
  const keys = positions.map(({ gridX, gridY }) => `${gridX},${gridY}`)
  assert.equal(new Set(keys).size, keys.length)
  assert.equal(
    positions.every(({ gridX, gridY }) =>
      gridX >= effective.minX &&
      gridX <= effective.maxX &&
      gridY >= effective.minY &&
      gridY <= effective.maxY,
    ),
    true,
  )
})

test('drag plans use the effective icon area at both horizontal edges', async () => {
  const canvas = await loadDesktopCanvasSetup()
  canvas.store.data.iconArea.leftPercent = 20
  canvas.store.data.iconArea.rightPercent = 20
  const bookmark = canvas.store.data.bookmarks[0]
  canvas.dragStartGridX.value = bookmark.gridX
  canvas.dragStartGridY.value = bookmark.gridY

  const leftPlan = canvas.planIconDrop(bookmark.id, -100, bookmark.gridY)
  const rightPlan = canvas.planIconDrop(bookmark.id, 100, bookmark.gridY)

  assert.equal(leftPlan.patches.at(-1).gridX, canvas.iconGridBounds.value.minX)
  assert.equal(rightPlan.patches.at(-1).gridX, canvas.iconGridBounds.value.maxX)
})

test('the icon-area guide renders above settings without intercepting input', async () => {
  const source = await readFile(
    new URL('../src/components/DesktopCanvas.vue', import.meta.url),
    'utf8',
  )
  const teleportedGuide = /<Teleport to="body">\s*<div\s+v-if="showIconAreaGuide"\s+class="icon-area-guide"/.test(source)
  const guideRule = /\.icon-area-guide\s*{([^}]*)}/.exec(source)?.[1] ?? ''

  assert.equal(teleportedGuide, true)
  assert.match(guideRule, /position:\s*fixed/)
  assert.match(guideRule, /z-index:\s*60/)
  assert.match(guideRule, /pointer-events:\s*none/)
})
