import type { AnimationHandle, AnimationState } from './types'

export type AnimationCommand = 'pause' | 'resume' | 'abort' | 'finish'

/** Terminal handles keep only identity/state, never their task, clock or owner. */
export function createAnimationHandle(
  id: string,
  read: () => AnimationState,
  command: (method: AnimationCommand) => void,
): { handle: AnimationHandle; release: () => void } {
  let access: { read: () => AnimationState; command: typeof command } | undefined = {
    read,
    command,
  }
  let terminalState: AnimationState = 'PENDING'
  const invoke = (method: AnimationCommand) => access?.command(method)
  return {
    handle: {
      id,
      get state() {
        return access?.read() ?? terminalState
      },
      pause: () => invoke('pause'),
      resume: () => invoke('resume'),
      abort: () => invoke('abort'),
      finish: () => invoke('finish'),
    },
    release: () => {
      if (!access) return
      terminalState = access.read()
      access = undefined
    },
  }
}
