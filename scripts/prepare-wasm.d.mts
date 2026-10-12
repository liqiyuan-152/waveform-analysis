import { execFileSync } from 'node:child_process'
export function prepareWasm(options?: {
  root?: string
  force?: boolean
  run?: typeof execFileSync
}): { built: boolean }
