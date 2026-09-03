import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

async function loadCanvasGridModule() {
  const server = await createServer({
    appType: 'custom',
    server: { hmr: false, middlewareMode: true, ws: false },
  })
  try {
    return await server.ssrLoadModule('/src/layout/canvasGrid.ts')
  } finally {
    await server.close()
  }
}

test('canvas grid uses a non-negative top-left origin with balanced horizontal margins', async () => {
  const { createCanvasGrid } = await loadCanvasGridModule()
  const grid = createCanvasGrid({
    viewportWidth: 1440,
    viewportHeight: 900,
    cellSize: 76,
    padding: { left: 24, right: 24, top: 42, bottom: 24 },
  })

  assert.equal(grid.columns, 18)
  assert.equal(grid.rows, 10)
  assert.deepEqual(grid.boundsFor({ gridW: 4, gridH: 3 }), {
    minX: 0,
    minY: 0,
    maxX: 14,
    maxY: 7,
  })

  const left = grid.toPixels({ gridX: 0, gridY: 0 }).x
  const right = grid.toPixels({ gridX: 14, gridY: 0 }).x + 4 * grid.cellSize
  assert.equal(left, 1440 - right)
})

test('large items snap by their top-left corner and reach both canvas edges', async () => {
  const { createCanvasGrid } = await loadCanvasGridModule()
  const grid = createCanvasGrid({
    viewportWidth: 1440,
    viewportHeight: 900,
    cellSize: 76,
    padding: { left: 24, right: 24, top: 42, bottom: 24 },
  })

  assert.deepEqual(
    grid.snapPixels(grid.origin, { gridW: 4, gridH: 3 }),
    { gridX: 0, gridY: 0 },
  )
  assert.deepEqual(
    grid.snapPixels({ x: 10_000, y: 10_000 }, { gridW: 4, gridH: 3 }),
    { gridX: 14, gridY: 7 },
  )
})
