import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipView } from '@/view/TooltipView'
import type { WaveformHoverState } from '@/components/core/types'
import { resizeObservers } from '../support/setup'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn())
  vi.restoreAllMocks()
})
function state(ids = ['a', 'b']): WaveformHoverState {
  return {
    points: ids.map((id) => ({ id, name: id, color: 'red', trackIndex: 0, point: { x: 1, y: 2 } })),
    trackIndex: 0,
    queryX: 1,
    crosshairXByTrack: { 0: 1 },
    position: { x: 50, y: 100 },
  }
}
function setup(owner = document) {
  const root = owner.createElement('div')
  owner.body.append(root)
  const view = new TooltipView(root)
  cleanup.push(() => {
    view.dispose()
    root.remove()
  })
  return { root, view }
}

describe('persistent tooltip', () => {
  it('reuses rows and measured size when only the pointer moves', () => {
    const { root, view } = setup()
    const value = state()
    view.render(value, 's', 800, 400)
    const element = root.querySelector<HTMLElement>('[role=tooltip]')!
    const rows = [...element.children]
    const measure = vi.spyOn(element, 'getBoundingClientRect')
    view.render({ ...value, position: { x: 150, y: 200 } }, 's', 800, 400)
    expect([...element.children]).toEqual(rows)
    expect(measure).not.toHaveBeenCalled()
    expect(element.style.top).toBe('182px')
  })

  it('updates text, units, missing values, colors and order without interpreting labels', () => {
    const { root, view } = setup()
    view.render(state(), 's', 800, 400)
    const element = root.querySelector<HTMLElement>('[role=tooltip]')!
    const [a, b] = [...element.children]
    const measure = vi.spyOn(element, 'getBoundingClientRect')
    const value = state(['b', 'a', 'c'])
    Object.assign(value.points[0]!, {
      name: '<img src=x>',
      shotNo: 'shot',
      unit: 'V',
      color: 'blue',
      point: null,
    })
    view.render(value, 'ms', 800, 400)
    expect(element.children[0]).toBe(b)
    expect(element.children[1]).toBe(a)
    expect(element.textContent).toContain('<img src=x>(V)')
    expect(element.querySelector('img')).toBeNull()
    expect(element.children[0]!.textContent).toContain('无数据')
    expect(element.children[0]!.querySelector('i')!.style.backgroundColor).toBe('blue')
    expect(element.children[1]!.textContent).toContain('1,000')
    expect(measure).toHaveBeenCalledTimes(1)
    view.render(state(['a']), 's', 800, 400)
    expect(element.children).toHaveLength(1)
    expect(element.children[0]).toBe(a)
  })

  it('keeps all oversized rows and clamps to the existing top margin after resize', () => {
    const { root, view } = setup()
    const value = state(Array.from({ length: 30 }, (_, i) => `long label ${i}`))
    view.render(value, 's', 800, 400)
    const element = root.querySelector<HTMLElement>('[role=tooltip]')!
    const measure = vi
      .spyOn(element, 'getBoundingClientRect')
      .mockReturnValue({ width: 300, height: 900 } as DOMRect)
    view.render(value, 's', 360, 200)
    expect(element.style.top).toBe('8px')
    expect(element.children).toHaveLength(30)
    expect(element.style.maxHeight).toBe('')
    expect(element.style.overflow).toBe('')
    const observer = resizeObservers.find((observer) => observer.targets.has(element))!
    observer.resize(300, 900)
    expect(measure).toHaveBeenCalledTimes(2)
  })

  it('releases hidden/disposed observers and isolates owner documents and instances', () => {
    const iframe = document.createElement('iframe')
    document.body.append(iframe)
    cleanup.push(() => iframe.remove())
    const first = setup()
    const second = setup(iframe.contentDocument!)
    first.view.render(state(), 's', 800, 400)
    second.view.render(state(), 's', 800, 400)
    const element = first.root.querySelector('[role=tooltip]')!
    const observer = resizeObservers.find((observer) => observer.targets.has(element))!
    first.view.render(undefined, 's', 800, 400)
    expect(observer.disconnect).toHaveBeenCalled()
    expect(first.root.children).toHaveLength(0)
    expect(second.root.firstElementChild!.ownerDocument).toBe(iframe.contentDocument)
    first.view.render(state(), 's', 800, 400)
    first.view.dispose()
    observer.resize(20, 20)
    first.view.render(state(), 's', 800, 400)
    expect(first.root.children).toHaveLength(0)
    expect(second.root.querySelectorAll('.waveform-tooltip__series')).toHaveLength(2)
  })
})
