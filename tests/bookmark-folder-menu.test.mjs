import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createApp, createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createServer } from 'vite'

function cssRule(source, selector, occurrence = 0) {
  let start = -1
  for (let index = 0; index <= occurrence; index++) {
    start = source.indexOf(selector, start + 1)
  }
  assert.notEqual(start, -1, `Missing CSS selector: ${selector}`)
  const bodyStart = source.indexOf('{', start)
  const bodyEnd = source.indexOf('}', bodyStart)
  return source.slice(bodyStart + 1, bodyEnd)
}

test('nested bookmark folders are not positioned outside a clipping menu', async () => {
  const source = await readFile(
    new URL('../src/components/BrowserBookmarkBar.vue', import.meta.url),
    'utf8',
  )
  const menuRule = cssRule(source, '.folder-menu,\n:deep(.folder-submenu)')
  const submenuRule = cssRule(source, ':deep(.folder-submenu) {', 1)
  const rootClipsOverflow = /overflow-y:\s*auto/.test(menuRule)
  const submenuFliesOutsideRoot =
    /position:\s*absolute/.test(menuRule) && /left:\s*calc\(100%/.test(submenuRule)

  assert.equal(
    rootClipsOverflow && submenuFliesOutsideRoot,
    false,
    'an overflow menu clips the nested submenu positioned beyond its right edge',
  )
})

test('preloaded nested bookmark folders render their children recursively', async () => {
  const server = await createServer({
    appType: 'custom',
    server: { hmr: false, middlewareMode: true, ws: false },
  })

  try {
    const { default: BookmarkFolderMenu } = await server.ssrLoadModule(
      '/src/components/BookmarkFolderMenu.vue',
    )
    const items = [{
      id: 'folder',
      title: 'Nested folder',
      childrenLoaded: true,
      children: [{ id: 'link', title: 'Nested bookmark', url: 'https://example.com' }],
    }]
    const app = createSSRApp({ render: () => h(BookmarkFolderMenu, { items }) })

    const html = await renderToString(app)

    assert.match(html, /Nested bookmark/)
  } finally {
    await server.close()
  }
})

test('clicking a nested folder explicitly toggles its open state', async () => {
  const server = await createServer({
    appType: 'custom',
    server: { hmr: false, middlewareMode: true, ws: false },
  })

  try {
    const { default: BookmarkFolderMenu } = await server.ssrLoadModule(
      '/src/components/BookmarkFolderMenu.vue',
    )
    const item = { id: 'folder', title: 'Nested folder', children: [] }
    const app = createApp({})
    app.provide(Symbol.for('v-scx'), { modules: new Set() })
    const setup = app.runWithContext(() => BookmarkFolderMenu.setup(
      { items: [item] },
      { expose() {}, emit() {} },
    ))

    assert.equal(typeof setup.toggleFolder, 'function')
    setup.toggleFolder(item)
    assert.equal(setup.openFolderId.value, item.id)
    setup.toggleFolder(item)
    assert.equal(setup.openFolderId.value, null)
  } finally {
    await server.close()
  }
})
