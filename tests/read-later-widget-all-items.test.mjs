import assert from 'node:assert/strict'
import test from 'node:test'
import { createSSRApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { renderToString } from '@vue/server-renderer'
import { createServer } from 'vite'

test('the read-later widget renders the fifth saved page', async () => {
  const items = Array.from({ length: 5 }, (_, index) => ({
    id: `page-${index + 1}`,
    title: `Page ${index + 1}`,
    url: `https://example.com/${index + 1}`,
    savedAt: new Date(2026, 0, index + 1).toISOString(),
  }))
  globalThis.localStorage = {
    getItem: (key) => key === 'mtab_read_later' ? JSON.stringify(items) : null,
    setItem() {},
    removeItem() {},
  }
  const pinia = createPinia()
  setActivePinia(pinia)
  const server = await createServer({
    appType: 'custom',
    server: { hmr: false, middlewareMode: true, ws: false },
  })

  try {
    const { useReadLaterStore } = await server.ssrLoadModule('/src/stores/readLater.ts')
    const { default: ReadLaterWidget } = await server.ssrLoadModule('/src/components/widgets/ReadLaterWidget.vue')
    await useReadLaterStore().load()
    const app = createSSRApp(ReadLaterWidget)
    app.use(pinia)
    const html = await renderToString(app)
    assert.match(html, /Page 5/)
    assert.match(html, /https:\/\/example\.com\/5/)
  } finally {
    await server.close()
  }
})
