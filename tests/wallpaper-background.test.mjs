import assert from 'node:assert/strict'
import test from 'node:test'
import { createSSRApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { renderToString } from '@vue/server-renderer'
import { createServer } from 'vite'

test('an empty wallpaper uses the active theme background instead of a fixed corner gradient', async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const server = await createServer({
    appType: 'custom',
    server: { hmr: false, middlewareMode: true, ws: false },
  })

  try {
    const { default: WallpaperBg } = await server.ssrLoadModule(
      '/src/components/WallpaperBg.vue',
    )
    const originalSetup = WallpaperBg.setup
    let setupState
    WallpaperBg.setup = (props, context) => {
      setupState = originalSetup(props, context)
      return setupState
    }

    const app = createSSRApp(WallpaperBg)
    app.use(pinia)
    await renderToString(app)

    assert.equal(setupState.bgStyle.value.background, 'var(--wallpaper-background)')
    assert.equal(setupState.bgStyle.value.background.includes('radial-gradient'), false)
  } finally {
    await server.close()
  }
})
