import { flushAnimationFrames, pendingAnimationFrameCount } from './setup'

/** Drain deterministic frames plus local sampling Promise continuations (not Worker responses). */
export async function flushNativeUpdates() {
  for (let turn = 0; turn < 12; turn++) {
    flushAnimationFrames()
    await Promise.resolve()
  }
  if (pendingAnimationFrameCount()) throw new Error('Native updates did not settle')
}
