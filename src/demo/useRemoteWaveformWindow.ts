import { computed, onScopeDispose, shallowRef, watch, type Ref } from 'vue'
import type {
  WaveformData,
  WaveformPanEndPayload,
  WaveformZoomEndPayload,
  WaveformZoomIntentPayload,
  WaveformZoomResetPayload,
} from '../types'
import {
  createMockWindowLoader,
  mergeWaveformWindow,
  selectWaveformWindow,
  waveformRecordMetadata,
  type RemoteWindowLoader,
  type RemoteWindowRequest,
} from './remoteWaveformLoader'

interface WindowState {
  request: RemoteWindowRequest
  version: number
  controller?: AbortController
  loading: boolean
  error?: string
}

interface RemoteWindowOptions {
  loadWindow?: RemoteWindowLoader
  resetViewport?: (trackIndex?: number) => void
}

type WindowPayload = WaveformPanEndPayload | WaveformZoomEndPayload

export function useRemoteWaveformWindow(
  source: Ref<WaveformData>,
  options: RemoteWindowOptions = {},
) {
  const metadata = computed(() => waveformRecordMetadata(source.value))
  const recordDomain = computed(() => metadata.value.domain)
  const initialXDomain = computed(() => recordDomain.value)
  const minZoomSpan = computed(() => metadata.value.minZoomSpan)
  const chartData = shallowRef<WaveformData>(
    selectWaveformWindow(
      source.value,
      { start: recordDomain.value[0], end: recordDomain.value[1] },
      true,
    ),
  )
  const states = shallowRef(new Map<string, WindowState>())
  const loadWindow = options.loadWindow ?? createMockWindowLoader(() => source.value)
  let disposed = false
  let intentTarget: string | undefined
  let intentSequence = 0
  const pendingCommands = new Map<string, object>()

  const keyFor = (seriesIds?: string[]) =>
    seriesIds?.length ? JSON.stringify([...seriesIds].sort()) : 'shared'
  const publish = () => (states.value = new Map(states.value))

  function cancel(key: string) {
    const state = states.value.get(key)
    if (!state) return
    state.version++
    state.controller?.abort()
    state.controller = undefined
    state.loading = false
    state.error = undefined
  }

  function cancelAll() {
    for (const key of states.value.keys()) cancel(key)
    publish()
  }

  function handleZoomIntent(payload: WaveformZoomIntentPayload) {
    const key = keyFor(payload.seriesIds)
    if (key === 'shared') pendingCommands.clear()
    else pendingCommands.delete(key)
    if (key === 'shared') cancelAll()
    else {
      cancel('shared')
      cancel(key)
    }
    const previous = states.value.get(key)
    states.value.set(key, {
      request: { start: payload.start, end: payload.end, seriesIds: payload.seriesIds },
      version: previous?.version ?? 0,
      loading: false,
    })
    publish()
    // Command intent/change/end arrive synchronously per target. Scope their
    // changes so the next target cannot cancel a valid request in the same batch.
    intentTarget = key
    const sequence = ++intentSequence
    queueMicrotask(() => {
      if (sequence === intentSequence) intentTarget = undefined
    })
  }

  function handleZoomChange(domain: [number, number]) {
    if (intentTarget) {
      cancel(intentTarget)
      publish()
    } else {
      cancelAll()
      // This event has no target metadata. It must never start an unscoped
      // request in independent mode; pan-end supplies the final target.
      for (const state of states.value.values()) {
        state.request = { ...state.request, start: domain[0], end: domain[1] }
      }
    }
  }

  async function load(payload: WindowPayload) {
    if (disposed) return
    const key = keyFor(payload.seriesIds)
    if (key === 'shared') cancelAll()
    else cancel('shared')
    cancel(key)
    const controller = new AbortController()
    const state: WindowState = {
      request: {
        start: payload.start,
        end: payload.end,
        ...(payload.seriesIds?.length ? { seriesIds: [...payload.seriesIds] } : {}),
      },
      version: (states.value.get(key)?.version ?? 0) + 1,
      controller,
      loading: true,
    }
    const version = state.version
    const record = source.value
    states.value.set(key, state)
    publish()
    const current = () =>
      !disposed &&
      source.value === record &&
      !controller.signal.aborted &&
      states.value.get(key) === state &&
      state.version === version
    try {
      const response = await loadWindow(state.request, controller.signal)
      if (!current()) return
      chartData.value = mergeWaveformWindow(chartData.value, response, state.request.seriesIds)
    } catch (error) {
      if (!current()) return
      state.error = error instanceof Error ? error.message : '数据加载失败'
    } finally {
      if (current()) {
        state.loading = false
        state.controller = undefined
        publish()
      }
    }
  }

  function resetWaveformViewport(payload?: WaveformZoomResetPayload) {
    pendingCommands.clear()
    if (!payload?.seriesIds?.length) {
      cancelAll()
      states.value = new Map()
    }
    options.resetViewport?.(payload?.trackIndex)
    return load({
      start: initialXDomain.value[0],
      end: initialXDomain.value[1],
      seriesIds: payload?.seriesIds,
    })
  }

  function retry() {
    return Promise.all(
      [...states.value.values()].filter((state) => state.error).map((state) => load(state.request)),
    )
  }

  async function handleZoomEnd(payload: WaveformZoomEndPayload) {
    if (!payload.commandId) return load(payload)
    const key = keyFor(payload.seriesIds)
    const pending = {}
    const record = source.value
    pendingCommands.set(key, pending)
    // Collect the synchronous command batch before starting requests. Fit has
    // no intent event, so its unscoped changes would otherwise cancel siblings.
    await Promise.resolve()
    if (disposed || source.value !== record || pendingCommands.get(key) !== pending) return
    pendingCommands.delete(key)
    return load(payload)
  }

  function handlePanEnd(payload: WaveformPanEndPayload) {
    pendingCommands.clear()
    return load(payload)
  }

  watch(source, () => {
    pendingCommands.clear()
    cancelAll()
    states.value = new Map()
    intentTarget = undefined
    chartData.value = selectWaveformWindow(
      source.value,
      { start: recordDomain.value[0], end: recordDomain.value[1] },
      true,
    )
    void resetWaveformViewport()
  })
  onScopeDispose(() => {
    disposed = true
    pendingCommands.clear()
    cancelAll()
  })

  return {
    chartData,
    recordDomain,
    initialXDomain,
    minZoomSpan,
    loading: computed(() => [...states.value.values()].some((state) => state.loading)),
    errors: computed(() =>
      [...states.value.values()].flatMap((state) => (state.error ? [state.error] : [])),
    ),
    handleZoomIntent,
    handleZoomChange,
    handleZoomEnd,
    handlePanEnd,
    resetWaveformViewport,
    retry,
  }
}
