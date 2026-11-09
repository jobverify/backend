import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { postScrapeInput, resolvePostScrapeClassification, GLICLASS_IDENTITY } from '../src/services/postScrapeClassification.js'
import { startGliclassWorker } from './gliclassWorker.js'
import { buildReviewPacket } from './classificationReviewPacket.js'
import { compactTrialJob, writeTrialCorpus, readPrioritizedTrialCorpusJobs } from './trialCorpusArchive.js'
import { writeTrialPrediction } from './writeTrialPrediction.js'

function requireCompleteCapture(directory) {
  const state = JSON.parse(fs.readFileSync(path.join(directory, 'run-state.json')))
  if (state.completedCount !== state.totalSources || state.status !== 'complete') {
    throw new Error('Scraping must finish before trial classification starts')
  }
  return state
}

export function trialCorpus(directory) {
  const state = requireCompleteCapture(directory)
  const jobs = new Map()
  for (const source of state.catalogSources) {
    const file = path.join(directory, 'snapshots', `${source}.json`)
    if (!fs.existsSync(file)) continue
    for (const job of JSON.parse(fs.readFileSync(file))) {
      const employerId = job.requisitionId || job.jobId
      const sourceInput = !job.fingerprint && !employerId ? postScrapeInput(job) : null
      const descriptionIdentity = sourceInput ? createHash('sha256').update(JSON.stringify([
        sourceInput.body, sourceInput.sourceEmploymentType,
      ])).digest('hex') : null
      const key = createHash('sha256').update(JSON.stringify([source,
        job.fingerprint || [employerId || descriptionIdentity,
          job.originalTitle || job.title, job.locations?.length ? job.locations : job.location,
          job.sourceUrl || job.applyUrl || null]])).digest('hex')
      jobs.set(key, compactTrialJob({ ...job, source, trialId: key }))
    }
  }
  return [...jobs.values()]
}

export async function classifyTrialSnapshots(directory, { workerFactory = startGliclassWorker, useFrozenCorpus = false,
  diskWaitMs = Number(process.env.TRIAL_DISK_WAIT_MS || 0),
  minimumFreeBytes = Number(process.env.TRIAL_DISK_MIN_FREE_BYTES || 0),
} = {}) {
  const stopFile = path.join(directory,'resource-stop.json')
  if (fs.existsSync(stopFile)) {
    throw new Error('Stopped at the local resource limit; resume approval is required before clearing resource-stop.json.')
  }
  requireCompleteCapture(directory)
  const outputDir = path.join(directory, 'classifications')
  let jobs, total
  if (useFrozenCorpus) {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'corpus-manifest.json')))
    if (!Number.isSafeInteger(manifest.jobCount) || manifest.jobCount < 0) throw new Error('Invalid frozen corpus record count')
    const digest = createHash('sha256')
    for await (const chunk of fs.createReadStream(path.join(directory, 'corpus.jsonl'))) digest.update(chunk)
    if (digest.digest('hex') !== manifest.sha256) throw new Error('Frozen corpus checksum changed')
    total = manifest.jobCount
  } else {
    jobs = trialCorpus(directory)
    total = jobs.length
    // Freeze the complete source corpus before loading the model.
    writeTrialCorpus(directory, jobs, GLICLASS_IDENTITY)
  }
  const reviewFile = path.join(directory, 'review-source-packet.json')
  if (!fs.existsSync(reviewFile)) {
    if (useFrozenCorpus) throw new Error('Frozen review packet is missing')
    fs.writeFileSync(reviewFile, JSON.stringify(buildReviewPacket(jobs, { seed: path.basename(directory) }), null, 2))
  }
  const reviewIds = JSON.parse(fs.readFileSync(reviewFile)).jobs.map(job => job.trialId || job.id)
  if (jobs) jobs.length = 0
  fs.mkdirSync(outputDir, { recursive: true })
  const nativeRuntime = createHash('sha256').update([
    '../classification/gliclass/worker.py', '../classification/gliclass/runtime.py', '../classification/gliclass/model.json',
    '../classification/gliclass/requirements.txt', './gliclassWorker.js',
  ].map(file => fs.readFileSync(new URL(file, import.meta.url)).toString().replace(/\r\n/g, '\n')).join('\n')).digest('hex')
  const worker = await workerFactory({ logFile: path.join(directory, 'classifier.log') })
  const summary = { total, completed: 0, cached: 0, nativeCached: 0, skipped: 0, failed: 0, writeRetries: 0, diskWaitMilliseconds: 0, categories: {}, modelCategories: {}, startedAt: new Date(), seconds: 0, peakRssBytes: 0 }
  const started = Date.now()
  const writeOptions = { stopFile, diskWaitMs, minimumFreeBytes,
    onDiskWait: ms => { summary.diskWaitMilliseconds += ms } }
  const writeSummary = () => writeTrialPrediction(path.join(directory, 'classification-summary.json'),
    { ...summary, elapsedSeconds: (Date.now()-started)/1000 }, writeOptions)
  try {
    for await (const job of readPrioritizedTrialCorpusJobs(directory, reviewIds)) {
      if (fs.existsSync(stopFile)) { summary.stoppedForResourceLimit = true; break }
      const input = postScrapeInput(job), file = path.join(outputDir, `${job.trialId}.json`)
      const nativeInputHash = createHash('sha256').update(JSON.stringify([input.title, input.body,
        input.sourceEmploymentType, GLICLASS_IDENTITY.modelRevision, 'utf8-transport-v1',
        nativeRuntime])).digest('hex')
      if (input.incomplete) { summary.skipped++; continue }
      let stored
      try { stored = JSON.parse(fs.readFileSync(file)) } catch {}
      if (stored?.inputHash === input.inputHash) summary.cached++
      else {
        let prediction
        try {
          if (stored?.nativeInputHash === nativeInputHash) {
            prediction = stored.prediction
            summary.nativeCached++
          } else prediction = await worker.classify(input)
        } catch (error) {
          summary.failed++
          fs.appendFileSync(path.join(directory, 'classification-failures.jsonl'), `${JSON.stringify({
            trialId: job.trialId, source: job.source, title: job.title, error: error.message, attemptedAt: new Date(),
          })}\n`)
          console.error(`Classification failed for ${job.trialId}: ${error.message}`)
          continue
        }
        const classification = resolvePostScrapeClassification(job, prediction, { mode: 'policy' })
        stored = { trialId: job.trialId, inputHash: input.inputHash, nativeInputHash, source: job.source, title: job.title, prediction, classification }
        summary.writeRetries += await writeTrialPrediction(file, stored, writeOptions)
      }
      summary.completed++
      summary.categories[stored.classification.resolved.jobType] = (summary.categories[stored.classification.resolved.jobType] || 0)+1
      summary.modelCategories[stored.prediction.modelLabel] = (summary.modelCategories[stored.prediction.modelLabel] || 0)+1
      summary.seconds += stored.prediction.seconds
      summary.peakRssBytes = Math.max(summary.peakRssBytes, stored.prediction.peakRssBytes)
      await writeSummary()
      if (summary.completed % 100 === 0) console.log(JSON.stringify({ completed: summary.completed, total, elapsedSeconds: (Date.now()-started)/1000 }))
    }
  } finally { await worker.stop() }
  summary.completedAt = new Date()
  await writeSummary()
  console.log(JSON.stringify(summary))
  if (summary.failed) process.exitCode = 1
  return summary
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/classifyTrialSnapshots.js RUN_DIRECTORY')
  await classifyTrialSnapshots(path.resolve(process.argv[2]))
}
