import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { installDemoEmbedBridge } from '@/demo/embedBridge'

const message = vi.fn()
const disconnect = vi.fn()

class Observer {
  observe = vi.fn()
  disconnect = disconnect
}

describe('demo embed bridge', () => {
  beforeEach(() => {
    message.mockReset()
    disconnect.mockReset()
    vi.stubGlobal('ResizeObserver', Observer)
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage: message },
    })
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: 'https://showcase.example/projects/demo',
    })
    window.history.replaceState({}, '', '/?childRoute=%2Fembedded')
    vi.stubEnv('VITE_EMBED_HOST_ORIGIN', 'https://showcase.example')
  })

  it('sends only typed messages to the configured parent and releases resources', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/embedded', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    expect(window.parent).not.toBe(window)
    expect(document.referrer).toContain('showcase.example')
    expect(window.location.search).toBe('?childRoute=%2Fembedded')
    const dispose = installDemoEmbedBridge(router)
    await router.isReady()
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/embedded'))
    expect(message).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ready', appKey: 'waveform-analysis' }),
      'https://showcase.example',
    )
    await router.push('/')
    expect(message).toHaveBeenCalledWith(
      { type: 'route-change', appKey: 'waveform-analysis', route: '/' },
      'https://showcase.example',
    )
    dispose()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it.each(['\u0000', '\u001f', '\u007f'])(
    'rejects control characters %j in routes',
    async (character) => {
      window.history.replaceState({}, '', `/?childRoute=${encodeURIComponent('/' + character)}`)
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/', component: { template: '<div />' } }],
      })
      await router.push('/')
      const dispose = installDemoEmbedBridge(router)
      await router.isReady()
      await vi.waitFor(() => expect(message).toHaveBeenCalled())
      expect(router.currentRoute.value.fullPath).toBe('/')
      dispose()
    },
  )

  it('does not activate for an untrusted embedding parent', async () => {
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: 'https://other.example/',
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    installDemoEmbedBridge(router)
    expect(message).not.toHaveBeenCalled()
  })
})
