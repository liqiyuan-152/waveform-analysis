import type { Router } from 'vue-router'

type EmbedMessage =
  | { type: 'ready'; appKey: string }
  | { type: 'route-change'; appKey: string; route: string }
  | { type: 'resize'; appKey: string; height: number }

const routeLimit = 2048

export function installDemoEmbedBridge(router: Router) {
  const hostOrigin = trustedHostOrigin()
  if (!hostOrigin) return () => undefined

  const post = (message: EmbedMessage) => window.parent.postMessage(message, hostOrigin)
  const requestedRoute = safeRoute(new URLSearchParams(window.location.search).get('childRoute'))
  let active = false

  const removeRouteHook = router.afterEach((route) => {
    if (!active) return
    post({
      type: 'route-change',
      appKey: appKey(),
      route: route.fullPath,
    })
  })
  const observer = new ResizeObserver(() =>
    post({
      type: 'resize',
      appKey: appKey(),
      height: Math.ceil(document.documentElement.scrollHeight),
    }),
  )
  observer.observe(document.documentElement)
  void router.isReady().then(async () => {
    if (requestedRoute && requestedRoute !== router.currentRoute.value.fullPath)
      await router.replace(requestedRoute)
    active = true
    post({ type: 'ready', appKey: appKey() })
    post({ type: 'route-change', appKey: appKey(), route: router.currentRoute.value.fullPath })
    post({
      type: 'resize',
      appKey: appKey(),
      height: Math.ceil(document.documentElement.scrollHeight),
    })
  })

  return () => {
    removeRouteHook()
    observer.disconnect()
  }
}

function appKey() {
  return import.meta.env.VITE_EMBED_APP_KEY || 'waveform-analysis'
}

function trustedHostOrigin() {
  const configured = import.meta.env.VITE_EMBED_HOST_ORIGIN
  if (!configured || window.parent === window) return null
  try {
    const expected = new URL(configured).origin
    return new URL(document.referrer).origin === expected ? expected : null
  } catch {
    return null
  }
}

function safeRoute(value: string | null) {
  if (
    !value ||
    value.length > routeLimit ||
    !value.startsWith('/') ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return null
  try {
    return new URL(value, 'https://waveform.invalid').origin === 'https://waveform.invalid'
      ? value
      : null
  } catch {
    return null
  }
}
