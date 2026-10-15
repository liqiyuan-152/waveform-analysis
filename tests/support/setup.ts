import { afterEach, beforeEach, vi } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'
import { globalAnimator } from '@/animation/core/Animator'

// Native adapters own instance animators; unmount Vue fixtures to release their resources too.
enableAutoUnmount(afterEach)

interface ResizeObserverEntryMock {
  target: Element
  contentRect: DOMRectReadOnly
}

type ResizeCallback = (entries: ResizeObserverEntryMock[]) => void

export const resizeObservers: ResizeObserverMock[] = []
const animationFrameCallbacks = new Map<number, FrameRequestCallback>()
let animationFrameId = 0

export class ResizeObserverMock {
  private target?: Element
  readonly targets = new Set<Element>()
  private measured?: { width: number; height: number }

  constructor(private readonly callback: ResizeCallback) {
    resizeObservers.push(this)
  }

  observe = vi.fn((target: Element) => {
    this.target = target
    this.targets.add(target)
  })

  unobserve: () => void = vi.fn()
  disconnect: () => void = vi.fn()

  resize(width: number, height = 400) {
    if (!this.target) return
    // The native observer reads its host instead of trusting an entry for another observed node.
    // Model the notified dimensions in jsdom, which has no layout engine.
    if (
      !this.measured &&
      this.target.getBoundingClientRect === Element.prototype.getBoundingClientRect
    ) {
      const measured = { width, height }
      this.measured = measured
      Object.defineProperty(this.target, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          ...measured,
          left: 0,
          top: 0,
          right: measured.width,
          bottom: measured.height,
          x: 0,
          y: 0,
          toJSON() {},
        }),
      })
    }
    if (this.measured) Object.assign(this.measured, { width, height })
    if (this.target.getClientRects === Element.prototype.getClientRects) {
      const target = this.target
      Object.defineProperty(target, 'getClientRects', {
        configurable: true,
        value: () => [target.getBoundingClientRect()],
      })
    }
    this.callback([
      {
        target: this.target,
        contentRect: { width, height } as DOMRectReadOnly,
      },
    ])
  }
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)
vi.stubGlobal(
  'requestAnimationFrame',
  vi.fn((callback: FrameRequestCallback) => {
    animationFrameId += 1
    animationFrameCallbacks.set(animationFrameId, callback)
    return animationFrameId
  }),
)
vi.stubGlobal(
  'cancelAnimationFrame',
  vi.fn((id: number) => {
    animationFrameCallbacks.delete(id)
  }),
)
vi.stubGlobal(
  'matchMedia',
  vi.fn((query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
)

beforeEach(() => {
  resizeObservers.length = 0
  animationFrameCallbacks.clear()
  animationFrameId = 0
})

export function flushAnimationFrames(timestamp = 0) {
  const callbacks = Array.from(animationFrameCallbacks.values())
  animationFrameCallbacks.clear()
  callbacks.forEach((callback) => callback(timestamp))
}

export function pendingAnimationFrameCount(): number {
  return animationFrameCallbacks.size
}

// Default-on chart animations must not leak shared work between test cases.
afterEach(() => globalAnimator.destroy())

// jsdom does not implement native dialog's top layer. Browser tests exercise real modality.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open')
}

export function resizeChart(width: number, height = 400) {
  const observer = [...resizeObservers]
    .reverse()
    .find((observer) =>
      [...observer.targets].some((target) => target.classList.contains('waveform-chart-host')),
    )
  if (!observer) throw new Error('Chart host observer not found')
  observer.resize(width, height)
}
