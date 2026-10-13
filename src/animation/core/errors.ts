import type { AnimationConfig } from './types'

export function animationError(code: 'animation-terminating' | 'animation-disposed'): Error {
  return Object.assign(new Error(code), { code })
}
export function reportAnimationError(config: AnimationConfig, error: unknown): void {
  try {
    if (config.onError) config.onError(error)
    else console.error(error)
  } catch (reporterError) {
    try {
      console.error(reporterError)
    } catch {
      /* Reporting must never interrupt peers. */
    }
  }
}
export function notify(config: AnimationConfig, callback?: () => void): void {
  try {
    callback?.()
  } catch (error) {
    reportAnimationError(config, error)
  }
}
