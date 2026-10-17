/* global document, Element, PointerEvent, requestAnimationFrame */

/** Demo pages expose no fixture internals; measure input-to-frame latency and DOM costs directly. */
export async function measureDemoHover(page) {
  return page.evaluate(async () => {
    const overlay = [...document.querySelectorAll('.waveform-chart__overlay')].find(
      (node) => node.getBoundingClientRect().width > 0,
    )
    if (!overlay) throw new Error('Demo has no visible hover surface')
    const box = overlay.getBoundingClientRect()
    const create = document.createElement
    const measure = Element.prototype.getBoundingClientRect
    const samples = []
    let createdNodes = 0
    let measurements = 0
    let recording = false
    document.createElement = function (...args) {
      if (recording) createdNodes++
      return create.apply(this, args)
    }
    Element.prototype.getBoundingClientRect = function () {
      if (recording && this.classList.contains('waveform-chart__tooltip')) measurements++
      return measure.call(this)
    }
    try {
      for (let i = 0; i < 25; i++) {
        recording = i >= 5
        const started = performance.now()
        overlay.dispatchEvent(
          new PointerEvent('pointermove', {
            bubbles: true,
            clientX: box.x + box.width * (0.25 + i * 0.01),
            clientY: box.y + box.height * 0.5,
          }),
        )
        await new Promise((resolve) => requestAnimationFrame(resolve))
        if (recording) samples.push(performance.now() - started)
      }
      const tooltip = document.querySelector('[role=tooltip]')
      if (!tooltip?.textContent) throw new Error('Demo hover did not display point content')
      const sorted = [...samples].sort((a, b) => a - b)
      return {
        metric: 'input-to-next-frame latency, includes browser frame scheduling',
        warmups: 5,
        samples,
        medianMs: sorted[10],
        p95Ms: sorted[18],
        createdNodes,
        measurements,
        text: tooltip.textContent,
      }
    } finally {
      document.createElement = create
      Element.prototype.getBoundingClientRect = measure
    }
  })
}
