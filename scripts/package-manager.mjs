import { extname } from 'node:path'

// npm_execpath can point to either pnpm's JS entry or its standalone executable.
export function packageManagerInvocation(entry, args) {
  return ['.js', '.cjs', '.mjs'].includes(extname(entry).toLowerCase())
    ? { command: process.execPath, args: [entry, ...args] }
    : { command: entry, args }
}
