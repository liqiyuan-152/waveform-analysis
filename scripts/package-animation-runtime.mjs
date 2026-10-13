export function verifyAnimationExports(api) {
  for (const name of [
    'Animation',
    'Animator',
    'WaveformAnimationController',
    'createLineDrawingAnimation',
    'createStaggeredLineDrawingAnimations',
    'createPathTransitionAnimation',
    'createYAxisScaleAnimation',
    'createAnnotationAppearAnimation',
    'createAnnotationDisappearAnimation',
  ])
    if (typeof api[name] !== 'function') throw new Error(`Missing root export ${name}`)
  let writes = 0
  const binding = { read: () => ({ x: 0, width: 0 }), write: () => writes++ }
  const config = api.createLineDrawingAnimation(binding, 10, { duration: 0 })
  if (writes !== 0) throw new Error('Factory is impure')
  const animator = new api.Animator()
  const handle = animator.animate(config)
  if (handle.state !== 'FINISHED' || writes !== 1) throw new Error('SSR terminal state failed')
  if (api.globalAnimator.getAnimationCount() !== 0) throw new Error('Import is not idle')
  const controller = new api.WaveformAnimationController({ animator, commitFinalState: () => {} })
  controller.destroy()
  animator.destroy()
}
