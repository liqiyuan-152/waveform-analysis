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
  const bigint = globalThis.BigInt
  try {
    globalThis.BigInt = undefined
    for (const [value, expected] of [
      [9.99999, '10'],
      [-9.99999, '-9.9999'],
      [0.00001, '0.0001'],
      [-0.00001, '0'],
      [1e21, '1000000000000000000000'],
    ]) {
      if (api.formatEndpointTime(value, [value, value], 's') !== expected)
        throw new Error('Packed endpoint formatter requires BigInt or rounds incorrectly')
    }
  } finally {
    globalThis.BigInt = bigint
  }
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
