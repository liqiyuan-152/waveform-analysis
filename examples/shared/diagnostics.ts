import { getInstanceByDom, type WaveformChartInstance } from 'waveform-analysis/native'

/** Browser verification observes real instances; no diagnostic state belongs to the chart. */
export class ExampleDiagnostics {
  private creates = 0
  private disposals = 0
  private frames = 0
  private callbackVersion = 0
  private readonly hosts = new Map<WaveformChartInstance, HTMLElement>()

  mounted(host: HTMLElement) {
    this.creates++
    const chart = getInstanceByDom(host)
    if (!chart) throw new Error('Example did not register its chart')
    this.hosts.set(chart, host)
  }

  unmounted(instance: WaveformChartInstance) {
    if (!instance.isDisposed()) throw new Error('Example did not dispose its chart')
    this.disposals++
    this.hosts.delete(instance)
  }

  rendered(callbackVersion: number) {
    this.frames++
    this.callbackVersion = callbackVersion
  }

  snapshot() {
    const alive = [...this.hosts.values()].filter((host) => getInstanceByDom(host) !== undefined)
    return {
      creates: this.creates,
      disposals: this.disposals,
      frames: this.frames,
      callbackVersion: this.callbackVersion,
      registered: new Set(alive).size,
      roots: document.querySelectorAll('.waveform-native-chart').length,
      charts: alive.map((host) => getInstanceByDom(host)!.getControlState()),
      domain: alive.at(-1)
        ? getInstanceByDom(alive.at(-1)!)?.getControlState().targets[0]?.viewport.xDomain
        : undefined,
    }
  }
}

declare global {
  interface Window {
    nativeExample: ExampleDiagnostics
  }
}

export const diagnostics = new ExampleDiagnostics()
window.nativeExample = diagnostics
