import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import mongoose from 'mongoose'
import '../loadEnv.js'
import { configureMongoDns } from '../src/utils/mongoDns.js'
import { isFreshCompleteInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { buildScraperAttemptDiagnostics } from '../scraper-support/runner.js'
import { saveToDB } from '../scraper-support/utils/saveToDB.js'
import { upsertScraperStatus } from '../scraper-support/utils/scraperPersistence.js'
import { collectPublishingGapSnapshot } from './collectPublishingGapSnapshot.js'
import { refreshJobDatasetSummary } from '../src/services/jobDatasetSummaryService.js'
import { extractionDetailHealth } from '../scraper-support/utils/extractionDetailHealth.js'

export const isSuccessfulPublishingGapTrial = (trial, { source, now = new Date() } = {}) => {
  if (typeof source !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(source)
    || trial?.source !== source || !Array.isArray(trial.jobs) || !trial.jobs.length
    || trial.jobs.some(job => !job || typeof job !== 'object' || Array.isArray(job)
      || (job.source != null && job.source !== source) || job.sourceListingComplete === false)
    || !extractionDetailHealth(trial.jobs).complete
    || !isFreshCompleteInventoryEvidence(trial.inventoryEvidence, { now })
    || trial.inventoryEvidence.status !== 'complete-inventory'
    || trial.result?.success === false || trial.result?.softFailure === true) return false
  const nativeExtraction = trial.outcome === 'complete-positive-extraction'
    && ['browser-captured-live-http-replay', 'isolated-direct-live-extraction-no-database',
      'captured-live-public-http-extraction-no-database'].includes(trial.mode)
    && trial.productionWrites === false
  return trial.result?.success === true || nativeExtraction
}

export const planPublishingGapRollout = ({ trials, validation, expectedSources = 50 }) => {
  if (!Number.isInteger(expectedSources) || expectedSources < 1) throw new Error('Positive expected source count required')
  if (!Array.isArray(trials) || trials.length !== expectedSources || new Set(trials.map(t => t.source)).size !== expectedSources) throw new Error(`Rollout requires ${expectedSources} distinct trial sources`)
  if (validation?.environment !== 'temporary-local-mongodb' || validation.passedSources !== expectedSources) throw new Error('Successful local persistence validation required')
  for (const trial of trials) {
    const row = validation.rows?.find(item => item.source === trial.source)
    if (!row || row.outcome !== 'passed' || row.visibleJobs < 1 || !row.idempotent) throw new Error(`Missing passing local validation for ${trial.source}`)
    if (row.trialHash !== createHash('sha256').update(JSON.stringify(trial)).digest('hex')) throw new Error(`Trial changed after local validation: ${trial.source}`)
  }
  const sources = trials.map(trial => trial.source)
  return { sourceCount: expectedSources, batches: Array.from({ length: Math.ceil(expectedSources / 10) }, (_, i) => sources.slice(i * 10, (i + 1) * 10)) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] }
  const directory = path.resolve(option('--trials') || '../artifacts/publishing-gap/live-trials')
  const validation = JSON.parse(fs.readFileSync(path.resolve(option('--validation') || '../artifacts/publishing-gap/persistence-validation.json'), 'utf8'))
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'))
  const trials = manifest.sources.map(item => {
    const file = path.resolve(directory, item.file || `${item.source}.json`)
    const relative = path.relative(directory, file)
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Trial path escapes its directory')
    const trial = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!isSuccessfulPublishingGapTrial(trial, { source: item.source })) throw new Error(`Fresh successful extraction required for ${item.source}`)
    return trial
  })
  const plan = planPublishingGapRollout({ trials, validation,
    ...(option('--expected-sources') ? { expectedSources: Number(option('--expected-sources')) } : {}),
  })
  if (!args.includes('--apply')) {
    console.log(JSON.stringify({ mode: 'plan-only', ...plan }, null, 2))
  } else {
    const extension = JSON.parse(fs.readFileSync(option('--provider-manifest')
      ? path.resolve(option('--provider-manifest')) : new URL('../scraper-support/providers/providerExtensions/zzz-publishing-gap-repairs.json', import.meta.url)))
    if (trials.some(trial => !extension.some(provider => provider.source === trial.source && provider.bindingEvidence?.verified === true))) throw new Error('Official identity verification required for every selected source')
    if (!process.env.MONGO_URI) throw new Error('Database configuration is unavailable')
    const destination = path.resolve(option('--output') || '../artifacts/publishing-gap/rollout.json')
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    const progress = { startedAt: new Date().toISOString(), mode: 'targeted-live-upsert', batchSize: 10, phase: 'connecting', rows: [], batches: [], completed: false }
    const writeProgress = () => fs.writeFileSync(destination, `${JSON.stringify(progress, null, 2)}\n`)
    try {
      configureMongoDns()
      await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 })
      progress.phase = 'reading-before-snapshot'
      const before = await collectPublishingGapSnapshot()
      if (!before.databaseAvailable) throw new Error('Current inventory could not be read')
      progress.phase = 'checking-administrator-settings'
      if (before.statuses.some(status => status.isActive === false && trials.some(trial => trial.source === status.source))) throw new Error('An administrator has disabled a selected source')
      progress.beforeCompanies = before.publicCompanyNames.length
      fs.writeFileSync(path.join(path.dirname(destination), 'before-rollout-runtime.json'), `${JSON.stringify(before, null, 2)}\n`)
      writeProgress()
      for (const batch of plan.batches) {
        for (const source of batch) {
          const trial = trials.find(item => item.source === source)
          progress.phase = 'upserting-source'
          progress.currentSource = source
          writeProgress()
          // Targeted upserts cannot remove existing jobs or dispatch alerts.
          const result = await saveToDB(trial.jobs, source, { enrichPublicExperience: false, enqueueAlerts: false,
            descriptionRewriteMode: 'off', replaceExisting: false, refreshDatasetSummary: false })
          const analysis = buildScraperAttemptDiagnostics(trial.jobs)
          const sourceResult = { success: true, ...result, ...analysis,
            inventoryEvidence: trial.inventoryEvidence, attemptedAt: trial.attemptedAt, completedAt: new Date().toISOString() }
          await upsertScraperStatus(source, sourceResult)
          progress.rows.push({ source, inserted: result.inserted, updated: result.updated, eligibleJobs: analysis.eligibleJobs })
          writeProgress()
        }
        progress.phase = 'verifying-batch-visibility'
        const snapshot = await collectPublishingGapSnapshot()
        if (!snapshot.databaseAvailable) throw new Error('Post-batch visibility could not be verified')
        const outcomes = batch.map(source => ({ source, visibleJobs: snapshot.inventory.find(row => row.source === source)?.visibleJobs || 0 }))
        progress.batches.push({ completedAt: new Date().toISOString(), outcomes, publicCompanies: snapshot.publicCompanyNames.length })
        writeProgress()
        if (outcomes.some(row => row.visibleJobs < 1)) throw new Error('A selected source failed public visibility verification')
        console.log(JSON.stringify({ batch: progress.batches.length, passedSources: outcomes.length, publicCompanies: snapshot.publicCompanyNames.length }))
      }
      progress.phase = 'refreshing-public-summary'
      await refreshJobDatasetSummary()
      progress.phase = 'reading-final-snapshot'
      const after = await collectPublishingGapSnapshot()
      if (!after.databaseAvailable) throw new Error('Final public inventory unavailable')
      progress.afterCompanies = after.publicCompanyNames.length
      progress.companiesChange = progress.afterCompanies - progress.beforeCompanies
      progress.completed = true
      progress.phase = 'complete'
      fs.writeFileSync(path.join(path.dirname(destination), 'after-rollout-runtime.json'), `${JSON.stringify(after, null, 2)}\n`)
    } catch (error) {
      progress.error = error?.code ? `Rollout stopped: ${error.code}` : 'Rollout stopped; inspect completed batch outcomes before retrying'
      process.exitCode = 1
    } finally {
      progress.completedAt = new Date().toISOString()
      writeProgress()
      await mongoose.disconnect()
    }
    console.log(JSON.stringify({ completed: progress.completed, sourcesApplied: progress.rows.length,
      beforeCompanies: progress.beforeCompanies, afterCompanies: progress.afterCompanies, companiesChange: progress.companiesChange }))
  }
}
