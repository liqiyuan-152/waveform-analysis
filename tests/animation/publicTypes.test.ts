import { expect, expectTypeOf, it } from 'vitest'
import type {
  AnimationValue,
  AnimationDirection,
  AnimationState,
  AnimationFrame,
  AnimationTrack,
  AnimationConfig,
  AnimationHandle,
  AnimationScheduler,
  Animator,
  EasingFunction,
  EasingFamily,
  EasingType,
  LineDrawingDirection,
  AnnotationAnimationType,
  LineDrawingOptions,
  StaggeredLineDrawingOptions,
  DataUpdateOptions,
  AnnotationAnimationOptions,
  WaveformEnterAnimationOptions,
  WaveformUpdateAnimationOptions,
  WaveformAnnotationAnimationOptions,
  WaveformAnimationProps,
  ClipAnimationState,
  AnimationBinding,
  NumericGeometry,
  GeometryTransitionInput,
  GeometryTransitionFrame,
  AnnotationAnimationState,
  AnimationScope,
  AnimationObjectKey,
  WaveformAnimationControllerOptions,
} from '@/index'

it('makes ENG-09 and API-05 foundation types consumable from the root', () => {
  expectTypeOf<AnimationValue>().toEqualTypeOf<number | number[] | number[][]>()
  expectTypeOf<AnimationDirection>().toEqualTypeOf<
    'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
  >()
  expectTypeOf<AnimationState>().toEqualTypeOf<
    'PENDING' | 'RUNNING' | 'PAUSED' | 'FINISHED' | 'ABORTED'
  >()
  expectTypeOf<EasingType>().toEqualTypeOf<'linear' | `${EasingFamily}${'In' | 'Out' | 'InOut'}`>()
  expectTypeOf<EasingFunction>().toEqualTypeOf<(progress: number) => number>()
  expectTypeOf<AnimationHandle['state']>().toEqualTypeOf<AnimationState>()
  expectTypeOf<AnimationHandle['finish']>().toEqualTypeOf<() => void>()
  expectTypeOf<Animator['animate']>().toEqualTypeOf<
    (config: AnimationConfig, id?: string) => AnimationHandle
  >()
  expectTypeOf<AnimationScheduler['setTimer']>().returns.toEqualTypeOf<unknown>()
  const frame: AnimationFrame = {
    rawProgress: 0.5,
    directedProgress: 0.5,
    iteration: 0,
    terminal: false,
  }
  const track: AnimationTrack = { target: { x: [0, 1] }, property: 'x', to: [1, 2] }
  const config: AnimationConfig = {
    tracks: [track],
    during: (_, current) => {
      expectTypeOf(current).toEqualTypeOf<AnimationFrame>()
    },
  }
  const direction: LineDrawingDirection = 'center-out'
  const type: AnnotationAnimationType = 'bounce'
  const line: LineDrawingOptions = { direction }
  const staggered: StaggeredLineDrawingOptions = { ...line, staggerDelay: 100 }
  const update: DataUpdateOptions = { duration: 300 }
  const annotation: AnnotationAnimationOptions = { ...update, type }
  const enterOptions: WaveformEnterAnimationOptions = { ...staggered, enabled: true }
  const updateOptions: WaveformUpdateAnimationOptions = { ...update, enabled: false }
  const annotationOptions: WaveformAnnotationAnimationOptions = { ...annotation, enabled: true }
  const props: WaveformAnimationProps = {
    animationEnabled: true,
    animation: enterOptions,
    animationUpdate: updateOptions,
    animationAnnotation: annotationOptions,
    animationThreshold: 50000,
  }
  const clip: ClipAnimationState = { x: 0, width: 10 }
  const binding: AnimationBinding<ClipAnimationState> = { read: () => clip, write: () => {} }
  const geometry: NumericGeometry = {
    points: [
      [0, 1],
      [1, 2],
    ],
  }
  const input: GeometryTransitionInput = { from: geometry, to: geometry, compatible: true }
  const settled: GeometryTransitionFrame = { kind: 'settled', values: input.to }
  const state: AnnotationAnimationState = { opacity: 1, scale: 1, offsetY: 0 }
  const scope: AnimationScope = 'domain'
  const key: AnimationObjectKey = { kind: 'axis', id: 'track:y', scope }
  const options: WaveformAnimationControllerOptions = { commitFinalState: () => {} }
  expect([frame, config, props, binding, settled, state, key, options]).toHaveLength(8)
})

it('requires terminal and settled discrimination and readonly handle identity', () => {
  // @ts-expect-error terminal is mandatory, not a future optional field
  const missingTerminal: AnimationFrame = { rawProgress: 0, directedProgress: 0, iteration: 0 }
  // @ts-expect-error SVG strings are not numeric geometry
  const path: NumericGeometry = { line: 'M0,0L1,1' }
  const readSettled = (frame: GeometryTransitionFrame) => {
    if (frame.kind === 'settled') {
      // @ts-expect-error settled must release old geometry
      const old = frame.from
      return old
    }
  }
  const checkHandle = (handle: AnimationHandle) => {
    // @ts-expect-error identity belongs to the scheduler
    handle.id = 'other'
    // @ts-expect-error state belongs to the runtime
    handle.state = 'FINISHED'
  }
  expect([missingTerminal, path, readSettled, checkHandle]).toHaveLength(4)
})
