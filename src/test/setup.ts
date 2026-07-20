import { beforeEach, vi } from 'vitest'

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

  constructor(private readonly callback: ResizeCallback) {
    resizeObservers.push(this)
  }

  observe = vi.fn((target: Element) => {
    this.target = target
  })

  unobserve = vi.fn()
  disconnect = vi.fn()

  resize(width: number, height = 400) {
    if (!this.target) return
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
