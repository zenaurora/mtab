import assert from 'node:assert/strict'
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
