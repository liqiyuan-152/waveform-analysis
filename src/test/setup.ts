import { beforeEach, vi } from 'vitest'

interface ResizeObserverEntryMock {
  target: Element
  contentRect: DOMRectReadOnly
}

type ResizeCallback = (entries: ResizeObserverEntryMock[]) => void

export const resizeObservers: ResizeObserverMock[] = []

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
})
