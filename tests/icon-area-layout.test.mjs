import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

async function loadIconAreaModule() {
  const server = await createServer({
    appType: 'custom',
    server: { hmr: false, middlewareMode: true, ws: false },
  })
  try {
    return await server.ssrLoadModule('/src/layout/iconArea.ts')
  } finally {
    await server.close()
  }
}

function baseInput(overrides = {}) {
  return {
    viewport: {
      width: 1440,
      height: 900,
      horizontalPadding: 24,
      topPadding: 42,
      bottomPadding: 24,
    },
    grid: {
      cellSize: 76,
      offsetX: 112,
      offsetY: -120,
    },
    insets: { leftPercent: 0, rightPercent: 0 },
    requiredCells: 1,
    blockers: [],
    ...overrides,
  }
}

test('pixel frame stays symmetric while its internal grid may use signed columns', async () => {
  const { calculateIconAreaLayout } = await loadIconAreaModule()
  const layout = calculateIconAreaLayout(baseInput())

  assert.equal(layout.frame.left, 24)
  assert.equal(1440 - layout.frame.right, 24)
  assert.equal(layout.gridBounds.minX, -1)

  const gridLeft = 112 + layout.gridBounds.minX * 76
  const gridRight = 112 + (layout.gridBounds.maxX + 1) * 76
  assert.ok(gridLeft >= layout.frame.left)
  assert.ok(gridRight <= layout.frame.right)
})

test('left and right percentages are measured inside the symmetric base padding', async () => {
  const { calculateIconAreaLayout } = await loadIconAreaModule()
  const layout = calculateIconAreaLayout(baseInput({
    insets: { leftPercent: 10, rightPercent: 20 },
  }))
  const usableWidth = 1440 - 48

  assert.ok(Math.abs(layout.frame.left - (24 + usableWidth * 0.1)) < 1e-9)
  assert.ok(Math.abs(1440 - layout.frame.right - (24 + usableWidth * 0.2)) < 1e-9)
})

test('capacity expansion changes the effective frame but never exceeds base padding', async () => {
  const { calculateIconAreaLayout } = await loadIconAreaModule()
  const layout = calculateIconAreaLayout(baseInput({
    insets: { leftPercent: 40, rightPercent: 40 },
    requiredCells: 28,
    blockers: [{ gridX: 4, gridY: 4, gridW: 9, gridH: 1 }],
  }))

  assert.equal(layout.expandedForCapacity, true)
  assert.ok(layout.frame.left >= 24)
  assert.ok(layout.frame.right <= 1416)
  assert.ok(layout.frame.width > layout.requestedFrame.width)
})
