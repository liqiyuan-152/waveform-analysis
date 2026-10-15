export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

export function svgNode<K extends keyof SVGElementTagNameMap>(
  document: Document,
  tag: K,
  attributes: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NAMESPACE, tag)
  setSvgAttributes(node, attributes)
  return node
}

export function setSvgAttributes(
  node: Element,
  attributes: Record<string, string | number | null | undefined>,
) {
  for (const [name, value] of Object.entries(attributes)) {
    const next = value === undefined || value === null ? null : String(value)
    if (node.getAttribute(name) === next) continue
    if (next === null) node.removeAttribute(name)
    else node.setAttribute(name, next)
  }
}

/** Keep stable nodes attached; move only children whose paint order actually changed. */
export function orderSvgChildren(parent: Element, children: readonly Element[]) {
  for (let index = 0; index < children.length; index++) {
    const child = children[index]!
    const current = parent.children.item(index)
    if (current !== child) parent.insertBefore(child, current)
  }
}
