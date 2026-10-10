import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const typesRoot = resolve('dist/types')
const wasmSourceRoot = resolve('wasm/pkg')
const wasmDestinationRoot = resolve(typesRoot, 'wasm')
const wasmDeclaration = resolve(typesRoot, 'core/wasmSampling.d.ts')
const wasmImport = '../../wasm/pkg/waveform_sampling_wasm'
const packagedWasmImport = '../wasm/waveform_sampling_wasm'

mkdirSync(wasmDestinationRoot, { recursive: true })
for (const fileName of ['waveform_sampling_wasm.d.ts', 'waveform_sampling_wasm_bg.wasm.d.ts']) {
  copyFileSync(resolve(wasmSourceRoot, fileName), resolve(wasmDestinationRoot, fileName))
}

const contents = readFileSync(wasmDeclaration, 'utf8')
if (!contents.includes(wasmImport)) {
  throw new Error(`Expected ${wasmDeclaration} to reference ${wasmImport}.`)
}
writeFileSync(wasmDeclaration, contents.replaceAll(wasmImport, packagedWasmImport))
