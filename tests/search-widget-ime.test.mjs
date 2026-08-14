import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createServer } from 'vite'

async function loadSearchWidgetSetup() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const app = createApp({})
  app.use(pinia)
  app.provide(Symbol.for('v-scx'), { modules: new Set() })

  const server = await createServer({
    appType: 'custom',
    server: { hmr: false, middlewareMode: true, ws: false },
  })

  try {
    const { default: SearchWidget } = await server.ssrLoadModule(
      '/src/components/widgets/SearchWidget.vue',
    )
    return app.runWithContext(() => SearchWidget.setup({}, { expose() {} }))
  } finally {
    await server.close()
  }
}

test('Enter used to confirm an IME candidate does not submit the search', async () => {
  globalThis.window = { location: { href: '' } }
  const widget = await loadSearchWidgetSetup()
  widget.query.value = '中文'

  widget.onKeydown({ key: 'Enter', isComposing: true })

  assert.equal(window.location.href, '')
})

test('Enter submits after IME composition has finished', async () => {
  globalThis.window = { location: { href: '' } }
  const widget = await loadSearchWidgetSetup()
  widget.query.value = '中文'

  widget.onKeydown({ key: 'Enter', isComposing: false })

  assert.equal(
    window.location.href,
    'https://www.google.com/search?q=%E4%B8%AD%E6%96%87',
  )
})
