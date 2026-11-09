import fs from 'node:fs'
import path from 'node:path'
import { captureTrial } from './trialPostScrapeClassification.js'
import { writeTrialPrediction } from './writeTrialPrediction.js'

const directory = path.resolve(process.argv[2] || '')
if (!process.argv[2]) throw new Error('Usage: node scripts/runPostScrapeTrial.js RUN_DIRECTORY [COUNT|all] [CONCURRENCY]')
const count = process.argv[3] === 'all' ? 'all' : Number(process.argv[3] || 100)
const concurrency = Number(process.argv[4] || 10)
const classificationOnly = process.argv.slice(5).includes('--classify-only')
if (fs.existsSync(path.join(directory,'resource-stop.json'))) {
  throw new Error('Stopped at the local resource limit; resume approval is required before clearing resource-stop.json.')
}
fs.mkdirSync(directory, { recursive: true })
const startedAt = new Date().toISOString()
const stateFile = path.join(directory, 'trial-pipeline.json')
async function record(stage, details = {}) {
  await writeTrialPrediction(stateFile, { stage, pid: process.pid, startedAt,
    updatedAt: new Date(), count, concurrency, ...details }, {
    stopFile: path.join(directory, 'resource-stop.json'),
    diskWaitMs: Number(process.env.TRIAL_DISK_WAIT_MS || 0),
    minimumFreeBytes: Number(process.env.TRIAL_DISK_MIN_FREE_BYTES || 0),
  })
  console.log(JSON.stringify({ stage, ...details }))
}
try {
  if (!classificationOnly) {
    await record('scraping')
    await captureTrial({ directory, count, concurrency })
  }
  const state = JSON.parse(fs.readFileSync(path.join(directory, 'run-state.json')))
  if (state.status !== 'complete' || state.completedCount !== state.totalSources) {
    throw new Error('Scraping is incomplete; classification has not started. Rerun this command to resume.')
  }
  await record('classification', { sourcesCompleted: state.completedCount, scrapingCompletedAt: state.finishedAt, classificationOnly })
  const { classifyTrialSnapshots } = await import('./classifyTrialSnapshots.js')
  const classification = await classifyTrialSnapshots(directory, { useFrozenCorpus: classificationOnly })
  await record(classification.stoppedForResourceLimit ? 'stopped_resource_limit'
    : classification.failed ? 'classification_failed' : 'awaiting_manual_review', { classification })
  if (classification.failed) process.exitCode = 1
} catch (error) {
  await record('failed', { error: error.message })
  console.error(error)
  process.exitCode = 1
}
