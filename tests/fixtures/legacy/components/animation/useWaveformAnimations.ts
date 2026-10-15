import { computed, shallowRef, watch, onScopeDispose } from 'vue'
import { resolveAnimationProps } from './config'
import { useWaveformInstanceId } from '../../utils/waveformId'
import { WaveformPresentation } from '@/animation/presentation/WaveformPresentation'
import {
  animationGridShape,
  animationLayoutSignature,
  wrapAnimationCommands,
  type AnimationContext,
} from './context'

/** Vue owns reactive inputs and browser listeners; shared classes own presentation state. */
export function useWaveformAnimations(context: AnimationContext) {
  const { props, tracks, preparedSeries, sampling } = context
  const config = computed(() => resolveAnimationProps(props))
  const revision = shallowRef(0)
  const invalidate = () => revision.value++
  const prefix = useWaveformInstanceId('waveform-animation')
  const exportSuppressed = shallowRef(false)
  let disposed = false
  const media =
    typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(prefers-reduced-motion: reduce)')
      : undefined
  const reduced = shallowRef(media?.matches ?? false)
  const totalPoints = computed(() =>
    preparedSeries.value.reduce((sum, series) => sum + series.source.length, 0),
  )
  const effective = computed(
    () =>
      config.value.animationEnabled &&
      !reduced.value &&
      !exportSuppressed.value &&
      typeof globalThis.requestAnimationFrame === 'function' &&
      typeof globalThis.cancelAnimationFrame === 'function' &&
      totalPoints.value < config.value.animationThreshold,
  )
  const presentation = new WaveformPresentation(context, config, effective, invalidate, prefix)
  const controller = presentation.controller
  const presentationTracks = computed(() => {
    void revision.value
    return presentation.presentationTracks()
  })
  const presentationAnnotations = computed(() => {
    void revision.value
    return presentation.presentationAnnotations()
  })
  const layoutSignature = computed(() => animationLayoutSignature(context))
  watch(
    [
      () => tracks.value,
      () => props.data,
      () => props.annotations,
      () => props.annotationsVisible,
      config,
      layoutSignature,
      () => sampling.state.value,
      () => context.layoutReady.value,
      () => context.currentPage.value,
      effective,
    ],
    () => presentation.reconcile(),
    { immediate: true },
  )
  watch(
    [() => animationGridShape(context), () => props.data],
    ([shape, data], [previousShape, previousData]) => {
      if (!disposed) presentation.reconcileGrid(shape, data, previousShape, previousData)
    },
    { flush: 'post' },
  )
  watch(
    () => props.annotationsVisible,
    (visible) => {
      if (!visible) presentation.hideAnnotations()
    },
  )
  watch(
    () => config.value.animation.enabled,
    (enabled) => {
      if (!enabled) presentation.disableEnter()
    },
  )
  watch(
    () => config.value.animationUpdate.enabled,
    (enabled) => {
      if (!enabled) presentation.disableUpdate()
    },
  )
  watch(
    () => config.value.animationAnnotation.enabled,
    (enabled) => {
      if (!enabled) presentation.disableAnnotation()
    },
  )
  const reduceChanged = (event: MediaQueryListEvent) => {
    reduced.value = event.matches
    if (event.matches) controller.finishAll()
  }
  const visibilityChanged = () => controller.setPauseReason('document-hidden', document.hidden)
  media?.addEventListener?.('change', reduceChanged)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', visibilityChanged)
    visibilityChanged()
  }
  onScopeDispose(() => {
    disposed = true
    media?.removeEventListener?.('change', reduceChanged)
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', visibilityChanged)
    presentation.dispose()
  })
  function stabilizeAnimations(event?: Event) {
    if (
      presentation.pagination.active() &&
      event?.target instanceof Element &&
      event.target.closest('.waveform-chart__pagination')
    )
      return
    presentation.stabilize()
  }
  return {
    presentationTracks,
    presentationAnnotations,
    stabilizeAnimations,
    wrap: <T extends object>(commands: T) => wrapAnimationCommands(commands, stabilizeAnimations),
    wrapPagination: presentation.pagination.wrapPagination,
    prepareExport: () => {
      exportSuppressed.value = true
      stabilizeAnimations()
    },
    releaseExport: () => {
      exportSuppressed.value = false
    },
  }
}
