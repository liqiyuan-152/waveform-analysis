import { expect, it, vi } from 'vitest'
import { ViewportRestorer } from '@/interaction/ViewportRestorer'
import { ChartModel } from '@/model/ChartModel'

it('clears old viewport state without evaluating new geometry when no window was captured', () => {
  const model = new ChartModel()
  model.viewport.set('old', { xDomain: [1, 2], yDomains: {} })
  const calculate = vi.fn(() => {
    throw new Error('No captured window needs a layout')
  })
  const invalidate = vi.fn()
  const restorer = new ViewportRestorer(model, calculate, invalidate)
  restorer.restore([], model.options.value)
  expect(model.viewport.get('old')).toBeUndefined()
  expect(invalidate).toHaveBeenCalledOnce()
  expect(calculate).not.toHaveBeenCalled()
  model.data.dispose()
})
