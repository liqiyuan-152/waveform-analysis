import type { WaveformAction } from '../types/actions.js'
import type { WaveformModel } from '../model/WaveformModel.js'
import { resolveSeriesAction } from '../interaction/actions/ToggleSeriesAction.js'

export class ActionDispatcher {
  private dispatching = false
  constructor(
    private readonly model: WaveformModel,
    private readonly toggle: (key: string) => void,
  ) {}

  dispatch(action: WaveformAction) {
    if (!action || action.type !== 'toggleSeries' || typeof action.seriesId !== 'string')
      throw new Error('Invalid Waveform action')
    this.dispatchKey(resolveSeriesAction(this.model, action.seriesId))
  }

  dispatchKey(key: string) {
    if (this.dispatching) throw new Error('Synchronous action reentry is not allowed')
    this.dispatching = true
    try {
      this.toggle(key)
    } finally {
      this.dispatching = false
    }
  }
}
