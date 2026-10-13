import { build, createServer, preview } from 'vite'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const buildMode =
  process.env.ANIMATION_BENCHMARK_BUILD === 'development' ? 'development' : 'production'
const port = Number(process.env.ANIMATION_NATIVE_PORT ?? 5180)

const evidence = new URL(
  process.env.ANIMATION_NATIVE_EVIDENCE_FILE ??
    '../openspec/changes/add-animation-system/evidence/native-browser-results.json',
  import.meta.url,
)
function installEvidence(server) {
  server.middlewares.use('/animation-native-evidence', async (request, response) => {
    if (request.method !== 'POST') {
      response.statusCode = 405
      response.end()
      return
    }
    let body = ''
    for await (const chunk of request) body += chunk
    const record = { ...JSON.parse(body), timestamp: new Date().toISOString(), buildMode }
    const previous = await readFile(evidence, 'utf8')
      .then(JSON.parse)
      .catch(() => [])
    await writeFile(evidence, JSON.stringify([...previous, record], null, 2))
    response.end('saved')
  })
}
if (buildMode === 'development') {
  const server = await createServer({
    server: { port, strictPort: true, hmr: false },
    plugins: [{ name: 'native-animation-evidence', configureServer: installEvidence }],
  })
  await server.listen()
} else {
  const outDir = await mkdtemp(join(tmpdir(), 'waveform-animation-native-'))
  await build({
    build: {
      outDir,
      rolldownOptions: {
        input: {
          demo: resolve('index.html'),
          native: resolve('tests/browser/animation-native.html'),
        },
      },
    },
  })
  await preview({
    build: { outDir },
    preview: { port, strictPort: true },
    plugins: [{ name: 'native-animation-evidence', configurePreviewServer: installEvidence }],
  })
}
console.log(
  `Native browser fixture (${buildMode}): http://localhost:${port}/tests/browser/animation-native.html`,
)
