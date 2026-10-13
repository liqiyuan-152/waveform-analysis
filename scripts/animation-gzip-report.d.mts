export interface GzipRecord {
  file: string
  beforeBytes: number
  afterBytes: number
  deltaBytes: number
}
export function collectGzipSizes(directory: string, prefix?: string): Map<string, number>
export function compareGzipSizes(
  before: Map<string, number>,
  after: Map<string, number>,
): { results: GzipRecord[]; additionalFiles: GzipRecord[]; totals: GzipRecord[] }
