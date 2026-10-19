interface Identity {
  repository: string
  sha: string
  branch: string
}
interface Run {
  id: number
  event: string
  head_sha: string
  head_branch: string
  head_repository: { full_name: string }
  path: string
  status: string
  conclusion: string
}
interface Artifact {
  name: string
  expired: boolean
  workflow_run: { head_sha: string }
}
export function trustedRun(run: Run, identity: Identity): boolean
export function findVerifiedRelease(
  options: Identity & {
    api: (path: string) => Promise<{ workflow_runs?: Run[]; artifacts?: Artifact[] }>
    maxWaitMs?: number
    intervalMs?: number
    now?: () => number
    delay?: (ms: number) => Promise<void>
  },
): Promise<string>
