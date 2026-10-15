import type { TrackLayout } from '../core/types'
import { updateSvgAttribute } from './updateAxis'

interface LabelBox {
  left: number
  right: number
}

function measureLabel(text: SVGTextElement, position: number, anchor: string): LabelBox {
  try {
    const box = text.getBBox?.()
    if (box && box.width > 0 && Number.isFinite(box.x) && Number.isFinite(box.width)) {
      return { left: position + box.x, right: position + box.x + box.width }
    }
  } catch {
    // Detached SVGs and jsdom may not implement geometry measurement.
  }
  const fontSize =
    Number.parseFloat(text.style.fontSize || text.getAttribute('font-size') || '') || 10
  const width = (text.textContent?.length ?? 0) * fontSize * 0.7
  const x = Number(text.getAttribute('x')) || 0
  const left = position + x - (anchor === 'end' ? width : anchor === 'middle' ? width / 2 : 0)
  return { left, right: left + width }
}

/** Label-only pass. Never feeds visibility back into tick or grid generation. */
export function updateXAxisTickVisibility(
  axis: SVGGElement,
  endpoints: SVGGElement,
  track: TrackLayout,
  width: number,
): void {
  const endpointTexts = [...endpoints.querySelectorAll<SVGTextElement>('text')]
  const ticks = [...axis.querySelectorAll<SVGGElement>('.tick')]
  const tickTexts = ticks
    .flatMap((tick) => {
      const text = tick.querySelector<SVGTextElement>('text')
      const value = (tick as SVGGElement & { __data__: number }).__data__
      // D3 adds a device-pixel alignment offset to the scale position.
      const transformX = tick.transform?.baseVal.consolidate()?.matrix.e
      return text ? [{ text, position: transformX ?? track.xScale(value), value }] : []
    })
    .sort((a, b) => a.position - b.position)
  const texts = [...endpointTexts, ...tickTexts.map(({ text }) => text)]
  // Restore before measuring, including after a narrow container becomes wider.
  texts.forEach((text) => updateSvgAttribute(text, 'display', null))
  const occupied: LabelBox[] = []
  const place = (text: SVGTextElement, position: number, anchor: string, duplicate = false) => {
    const box = measureLabel(text, position, anchor)
    const hidden =
      duplicate ||
      box.left < -0.5 ||
      box.right > width + 0.5 ||
      occupied.some((other) => box.left < other.right + 4 && other.left < box.right + 4)
    updateSvgAttribute(text, 'display', hidden ? 'none' : null)
    if (!hidden) occupied.push(box)
  }
  endpointTexts.forEach((text) => place(text, 0, text.getAttribute('text-anchor') ?? 'start'))
  const domain = track.xScale.domain()
  tickTexts.forEach(({ text, position, value }) => {
    place(text, position, 'middle', value === domain[0] || value === domain[1])
  })
}
