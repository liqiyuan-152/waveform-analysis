import { AnnotationPresentation } from '@/animation/presentation/AnnotationPresentation'
import type { WaveformAnimationController } from '@/animation/WaveformAnimationController'
export type { PresentedAnnotation } from '@/animation/presentation/AnnotationPresentation'

export function createAnnotationPresentation(
  controller: WaveformAnimationController,
  invalidate: () => void,
) {
  return new AnnotationPresentation(controller, invalidate)
}
