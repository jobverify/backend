import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { postScrapeInput, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'
import { readTrialCorpusJobs } from './trialCorpusArchive.js'
import { trialNativeInputHash, trialNativeRuntimeHash } from './trialNativePredictionCache.js'

export async function refreshTrialClassificationPolicy(directory, { ids = null } = {}) {
  const runtime = trialNativeRuntimeHash()
  const summary = { examined: 0, refreshed: 0, current: 0, missing: 0, staleNative: 0, skipped: 0, startedAt: new Date() }
  for await (const job of readTrialCorpusJobs(directory)) {
    if (ids && !ids.has(job.trialId)) continue
    summary.examined++
    const input = postScrapeInput(job)
    if (input.incomplete) { summary.skipped++; continue }
    const file = path.join(directory, 'classifications', `${job.trialId}.json`)
    let stored
    try { stored = JSON.parse(fs.readFileSync(file)) } catch { summary.missing++; continue }
    if (stored.nativeInputHash !== trialNativeInputHash(input, runtime)) { summary.staleNative++; continue }
    if (stored.inputHash === input.inputHash) { summary.current++; continue }
    const classification = resolvePostScrapeClassification(job, stored.prediction, { mode: 'policy' })
    const temporary = `${file}.refresh.tmp`
    fs.writeFileSync(temporary, JSON.stringify({ ...stored, inputHash: input.inputHash, classification }, null, 2))
    fs.renameSync(temporary, file)
    summary.refreshed++
  }
  return { ...summary, completedAt: new Date() }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = path.resolve(process.argv[2] || '')
  if (!process.argv[2]) throw new Error('Usage: node scripts/refreshTrialClassificationPolicy.js RUN_DIRECTORY [REVIEW_PACKET]')
  const packet = process.argv[3] && JSON.parse(fs.readFileSync(process.argv[3]))
  const ids = packet ? new Set(packet.jobs.map(job => job.trialId || job.id)) : null
  const pipeline = JSON.parse(fs.readFileSync(path.join(directory, 'trial-pipeline.json')))
  if (!ids && ['scraping', 'classification'].includes(pipeline.stage)) {
    throw new Error('Wait for the native pass to finish before refreshing the full corpus')
  }
  const summary = await refreshTrialClassificationPolicy(directory, { ids })
  console.log(JSON.stringify(summary))
}
