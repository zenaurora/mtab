import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { createServer } from 'vite'

test('settings use the current canonical schema only', async () => {
  setActivePinia(createPinia())
  let readKey = ''
  let writtenSettings = ''
  globalThis.localStorage = {
    getItem(key) {
      readKey = key
      return JSON.stringify({ searchBarWidth: 50, widgets: [], bookmarks: [] })
    },
    setItem(_key, value) {
      writtenSettings = value
    },
    removeItem() {},
  }
  const server = await createServer({
    appType: 'custom',
    server: { hmr: false, middlewareMode: true, ws: false },
  })

  try {
    const { useSettingsStore } = await server.ssrLoadModule('/src/stores/settings.ts')
    const store = useSettingsStore()
    const originalWarn = console.warn
    console.warn = () => {}
    try {
      await store.load()
    } finally {
      console.warn = originalWarn
    }
    const config = store.exportConfig()

    assert.equal(readKey, 'mtab_settings')
    assert.deepEqual(JSON.parse(writtenSettings).searchBar, {
      widthPercent: 50,
      verticalPosition: 'center',
      offsetY: 0,
    })
    assert.equal('version' in config, false)
    assert.deepEqual(config.settings.searchBar, {
      widthPercent: 50,
      verticalPosition: 'center',
      offsetY: 0,
    })
    assert.equal('searchBarWidth' in config.settings, false)
    assert.equal('searchBarPosition' in config.settings, false)
    assert.equal('searchBarOffsetY' in config.settings, false)
    assert.equal('wallpaperBase64' in config.settings, false)
    assert.equal('defaultBookmarkSeedVersion' in config.settings, false)
    assert.equal(config.settings.widgets.some((widget) => widget.type === 'search'), false)
    assert.equal(
      config.settings.bookmarks.some((bookmark) => 'gridW' in bookmark || 'gridH' in bookmark),
      false,
    )

    const updated = structuredClone(config)
    updated.settings.searchBar.widthPercent = 65
    store.importConfig(updated)
    assert.equal(store.data.searchBar.widthPercent, 65)
  } finally {
    await server.close()
  }
})
