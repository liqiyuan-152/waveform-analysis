import type { AnimationConfig, AnimationState } from './types'
import { validateAnimationConfig } from './validation'
import { PropertyGroups } from './propertyGroups'
import { AnimationTask } from './task'

/** Standalone manual timeline; use Animator for concurrent writers and additive groups. */
export class Animation {
  readonly #task: AnimationTask
  constructor(config: AnimationConfig) {
    const groups = new PropertyGroups()
    const validated = validateAnimationConfig(config)
    validated.tracks = groups.capture(validated)
    this.#task = new AnimationTask(validated, groups)
    groups.bind(this.#task)
  }
  get state(): AnimationState {
    return this.#task.state
  }
  start(time: number): void {
    this.#task.start(time)
  }
  tick(time: number): boolean {
    return this.#task.tick(time)
  }
  pause(time: number): void {
    this.#task.pause(time)
  }
  resume(time: number): void {
    this.#task.resume(time)
  }
  abort(): void {
    this.#task.abort()
  }
  finish(): void {
    this.#task.finish()
  }
}
