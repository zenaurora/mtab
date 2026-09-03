import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('read-later merge moves selected pages first, deduplicates, and caps the queue', async () => {
  const server = await createServer({
    appType: 'custom',
    server: { hmr: false, middlewareMode: true, ws: false },
  })

  try {
    const { mergeReadLaterItems, READ_LATER_LIMIT } = await server.ssrLoadModule(
      '/src/readLater/model.ts',
    )
    const existing = Array.from({ length: READ_LATER_LIMIT }, (_, index) => ({
      id: `old-${index}`,
      title: `Old ${index}`,
      url: `https://example.com/${index}`,
      savedAt: '2026-09-01T00:00:00.000Z',
    }))
    const selected = [
      { ...existing[4], title: 'Updated', savedAt: '2026-09-03T00:00:00.000Z' },
      { id: 'new', title: 'New', url: 'https://example.org/new', savedAt: '2026-09-03T00:00:00.000Z' },
      { id: 'duplicate-tab', title: 'Duplicate', url: existing[4].url, savedAt: '2026-09-03T00:00:00.000Z' },
    ]

    const merged = mergeReadLaterItems(selected, existing)

    assert.equal(merged.length, READ_LATER_LIMIT)
    assert.deepEqual(merged.slice(0, 2).map((item) => item.title), ['Updated', 'New'])
    assert.equal(merged.filter((item) => item.url === existing[4].url).length, 1)
    assert.equal(merged.some((item) => item.url === existing.at(-1).url), false)
  } finally {
    await server.close()
  }
})
