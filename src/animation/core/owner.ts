import type { AnimationObjectKey } from '../types'

/** Each controller owns one closure; external IDs are never shared scheduler keys. */
export function createAnimationOwner(): (key: AnimationObjectKey) => string {
  const owner = ++nextOwner
  return (key) => JSON.stringify([owner, key.kind, key.id, key.scope])
}

let nextOwner = 0
