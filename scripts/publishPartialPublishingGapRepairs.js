import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import mongoose from 'mongoose'
import '../loadEnv.js'
import { configureMongoDns } from '../src/utils/mongoDns.js'
import { saveToDB } from '../scraper-support/utils/saveToDB.js'
import { collectPublishingGapSnapshot } from './collectPublishingGapSnapshot.js'
import { refreshJobDatasetSummary } from '../src/services/jobDatasetSummaryService.js'
import { loadPartialTrialEntries, planPartialPublishingRollout, executePartialPublishingRollout,
  recordPartialPublishingStatus, countVisiblePartialJobs } from './partialPublishingGapEvidence.js'

export async function partialPublishingCli(args) {
  const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1] }
  const supported = new Set(['--trial', '--trials', '--validation', '--output', '--apply'])
  for (let i = 0; i < args.length; i++) {
    if (!supported.has(args[i])) throw new Error(`Unsupported option: ${args[i]}; trial truncation is not supported`)
    if (args[i] !== '--apply' && (!args[++i] || args[i].startsWith('--'))) throw new Error('Option value required')
  }
  if (!option('--validation')) throw new Error('--validation required')
  const entries = loadPartialTrialEntries({ trialFile: option('--trial'), trialsDirectory: option('--trials') })
  const validation = JSON.parse(fs.readFileSync(option('--validation'), 'utf8'))
  const plan = await planPartialPublishingRollout({ entries, validation })
  if (!args.includes('--apply')) return { mode: 'plan-only', sourceCount: plan.sourceCount, batches: plan.batches,
    eligibleJobs: plan.verified.reduce((n, p) => n + p.eligibleJobs, 0), extractionComplete: false }
  if (!option('--output')) throw new Error('An unused --output directory is required for apply checkpoints')
  if (!process.env.MONGO_URI) throw new Error('Database configuration unavailable')
  const directory = path.resolve(option('--output'))
  fs.mkdirSync(directory) // Existing releases/checkpoints must never be overwritten.
  const checkpoint = async progress => fs.writeFileSync(path.join(directory, 'progress.json'), `${JSON.stringify(progress, null, 2)}\n`)
  const captureSnapshot = async (name, snapshot) =>
    fs.writeFileSync(path.join(directory, `${name}-runtime.json`), `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' })
  let result
  try {
    configureMongoDns()
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 })
    result = await executePartialPublishingRollout({ entries, validation,
      collectSnapshot: () => collectPublishingGapSnapshot(),
      saveJobs: saveToDB, checkpoint, captureSnapshot,
      recordPartialStatus: (source, attempt) => recordPartialPublishingStatus(mongoose.connection.db, source, attempt),
      verifyVisibility: (trial, settings) => countVisiblePartialJobs(mongoose.connection.db, trial, settings),
    })
    if (result.completed) await refreshJobDatasetSummary()
  } catch {
    result = { ...(result || {}), mode: 'partial-positive-upsert', completed: false,
      beforeCompanies: result?.beforeCompanies ?? null, afterCompanies: null, companiesChange: null,
      error: 'Partial publication stopped; inspect checkpoints before retrying.' }
    await checkpoint(result)
  } finally {
    await mongoose.disconnect()
  }
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await partialPublishingCli(process.argv.slice(2))
  console.log(JSON.stringify(result))
  if (result.completed === false) process.exitCode = 1
}
