import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Job from '../src/models/Job.js'
import { saveToDB } from '../scraper-support/utils/saveToDB.js'
import { analyzePublishableJobs } from '../scraper-support/utils/publishableJobMetrics.js'
import { isFreshCompleteInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { extractionDetailHealth } from '../scraper-support/utils/extractionDetailHealth.js'
import { buildMissingSourceDescriptionFilter } from '../src/utils/jobSourceContent.js'
import { upsertScraperStatus } from '../scraper-support/utils/scraperPersistence.js'
import { collectPublishingGapSnapshot } from './collectPublishingGapSnapshot.js'

// This validation never accepts a database URI. It always starts a disposable
// local database and bypasses the catalog-wide runner and production services.
export async function validatePublishingGapPersistence({ trials, now = new Date(), siteSettings = {} } = {}) {
  if (mongoose.connection.readyState !== 0) throw new Error('Validation requires a disconnected process; existing database connections are not accepted')
  if (!Array.isArray(trials) || !trials.length) throw new Error('At least one fresh trial is required')
  const sources = new Set()
  for (const trial of trials) {
    const at = new Date(trial.completedAt)
    if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(trial.source || '') || sources.has(trial.source)) throw new Error('Trials require unique valid source IDs')
    sources.add(trial.source)
    if (!Array.isArray(trial.jobs) || !Number.isFinite(at.getTime()) || at > now || now - at > 48 * 3600000
      || !isFreshCompleteInventoryEvidence(trial.inventoryEvidence, { now })
      || !isFreshCompleteInventoryEvidence(trial.inventoryEvidence, { now: at })) {
      throw new Error(`Fresh complete first-party evidence required for ${trial.source}`)
    }
  }
  const downloadDir = process.env.MONGOMS_DOWNLOAD_DIR || path.join(os.tmpdir(), 'codex-scraper-test-mongo-8.2.6')
  const localBinary = path.join(downloadDir, 'mongod-x64-win32-8.2.6.exe')
  const systemBinary = process.env.MONGOMS_SYSTEM_BINARY
    || (process.platform === 'win32' && fs.existsSync(localBinary) ? localBinary : undefined)
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false'
  const mongo = new MongoMemoryServer({ instance: { ip: '127.0.0.1' }, binary: {
    version: '8.2.6', downloadDir, ...(systemBinary ? { systemBinary } : {}),
  } })
  try {
    await mongo.start()
    await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false })
    // Match the actual production visibility setting during the local query.
    await mongoose.connection.db.collection('sitesettings').insertOne({ _id: 'global', experiencedJobsEnabled: siteSettings.experiencedJobsEnabled !== false })
    const rows = []
    for (const trial of trials) {
      const analysis = analyzePublishableJobs(trial.jobs, { now })
      const detailHealth = extractionDetailHealth(analysis.indiaJobs)
      const options = { now, enrichPublicExperience: false, enqueueAlerts: false,
        descriptionRewriteMode: 'off', refreshDatasetSummary: false, replaceExisting: false }
      const result = await saveToDB(trial.jobs, trial.source, options)
      const before = await Job.countDocuments({ source: trial.source })
      const repeatSave = await saveToDB(trial.jobs, trial.source, options)
      const after = await Job.countDocuments({ source: trial.source })
      await upsertScraperStatus(trial.source, { success: true, ...result, detailHealth,
        rawRecords: trial.jobs.length, jobs: analysis.indiaJobs.length, eligibleJobs: analysis.eligibleJobs.length,
        filteredNonJob: analysis.filterCounts.nonJob,
        attemptedAt: trial.attemptedAt || trial.completedAt, completedAt: trial.completedAt,
        inventoryEvidence: trial.inventoryEvidence,
      })
      rows.push({ source: trial.source, trialHash: createHash('sha256').update(JSON.stringify(trial)).digest('hex'),
        rawJobs: trial.jobs.length, indiaJobs: analysis.indiaJobs.length,
        eligibleJobs: analysis.eligibleJobs.length, savedJobs: after, idempotent: before === after,
        privateJobsMissingSourceDescription: await Job.countDocuments({ source: trial.source, ...buildMissingSourceDescriptionFilter() }),
        detailHealth, firstSave: result, repeatSave,
        rejections: analysis.filterCounts })
    }
    const snapshot = await collectPublishingGapSnapshot({ now })
    if (!snapshot.databaseAvailable) throw new Error('Local public inventory query failed')
    for (const row of rows) {
      row.visibleJobs = snapshot.inventory.find(item => item.source === row.source)?.visibleJobs || 0
      row.visibleCompanies = snapshot.inventory.find(item => item.source === row.source)?.visibleCompanies || []
      row.outcome = row.idempotent && row.eligibleJobs > 0 && row.savedJobs > 0 && row.visibleJobs > 0 ? 'passed' : 'needs-investigation'
      row.reason = row.outcome === 'passed' ? null : row.eligibleJobs === 0 ? 'No jobs passed ingestion eligibility'
        : row.visibleJobs === 0 ? 'Saved jobs did not pass public visibility' : 'Repeated ingestion changed inventory size'
    }
    snapshot.environment = 'temporary-local-mongodb'
    return { generatedAt: now.toISOString(), environment: 'temporary-local-mongodb', productionWrites: false,
      sourceCount: rows.length, passedSources: rows.filter(row => row.outcome === 'passed').length,
      visibleCompanies: snapshot.publicCompanyNames.length, rows, snapshot }
  } finally {
    await mongoose.disconnect()
    await mongo.stop()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1] }
  const directory = path.resolve(option('--trials') || '../artifacts/publishing-gap/live-trials')
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'))
  const trials = manifest.sources.map(item => {
    const file = path.resolve(directory, item.file || `${item.source}.json`)
    const relative = path.relative(directory, file)
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Trial path must stay inside its directory')
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  })
  const runtime = option('--runtime') ? JSON.parse(fs.readFileSync(path.resolve(option('--runtime')), 'utf8')) : null
  const report = await validatePublishingGapPersistence({ trials, siteSettings: runtime?.siteSettings || {} })
  const destination = path.resolve(option('--output') || '../artifacts/publishing-gap/persistence-validation.json')
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ environment: report.environment, sourceCount: report.sourceCount, passedSources: report.passedSources, visibleCompanies: report.visibleCompanies }))
  if (report.passedSources !== report.sourceCount) process.exitCode = 1
}
