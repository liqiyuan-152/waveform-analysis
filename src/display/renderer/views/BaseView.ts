import type { RenderContext } from '../context.js'
import { reconcile } from '../utils/reconcile.js'
import { equalValue } from '../../config/equal.js'

export abstract class BaseView {
  private owned = new Map<Element, Element[]>()
  private previousKey?: unknown

  update(context: RenderContext, key?: unknown) {
    if (key !== undefined && this.previousKey !== undefined && equalValue(key, this.previousKey)) {
      for (const [parent, nodes] of this.owned) nodes.forEach((node) => parent.append(node))
      return
    }
    for (const nodes of this.owned.values()) nodes.forEach((node) => node.remove())
    const parents = [context.svg.node()!, context.plot.node()!]
    const before = new Map(parents.map((parent) => [parent, new Set(parent.children)]))
    this.draw(context)
    for (const parent of parents) {
      const fresh = Array.from(parent.children).filter((node) => !before.get(parent)!.has(node))
      const previous = this.owned.get(parent) ?? []
      const retained = fresh.map((node, index) => {
        const result = previous[index] ? reconcile(previous[index], node) : node
        parent.append(result)
        return result
      })
      previous.slice(fresh.length).forEach((node) => node.remove())
      this.owned.set(parent, retained)
    }
    this.previousKey = key
  }

  protected abstract draw(context: RenderContext): void

  destroy() {
    for (const nodes of this.owned.values()) nodes.forEach((node) => node.remove())
    this.owned.clear()
    this.previousKey = undefined
  }
}
