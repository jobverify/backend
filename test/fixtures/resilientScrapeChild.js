import fs from 'node:fs'
import path from 'node:path'

const attemptFile = process.env.RESILIENT_FIXTURE_ATTEMPT_FILE
const checkpointFile = process.env.SCRAPER_CHECKPOINT_FILE
const previousAttempts = fs.existsSync(attemptFile)
  ? Number.parseInt(fs.readFileSync(attemptFile, 'utf8'), 10)
  : 0
const attempt = previousAttempts + 1
fs.writeFileSync(attemptFile, String(attempt))

const completedCount = attempt === 1 ? 1 : 2
fs.mkdirSync(path.dirname(checkpointFile), { recursive: true })
fs.writeFileSync(checkpointFile, JSON.stringify({
  status: completedCount === 2 ? 'complete' : 'running',
  restartable: true,
  completedCount,
  totalSources: 2,
}))

process.stdout.write(`fixture attempt ${attempt}\n`)
process.exitCode = attempt === 1 ? 1 : 0
