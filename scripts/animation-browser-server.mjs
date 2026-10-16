import { build, createServer, preview } from 'vite'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/** Measure shipped Vue code by default; retain a development mode for comparable diagnostics. */
export async function animationBrowserServer(port) {
  if (process.env.ANIMATION_BENCHMARK_BUILD === 'development') {
    const server = await createServer({ server: { port, strictPort: true, hmr: false } })
    await server.listen()
    return { buildMode: 'development', close: () => server.close() }
  }
  const outDir = await mkdtemp(join(tmpdir(), 'waveform-animation-browser-'))
  await build({
    build: {
      outDir,
      rolldownOptions: {
        input: {
          demo: resolve('demo-app/index.html'),
          benchmark: resolve('tests/browser/animation.html'),
        },
      },
    },
  })
  const server = await preview({ build: { outDir }, preview: { port, strictPort: true } })
  return {
    buildMode: 'production',
    close: () =>
      new Promise((resolve, reject) =>
        server.httpServer.close((error) => (error ? reject(error) : resolve())),
      ),
  }
}
