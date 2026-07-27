import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  collectTextFiles,
  findFileLengthViolations,
  physicalLineCount,
} from './check-file-length.mjs'

const temporaryDirectories: string[] = []

function makeTemporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'waveform-file-length-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    rmSync(directory, { recursive: true, force: true })
  })
})

describe('file length check', () => {
  it('counts physical lines with and without a trailing newline', () => {
    expect(physicalLineCount('')).toBe(0)
    expect(physicalLineCount('first')).toBe(1)
    expect(physicalLineCount('first\nsecond')).toBe(2)
    expect(physicalLineCount('first\nsecond\n')).toBe(2)
  })

  it('checks text files regardless of extension and skips binary files', () => {
    const directory = makeTemporaryDirectory()
    writeFileSync(join(directory, 'source.custom'), 'first\nsecond')
    writeFileSync(join(directory, 'binary.data'), Buffer.from([0, 1, 2, 3]))

    expect(collectTextFiles(directory).map(({ path }) => path)).toEqual([
      join(directory, 'source.custom'),
    ])
  })

  it('reports the file, actual line count, and configured limit', () => {
    const directory = makeTemporaryDirectory()
    writeFileSync(join(directory, 'too-long.unknown'), 'first\nsecond\nthird')

    expect(findFileLengthViolations(directory, 2)).toEqual([
      {
        path: expect.stringContaining('too-long.unknown'),
        lineCount: 3,
        limit: 2,
      },
    ])
  })
})
