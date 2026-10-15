import { copyFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

// Root and Vue entries use the same framework-independent stylesheet. Keep the native path
// as an identical compatibility asset rather than compiling a second stylesheet/runtime entry.
await mkdir(resolve('dist/native'), { recursive: true })
await copyFile(resolve('dist/style.css'), resolve('dist/native/style.css'))
