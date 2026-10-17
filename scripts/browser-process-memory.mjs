import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout } from 'node:timers/promises'
const execute = promisify(execFile)

/** Observed RSS of this Chromium's processes; shared pages can be counted more than once. */
export async function monitorBrowserRss(browser) {
  const client = await browser.newBrowserCDPSession()
  const samples = []
  let stopped = false
  let failure
  const capture = async () => {
    const { processInfo } = await client.send('SystemInfo.getProcessInfo')
    const ids = processInfo.map((process) => String(process.id))
    if (!ids.length) throw new Error('Chromium process list unavailable')
    const { stdout } = await execute('ps', ['-o', 'pid=,rss=', '-p', ids.join(',')])
    const rows = stdout
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/).map(Number))
    const rssBytes = rows.reduce((sum, [, rss]) => sum + rss * 1024, 0)
    if (!Number.isFinite(rssBytes) || rssBytes <= 0) throw new Error('RSS sample unavailable')
    samples.push({
      timestamp: Date.now(),
      rssBytes,
      processCount: rows.length,
      expectedProcesses: ids.length,
    })
  }
  await capture()
  const loop = (async () => {
    while (!stopped) {
      await setTimeout(50)
      if (!stopped) await capture()
    }
  })().catch((error) => {
    failure = error
  })
  return async () => {
    stopped = true
    await loop
    try {
      if (failure) throw failure
      await capture()
      return { samples, observedPeakBytes: Math.max(...samples.map((sample) => sample.rssBytes)) }
    } finally {
      await client.detach()
    }
  }
}
