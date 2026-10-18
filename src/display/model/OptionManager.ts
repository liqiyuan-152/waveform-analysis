import { mergeOptions } from '../config/merge.js'
import { resolveOptions } from '../config/resolve.js'
import { snapshot } from '../config/snapshot.js'
import { resolveAnimation } from '../config/animation.js'
import type { WaveformOptions } from '../types/options.js'

/** Owns explicit overrides separately from derived defaults. */
export class OptionManager {
  private options: WaveformOptions
  private effective: ReturnType<typeof resolveOptions>

  constructor(options: WaveformOptions = {}) {
    this.options = snapshot(options)
    this.effective = resolveOptions(this.options)
  }

  get raw() {
    return this.options
  }
  get resolved() {
    return this.effective
  }

  update(patch: WaveformOptions) {
    resolveAnimation(patch)
    const next = snapshot(mergeOptions(this.options, patch))
    const effective = resolveOptions(next)
    this.options = next
    this.effective = effective
  }

  getOptions(): WaveformOptions {
    return snapshot(this.effective)
  }
}
