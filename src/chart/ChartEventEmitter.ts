import type { WaveformChartEventHandler, WaveformChartEvents } from '../types/native'
import { WaveformChartError } from './WaveformChartError'
import { reportChartError } from './reportChartError'

interface Subscription {
  invoke: (args: unknown[]) => void
}

export class ChartEventEmitter {
  private readonly listeners = new Map<keyof WaveformChartEvents, Map<unknown, Subscription>>()
  private disposed = false

  constructor(private readonly report: (error: unknown) => void = reportChartError) {}

  on<K extends keyof WaveformChartEvents>(event: K, handler: WaveformChartEventHandler<K>) {
    if (this.disposed)
      throw new WaveformChartError('instance-disposed', 'Cannot subscribe to a disposed chart')
    let listeners = this.listeners.get(event)
    if (!listeners) this.listeners.set(event, (listeners = new Map()))
    let subscription = listeners.get(handler)
    if (!subscription) {
      subscription = { invoke: (args) => handler(...(args as WaveformChartEvents[K])) }
      listeners.set(handler, subscription)
    }
    const registered = subscription
    return () => {
      // An old cancellation handle cannot remove a later re-registration of the same callback.
      if (listeners.get(handler) === registered) listeners.delete(handler)
    }
  }

  off<K extends keyof WaveformChartEvents>(event: K, handler?: WaveformChartEventHandler<K>) {
    if (handler) this.listeners.get(event)?.delete(handler)
    else this.listeners.get(event)?.clear()
  }

  emit<K extends keyof WaveformChartEvents>(event: K, ...args: WaveformChartEvents[K]) {
    if (this.disposed) return
    const snapshot = Array.from(this.listeners.get(event)?.values() ?? [])
    const errors: unknown[] = []
    for (const subscription of snapshot) {
      if (this.disposed) break
      try {
        subscription.invoke(args)
      } catch (error) {
        errors.push(error)
      }
    }
    for (const error of errors) this.report(error)
  }

  dispose() {
    this.disposed = true
    this.listeners.clear()
  }
}
