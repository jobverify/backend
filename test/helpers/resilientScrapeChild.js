import assert from 'node:assert/strict'
import fs from 'node:fs'
import { openRunCheckpoint } from '../../scraper-support/utils/runCheckpoint.js'

const attemptFile = process.env.RESILIENT_FIXTURE_ATTEMPT_FILE
assert.ok(attemptFile, 'The supervisor fixture requires an attempt counter file')
assert.ok(process.env.SCRAPER_CHECKPOINT_FILE, 'The supervisor must provide its checkpoint file')
const previousAttempt = fs.existsSync(attemptFile) ? Number(fs.readFileSync(attemptFile, 'utf8')) : 0
assert.ok(Number.isSafeInteger(previousAttempt) && previousAttempt >= 0)
const attempt = previousAttempt + 1
fs.writeFileSync(attemptFile, String(attempt))

const sources = ['fixture-first', 'fixture-second']
const checkpoint = openRunCheckpoint({
  filePath: process.env.SCRAPER_CHECKPOINT_FILE,
  sources,
  mode: process.argv.includes('--dry-run') ? 'dry-run' : 'live',
  parallel: process.argv.includes('--parallel'),
  runId: process.env.SCRAPER_RUN_ID,
})
const pending = checkpoint.pendingSources()
if (attempt > 1) assert.deepEqual(pending, [sources[1]], 'Restart must retain the completed source')

for (const source of pending) {
  checkpoint.markSourceStarted(source)
  // Simulate an unexpected process exit after the first source has committed.
  if (attempt === 1 && source === sources[1]) {
    process.exitCode = 1
    break
  }
  checkpoint.markSourceCompleted(source, { success: true, jobs: 1, processingComplete: true })
}
if (!process.exitCode) checkpoint.finish()
