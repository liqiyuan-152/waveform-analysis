export interface TextFile {
  path: string
  contents: string
}

export interface FileLengthViolation {
  path: string
  lineCount: number
  limit: number
}

export const maximumLines: number

export function physicalLineCount(contents: string): number
export function isTextFile(contents: Buffer): boolean
export function collectTextFiles(directory: string): TextFile[]
export function findFileLengthViolations(sourceRoot: string, limit?: number): FileLengthViolation[]
