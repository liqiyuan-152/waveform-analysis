import { TooltipView } from '@/view/TooltipView'

/** Instrument only while exercising the production hover controller, then restore prototypes. */
export async function measureHover(movingX = false) {
  const overlay = document.querySelector<SVGRectElement>('.waveform-chart__overlay')!
  const box = overlay.getBoundingClientRect()
  const render = TooltipView.prototype.render
  const create = document.createElement
  const measure = Element.prototype.getBoundingClientRect
  let createdNodes = 0
  let measurements = 0
  const durations: number[] = []
  let measured = false
  document.createElement = function (...args: Parameters<typeof create>) {
    if (measured) createdNodes++
    return create.apply(this, args)
  }
  Element.prototype.getBoundingClientRect = function () {
    if (measured && this.classList.contains('waveform-chart__tooltip')) measurements++
    return measure.call(this)
  }
  TooltipView.prototype.render = function (...args) {
    const start = performance.now()
    try {
      return render.apply(this, args)
    } finally {
      if (measured) durations.push(performance.now() - start)
    }
  }
  try {
    for (let i = 0; i < 25; i++) {
      measured = i >= 5
      overlay.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: box.x + box.width * (movingX ? 0.2 + i * 0.01 : 0.5),
          clientY: box.y + box.height * (0.4 + (i % 2) * 0.05),
        }),
      )
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
    if (durations.length !== 20)
      throw new Error(`Expected 20 hover renders, got ${durations.length}`)
    const sorted = [...durations].sort((a, b) => a - b)
    return {
      movingX,
      warmups: 5,
      samples: durations,
      medianMs: sorted[10]!,
      p95Ms: sorted[18]!,
      createdNodes,
      measurements,
    }
  } finally {
    document.createElement = create
    Element.prototype.getBoundingClientRect = measure
    TooltipView.prototype.render = render
  }
}
