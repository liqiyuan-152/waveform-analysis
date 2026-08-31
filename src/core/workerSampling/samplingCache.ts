import type { WorkerSamplingOutput } from './protocol'

export interface SamplingCacheMetrics {
  entries: number
  bytes: number
  maxEntries: number
  maxBytes: number
}

interface CacheEntry {
  output: WorkerSamplingOutput
  bytes: number
}

export interface SamplingOutputCacheOptions {
  maxEntries?: number
  maxBytes?: number
}

const DEFAULT_MAX_ENTRIES = 96
const DEFAULT_MAX_BYTES = 16 * 1024 * 1024

function outputBytes(output: WorkerSamplingOutput) {
  return output.kind === 'source-indexes'
    ? output.sourceIndexes.byteLength
    : output.x.byteLength + output.y.byteLength
}

/** A bounded LRU for immutable Worker sampling outputs. */
export class SamplingOutputCache {
  private readonly entries = new Map<string, CacheEntry>()
  private bytes = 0
  private readonly maxEntries: number
  private readonly maxBytes: number

  constructor(options: SamplingOutputCacheOptions = {}) {
    this.maxEntries = Number.isFinite(options.maxEntries)
      ? Math.max(0, Math.floor(options.maxEntries ?? 0))
      : DEFAULT_MAX_ENTRIES
    this.maxBytes = Number.isFinite(options.maxBytes)
      ? Math.max(0, Math.floor(options.maxBytes ?? 0))
      : DEFAULT_MAX_BYTES
  }

  get metrics(): SamplingCacheMetrics {
    return {
      entries: this.entries.size,
      bytes: this.bytes,
      maxEntries: this.maxEntries,
      maxBytes: this.maxBytes,
    }
  }

  get(key: string) {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.output
  }

  set(key: string, output: WorkerSamplingOutput) {
    const bytes = outputBytes(output)
    if (bytes > this.maxBytes || this.maxEntries === 0) return
    const existing = this.entries.get(key)
    if (existing) {
      this.bytes -= existing.bytes
      this.entries.delete(key)
    }
    this.entries.set(key, { output, bytes })
    this.bytes += bytes
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldest = this.entries.entries().next().value
      if (!oldest) break
      const [oldestKey, oldestEntry] = oldest
      this.entries.delete(oldestKey)
      this.bytes -= oldestEntry.bytes
    }
  }

  deleteDataset(datasetId: string) {
    const prefix = `${datasetId}\u0000`
    for (const [key, entry] of this.entries) {
      if (!key.startsWith(prefix)) continue
      this.entries.delete(key)
      this.bytes -= entry.bytes
    }
  }

  clear() {
    this.entries.clear()
    this.bytes = 0
  }
}
