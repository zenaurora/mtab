import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { createServer } from 'vite'

test('two open tabs keep unrelated setting changes and save notes before navigation', async () => {
  const stored = {}
  const listeners = []
  let onMessage
  globalThis.chrome = {
    storage: {
      local: {
        get: async (keys) => Object.fromEntries(
          (Array.isArray(keys) ? keys : [keys])
            .filter((key) => key in stored)
            .map((key) => [key, structuredClone(stored[key])]),
        ),
        set: async (values) => {
          const changes = Object.fromEntries(Object.entries(values).map(([key, value]) => [
            key,
            { oldValue: structuredClone(stored[key]), newValue: structuredClone(value) },
          ]))
          Object.assign(stored, structuredClone(values))
          for (const listener of listeners) listener(changes, 'local')
        },
      },
      onChanged: { addListener: (listener) => listeners.push(listener) },
    },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: { addListener(listener) { onMessage = listener } },
      sendMessage: (message) => new Promise((resolve) => onMessage(message, {}, resolve)),
    },
    contextMenus: { onClicked: { addListener() {} } },
  }
  let navigatedTo = ''
  globalThis.window = { location: {
    set href(url) {
      assert.equal(stored.mtab_settings.notesContent, 'typed just before click')
      navigatedTo = url
    },
  } }
  setActivePinia(createPinia())
  const server = await createServer({
    appType: 'custom',
    server: { hmr: false, middlewareMode: true, ws: false },
  })

  try {
    await server.ssrLoadModule('/src/background.ts')
    const { useSettingsStorage } = await server.ssrLoadModule('/src/composables/useSettingsStorage.ts')
    const initial = { theme: 'light', notesContent: '', bookmarks: [
      { id: 'a', name: 'A' }, { id: 'b', name: 'B' },
    ] }
    const first = useSettingsStorage(initial, (value) => value)
    const second = useSettingsStorage(initial, (value) => value)
    await Promise.all([first.load(), second.load()])

    first.data.value.theme = 'dark'
    second.data.value.notesContent = 'hello'
    first.data.value.bookmarks[0].name = 'A1'
    second.data.value.bookmarks[1].name = 'B1'
    await Promise.all([first.save(), second.save()])
    assert.deepEqual(stored.mtab_settings, {
      theme: 'dark', notesContent: 'hello', bookmarks: [
        { id: 'a', name: 'A1' }, { id: 'b', name: 'B1' },
      ],
    })
    assert.equal(first.data.value.notesContent, 'hello')
    assert.equal(second.data.value.theme, 'dark')

    const { mergeChanges } = await server.ssrLoadModule('/src/settings/mergeChanges.ts')
    assert.deepEqual(
      mergeChanges(
        [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
        [{ id: 'a', name: 'A' }, { id: 'b', name: 'B2' }],
        [{ id: 'b', name: 'B' }],
      ),
      [{ id: 'b', name: 'B2' }],
    )

    const { useSettingsStore } = await server.ssrLoadModule('/src/stores/settings.ts')
    const { navigateAfterSavingSettings } = await server.ssrLoadModule('/src/utils/navigation.ts')
    const store = useSettingsStore()
    const originalWarn = console.warn
    console.warn = () => {}
    try {
      await store.load()
    } finally {
      console.warn = originalWarn
    }
    store.setNotesContent('typed just before click')
    await navigateAfterSavingSettings('https://example.com/')
    assert.equal(stored.mtab_settings.notesContent, 'typed just before click')
    assert.equal(navigatedTo, 'https://example.com/')
  } finally {
    await server.close()
    delete globalThis.chrome
    delete globalThis.window
  }
})
