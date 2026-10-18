import { Waveform, type WaveformOptions } from 'waveform-analysis/display'

/** Mount into an existing element; call destroy when the host is unmounted. */
export function mountDisplay(container: HTMLElement, options: WaveformOptions = {}) {
  return new Waveform(
    container,
    Array.from({ length: 200 }, (_, i) => ({ x: i / 100, y: Math.sin(i / 12) })),
    {
      width: '100%',
      height: 320,
      animationEnabled: true,
      padding: { right: 24 },
      ...options,
    },
  )
}
