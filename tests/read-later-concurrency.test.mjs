import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { createServer } from 'vite'

test('concurrent read-later additions and removals preserve every unrelated item', async () => {
  const tabs = [
    { id: 1, url: 'https://a.example/', title: 'A' },
    { id: 2, url: 'https://b.example/', title: 'B' },
    { id: 3, url: 'https://c.example/', title: 'C' },
    { id: 4, url: 'https://d.example/', title: 'D' },
  ]
  let stored = []
  let onMessage
  const changeListeners = []

  globalThis.chrome = {
    storage: {
      local: {
        get: async () => ({ mtab_read_later: structuredClone(stored) }),
        set: async ({ mtab_read_later: items }) => {
          const oldValue = stored
          stored = structuredClone(items)
          for (const listener of changeListeners) {
            listener({ mtab_read_later: { oldValue, newValue: structuredClone(stored) } }, 'local')
          }
        },
      },
      onChanged: { addListener: (listener) => changeListeners.push(listener) },
    },
    tabs: { query: async () => tabs },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: { addListener(listener) { onMessage = listener } },
      sendMessage: (message) => new Promise((resolve) => onMessage(message, {}, resolve)),
    },
    contextMenus: { onClicked: { addListener() {} } },
  }
  setActivePinia(createPinia())
  const server = await createServer({
    appType: 'custom',
    server: { hmr: false, middlewareMode: true, ws: false },
  })

  try {
    await server.ssrLoadModule('/src/background.ts')
    const { useReadLaterStore } = await server.ssrLoadModule('/src/stores/readLater.ts')
    const store = useReadLaterStore()
    await store.load()

    const [first, second] = await Promise.all([
      store.captureTabs([1]),
      store.captureTabs([2]),
    ])
    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    assert.deepEqual(new Set(stored.map((item) => item.title)), new Set(['A', 'B']))

    const removed = stored.find((item) => item.title === 'A')
    assert.ok(removed)
    const [removedItem, third] = await Promise.all([
      store.remove(removed.id),
      store.captureTabs([3]),
    ])
    assert.equal(removedItem?.id, removed.id)
    assert.equal(third.ok, true)
    assert.deepEqual(new Set(stored.map((item) => item.title)), new Set(['B', 'C']))

    const [restored, fourth] = await Promise.all([
      store.restore(removed),
      store.captureTabs([4]),
    ])
    assert.equal(restored, true)
    assert.equal(fourth.ok, true)
    assert.deepEqual(new Set(stored.map((item) => item.title)), new Set(['A', 'B', 'C', 'D']))
  } finally {
    await server.close()
    delete globalThis.chrome
  }
})
