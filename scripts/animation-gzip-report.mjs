import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

/** Read the complete build output, including nested chunks and non-JavaScript assets. */
export function collectGzipSizes(directory, prefix = '') {
  const sizes = new Map()
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      for (const [file, bytes] of collectGzipSizes(path, `${relative}/`)) sizes.set(file, bytes)
    } else if (entry.isFile()) sizes.set(relative, gzipSync(readFileSync(path)).length)
    else throw new Error(`Unexpected build output entry: ${relative}`)
  }
  return sizes
}

/** A union prevents deleted/renamed baseline assets or new current chunks being omitted. */
export function compareGzipSizes(before, after) {
  const files = [...new Set([...before.keys(), ...after.keys()])].sort()
  const records = files.map((file) => {
    const beforeBytes = before.get(file) ?? 0
    const afterBytes = after.get(file) ?? 0
    return { file, beforeBytes, afterBytes, deltaBytes: afterBytes - beforeBytes }
  })
  for (const file of ['index.js', 'index.cjs', 'style.css'])
    if (!before.has(file) || !after.has(file)) throw new Error(`Missing build entry: ${file}`)
  const results = records.filter(({ file }) =>
    ['index.js', 'index.cjs', 'style.css'].includes(file),
  )
  const additionalFiles = records.filter((record) => !results.includes(record))
  // Conservatively count every additional output for either entry format. Shared assets count
  // once per independently consumed format; no chunk is excluded based on its name or extension.
  const totals = ['index.js', 'index.cjs'].map((file) => {
    const inputs = records.filter((record) => record.file === file || record.file === 'style.css')
    const all = [...inputs, ...additionalFiles]
    const beforeBytes = all.reduce((sum, record) => sum + record.beforeBytes, 0)
    const afterBytes = all.reduce((sum, record) => sum + record.afterBytes, 0)
    return { file, beforeBytes, afterBytes, deltaBytes: afterBytes - beforeBytes }
  })
  return { results, additionalFiles, totals }
}
