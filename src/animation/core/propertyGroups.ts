import type { AnimationTrack, AnimationValue } from './types'
import type { ValidatedAnimationConfig, AnimationTrackContext } from './validation'
import { copyAnimationValue } from './validation'
import { addValues, subtractValues, mapValue, interpolateValue, directedProgress } from './values'

export interface PropertyTask {
  config: ValidatedAnimationConfig
  fail(error: unknown): void
}
interface Entry {
  task: PropertyTask
  from: AnimationValue
  to: AnimationValue
  value: AnimationValue
  committed: AnimationValue
}
interface Group {
  target: Record<string, AnimationValue>
  property: string
  base: AnimationValue
  offset: AnimationValue
  ordinary?: Entry
  additive: Set<Entry>
}

/** Object identity, never user series IDs, determines numeric property ownership. */
export class PropertyGroups {
  #groups = new Map<object, Map<string, Group>>()
  #entries = new Map<PropertyTask, [Group, Entry][]>()

  #get(track: AnimationTrack): Group | undefined {
    return this.#groups.get(track.target)?.get(track.property)
  }
  #end(entry: Entry): AnimationValue {
    const { direction, loop } = entry.task.config
    return directedProgress(1, loop === Infinity ? 0 : loop - 1, direction) === 1
      ? entry.to
      : entry.from
  }
  context = (track: AnimationTrack): AnimationTrackContext | undefined => {
    const group = this.#get(track)
    if (!group) return undefined
    let from = addValues(group.ordinary ? this.#end(group.ordinary) : group.base, group.offset)
    for (const entry of group.additive)
      from = addValues(from, subtractValues(this.#end(entry), entry.from))
    return { additiveFrom: from, baseLoop: group.ordinary?.task.config.loop ?? 1 }
  }
  conflicts(config: ValidatedAnimationConfig): Set<PropertyTask> {
    const tasks = new Set<PropertyTask>()
    if (!config.additive)
      for (const track of config.tracks) {
        const group = this.#get(track)
        if (group?.ordinary) tasks.add(group.ordinary.task)
        group?.additive.forEach((entry) => tasks.add(entry.task))
      }
    return tasks
  }
  capture(config: ValidatedAnimationConfig): AnimationTrack[] {
    return config.tracks.map((track) => ({
      ...track,
      from: copyAnimationValue(
        config.additive
          ? (this.context(track)?.additiveFrom ?? track.target[track.property])
          : this.#get(track)
            ? track.target[track.property]
            : (track.from ?? track.target[track.property]),
      ),
    }))
  }
  bind(task: PropertyTask): void {
    const entries: [Group, Entry][] = []
    for (const track of task.config.tracks) {
      let group = this.#get(track)
      if (!group) {
        const base = copyAnimationValue(track.target[track.property])
        group = {
          target: track.target,
          property: track.property,
          base,
          offset: mapValue(base, () => 0),
          additive: new Set(),
        }
        const properties = this.#groups.get(track.target) ?? new Map<string, Group>()
        properties.set(track.property, group)
        this.#groups.set(track.target, properties)
      }
      const from = copyAnimationValue(track.from!)
      const entry = {
        task,
        from,
        to: track.to,
        value: task.config.additive ? mapValue(from, () => 0) : from,
        committed: task.config.additive ? mapValue(from, () => 0) : group.base,
      }
      if (task.config.additive) group.additive.add(entry)
      else group.ordinary = entry
      entries.push([group, entry])
    }
    this.#entries.set(task, entries)
  }
  setProgress(task: PropertyTask, progress: number): void {
    for (const [, entry] of this.#entries.get(task) ?? []) {
      const value = interpolateValue(entry.from, entry.to, progress)
      entry.value = copyAnimationValue(
        task.config.additive ? subtractValues(value, entry.from) : value,
      )
    }
  }
  flush(): void {
    for (const properties of this.#groups.values())
      for (const group of properties.values()) {
        try {
          let value = addValues(group.ordinary?.value ?? group.base, group.offset)
          for (const entry of group.additive) value = addValues(value, entry.value)
          group.target[group.property] = copyAnimationValue(value)
          // Private values are replaced, never mutated or exposed through the target snapshot.
          if (group.ordinary) group.ordinary.committed = group.ordinary.value
          for (const entry of group.additive) entry.committed = entry.value
        } catch (error) {
          const tasks = new Set([
            ...(group.ordinary ? [group.ordinary.task] : []),
            ...[...group.additive].map((entry) => entry.task),
          ])
          for (const task of tasks) task.fail(error)
        }
      }
  }
  detach(task: PropertyTask): void {
    for (const [group, entry] of this.#entries.get(task) ?? []) {
      if (group.ordinary === entry) {
        group.base = entry.committed
        group.ordinary = undefined
      }
      if (group.additive.delete(entry)) group.offset = addValues(group.offset, entry.committed)
      if (!group.ordinary && !group.additive.size) {
        // The last flush already contains committed contributions. Release the whole group.
        this.#groups.get(group.target)?.delete(group.property)
        if (!this.#groups.get(group.target)?.size) this.#groups.delete(group.target)
      }
    }
    this.#entries.delete(task)
  }
}
