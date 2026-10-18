interface D3Node extends Element {
  __data__?: unknown
  __axis?: unknown
  __on?: Array<{
    type: string
    name: string
    value: EventListener
    listener: EventListener
    options?: boolean | AddEventListenerOptions
  }>
}

/** Retains owned SVG nodes while replacing stale attributes, data and listeners. */
export function reconcile(target: Element, source: Element): Element {
  if (target.tagName !== source.tagName) {
    target.replaceWith(source)
    return source
  }
  for (const attribute of Array.from(target.attributes))
    if (!source.hasAttribute(attribute.name)) target.removeAttribute(attribute.name)
  for (const attribute of Array.from(source.attributes))
    if (target.getAttribute(attribute.name) !== attribute.value)
      target.setAttribute(attribute.name, attribute.value)
  const old = target as D3Node,
    next = source as D3Node
  old.__data__ = next.__data__
  old.__axis = next.__axis
  for (const event of old.__on ?? [])
    target.removeEventListener(event.type, event.listener, event.options)
  old.__on = next.__on
  for (const event of next.__on ?? [])
    target.addEventListener(event.type, event.listener, event.options)
  const children = Array.from(target.childNodes)
  const fresh = Array.from(source.childNodes)
  fresh.forEach((child, index) => {
    const existing = children[index]
    if (existing?.nodeType === 1 && child.nodeType === 1)
      reconcile(existing as Element, child as Element)
    else if (existing?.nodeType === 3 && child.nodeType === 3) {
      if (existing.textContent !== child.textContent) existing.textContent = child.textContent
    } else if (existing) existing.replaceWith(child)
    else target.append(child)
  })
  children.slice(fresh.length).forEach((child) => child.remove())
  source.remove()
  return target
}
