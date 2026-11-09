import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { saveToDB } from '../scraper-support/utils/saveToDB.js'
import { collectPublishingGapSnapshot } from './collectPublishingGapSnapshot.js'
import { verifyPartialPublishingTrial, loadPartialTrialEntries, PARTIAL_SAVE_OPTIONS, buildPartialAttempt,
  recordPartialPublishingStatus, countVisiblePartialJobs } from './partialPublishingGapEvidence.js'

// No URI parameter or production connection fallback is accepted.
export async function validatePartialPublishingPersistence({ entries, now = new Date(), siteSettings = {} }) {
  if (mongoose.connection.readyState !== 0) throw new Error('Validation requires a disconnected process')
  if (!Array.isArray(entries) || !entries.length) throw new Error('Nonempty partial trials required')
  const proofs = await Promise.all(entries.map(entry => verifyPartialPublishingTrial({ ...entry, now })))
  if (new Set(proofs.map(p => p.trial.source)).size !== proofs.length) throw new Error('Unique sources required')
  const mongo = new MongoMemoryServer({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } })
  const settings = { experiencedJobsEnabled: siteSettings.experiencedJobsEnabled !== false }
  try {
    await mongo.start()
    await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 })
    const db = mongoose.connection.db
    await db.collection('sitesettings').insertOne({ _id: 'global', ...settings })
    const rows = []
    for (const proof of proofs) {
      const { trial } = proof
      const priorDate = new Date(now.getTime() - 86400000)
      const prior = { source: trial.source, fingerprint: `partial-validation-preservation-${trial.source}`,
        title: 'Local preservation fixture', company: 'Local validation fixture', status: 'active',
        missedScrapeCount: 7, lastSeenAt: priorDate }
      const priorId = (await db.collection('jobs').insertOne(prior)).insertedId
      await db.collection('scraperstatuses').insertOne({ source: trial.source, isActive: true, lastSuccess: true,
        lastCompleteCheckAt: priorDate, lastCompleteJobsFound: 17, lastCompleteEligibleJobsFound: 13 })
      const options = { ...PARTIAL_SAVE_OPTIONS, now }
      const result = await saveToDB(trial.jobs, trial.source, options)
      const first = await db.collection('jobs').countDocuments({ source: trial.source })
      await saveToDB(trial.jobs, trial.source, options)
      const second = await db.collection('jobs').countDocuments({ source: trial.source })
      await recordPartialPublishingStatus(db, trial.source, buildPartialAttempt(proof, result, now))
      const preserved = await db.collection('jobs').findOne({ _id: priorId })
      const status = await db.collection('scraperstatuses').findOne({ source: trial.source })
      const visibleJobs = await countVisiblePartialJobs(db, trial, settings, now)
      const priorJobsPreserved = preserved?.status === 'active' && preserved.missedScrapeCount === 7
        && preserved.lastSeenAt.getTime() === priorDate.getTime()
      const partialStatusPreserved = status?.lastSuccess === false && status.latestAttempt?.success === false
        && status.latestAttempt?.inventoryEvidence?.listingComplete === false
        && status.lastCompleteCheckAt?.getTime() === priorDate.getTime()
        && status.lastCompleteJobsFound === 17 && status.lastCompleteEligibleJobsFound === 13
      const idempotent = first === second && second === trial.jobs.length + 1
      const outcome = visibleJobs === proof.eligibleJobs && idempotent && priorJobsPreserved && partialStatusPreserved
        && result.deleted === 0 && result.missed === 0 && result.expired === 0 ? 'passed' : 'needs-investigation'
      rows.push({ source: trial.source, trialByteHash: proof.trialByteHash, outcome, eligibleJobs: proof.eligibleJobs,
        visibleJobs, idempotent, priorJobsPreserved, partialStatusPreserved,
        inserted: result.inserted, updated: result.updated, deleted: result.deleted, expired: result.expired, missed: result.missed })
    }
    const snapshot = await collectPublishingGapSnapshot({ database: db, now })
    if (!snapshot.databaseAvailable) throw new Error('Local public snapshot unavailable')
    return { generatedAt: now.toISOString(), environment: 'temporary-local-mongodb', productionWrites: false,
      sourceCount: rows.length, passedSources: rows.filter(row => row.outcome === 'passed').length,
      siteSettings: settings, rows, snapshot }
  } finally {
    await mongoose.disconnect()
    await mongo.stop()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1] }
  if (!option('--output')) throw new Error('--output required')
  const runtime = option('--runtime') ? JSON.parse(fs.readFileSync(option('--runtime'), 'utf8')) : null
  const report = await validatePartialPublishingPersistence({ entries: loadPartialTrialEntries({
    trialFile: option('--trial'), trialsDirectory: option('--trials') }),
    siteSettings: runtime?.siteSettings || {} })
  fs.writeFileSync(path.resolve(option('--output')), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ passedSources: report.passedSources, rows: report.rows }))
  if (report.passedSources !== report.sourceCount) process.exitCode = 1
}
