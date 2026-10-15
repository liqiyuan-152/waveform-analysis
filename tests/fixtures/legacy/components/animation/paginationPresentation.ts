import type { ComputedRef } from 'vue'
import type { AnimationContext } from './context'
import type { ResolvedAnimationProps } from './config'
import type { WaveformAnimationController } from '@/animation/WaveformAnimationController'
import { PaginationPresentation } from '@/animation/presentation/PaginationPresentation'

/** Vue inputs bridge to the shared replay owner without duplicating its state machine. */
export function createPaginationPresentation(
  context: AnimationContext,
  controller: WaveformAnimationController,
  config: ComputedRef<ResolvedAnimationProps>,
  effective: ComputedRef<boolean>,
  prepare: () => void,
) {
  return new PaginationPresentation(context, controller, config, effective, prepare)
}
