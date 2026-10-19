export interface ReleaseManifest {
  schemaVersion: number
  sha: string
  version: string
  demoBasePath: string
  files: Record<string, string>
}
export function releaseManifest(directory: string, sha: string, version: string): ReleaseManifest
export function verifyReleaseArtifacts(
  directory: string,
  sha: string,
  version: string,
): ReleaseManifest
