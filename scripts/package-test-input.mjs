import { readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

// Explicit tarballs must never silently fall back to building a different package.
export function packageTestInput(args, temporaryRoot, runPnpm) {
  const { values } = parseArgs({ args, options: { tarball: { type: 'string' } } })
  if (values.tarball !== undefined) {
    const path = resolve(values.tarball)
    if (!path.endsWith('.tgz') || !statSync(path).isFile()) {
      throw new Error('--tarball must reference an existing .tgz file.')
    }
    return path
  }
  runPnpm(['pack', '--pack-destination', temporaryRoot])
  const files = readdirSync(temporaryRoot).filter((name) => name.endsWith('.tgz'))
  if (files.length !== 1) throw new Error('pnpm pack must create exactly one package tarball.')
  return resolve(temporaryRoot, files[0])
}
