import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import { build, createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { packageManagerInvocation } from './package-manager.mjs'

const require = createRequire(import.meta.url)
const pnpm = process.env.npm_execpath
if (!pnpm?.includes('pnpm')) throw new Error('Start development with pnpm dev.')
const children = new Set()
let libraryWatcher
let server
let stopping = false

function child(args, options = {}, command = process.execPath) {
  const processChild = spawn(command, args, {
    stdio: 'inherit',
    windowsHide: true,
    detached: process.platform !== 'win32',
    ...options,
  })
  children.add(processChild)
  processChild.once('exit', () => children.delete(processChild))
  return processChild
}
function completed(processChild) {
  return new Promise((resolve, reject) => {
    processChild.once('error', reject)
    processChild.once('exit', (code) =>
      code === 0 || stopping
        ? resolve()
        : reject(new Error(`Development preparation exited ${code}.`)),
    )
  })
}
async function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  for (const processChild of children) {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(processChild.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      })
    } else {
      try {
        process.kill(-processChild.pid, 'SIGTERM')
      } catch (error) {
        if (error.code !== 'ESRCH') console.error(error)
      }
    }
  }
  await Promise.allSettled([libraryWatcher?.close(), server?.close()])
  process.exitCode = code
}
process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())

try {
  const preparation = packageManagerInvocation(pnpm, ['prepare:demo'])
  await completed(child(preparation.args, {}, preparation.command))
  if (!stopping) {
    const originalNodeEnv = process.env.NODE_ENV
    libraryWatcher = await build({
      configFile: 'vite.lib.config.ts',
      build: { watch: {}, emptyOutDir: false },
    })
    // Vite's build API defaults NODE_ENV to production in this process. Restore it so
    // the subsequent dev server enables Vue HMR and development diagnostics.
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    if (stopping) {
      await libraryWatcher.close()
    } else {
      libraryWatcher.on('event', (event) => {
        if (event.code === 'ERROR') console.error(event.error)
      })
      const declarations = child(
        [
          require.resolve('vue-tsc/bin/vue-tsc.js'),
          '-p',
          'tsconfig.lib.json',
          '--watch',
          '--preserveWatchOutput',
        ],
        { stdio: ['ignore', 'pipe', 'inherit'] },
      )
      declarations.once('error', (error) => {
        console.error(error)
        void shutdown(1)
      })
      let output = ''
      declarations.stdout.on('data', (chunk) => {
        process.stdout.write(chunk)
        output += String(chunk)
        if (!output.includes('Found 0 errors. Watching for file changes.')) return
        output = ''
        const patch = spawnSync(process.execPath, ['scripts/prepare-package-types.mjs'], {
          stdio: 'inherit',
          windowsHide: true,
        })
        if (patch.status !== 0) void shutdown(1)
      })
      declarations.once('exit', (code) => {
        if (!stopping) void shutdown(code || 1)
      })
      const { values } = parseArgs({
        options: {
          host: { type: 'string' },
          port: { type: 'string' },
          strictPort: { type: 'boolean' },
          open: { type: 'boolean' },
          mode: { type: 'string' },
          base: { type: 'string' },
          force: { type: 'boolean' },
        },
      })
      server = await createServer({
        configFile: fileURLToPath(new URL('../demo-app/vite.config.ts', import.meta.url)),
        mode: values.mode,
        base: values.base,
        optimizeDeps: { force: values.force },
        server: {
          host: values.host,
          port: values.port ? Number(values.port) : undefined,
          strictPort: values.strictPort,
          open: values.open,
        },
      })
      if (!stopping) {
        await server.listen()
        server.printUrls()
      } else {
        await server.close()
      }
    }
  }
} catch (error) {
  if (!stopping) console.error(error)
  await shutdown(stopping ? 0 : 1)
}
