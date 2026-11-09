/**
 * Resolve complete Unspecified decisions using their validated cached model prediction.
 * Preview: node scripts/repairUnspecifiedPublicJobTypes.js [--source=source-id]
 * Apply:   node scripts/repairUnspecifiedPublicJobTypes.js --apply [--source=source-id]
 * Saved source and model prediction are preserved; classification is refreshed under current rules.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import Job from '../src/models/Job.js'
import { JOB_CLASSIFICATION_POLICY_VERSION } from '../src/utils/jobClassificationVersion.js'
import { buildUnspecifiedPublicTypeRepair } from '../src/services/postScrapeClassification.js'
import { refreshJobDatasetSummary } from '../src/services/jobDatasetSummaryService.js'

export function parseRepairArguments(args) {
  if (args.some(value => value !== '--apply' && !value.startsWith('--source='))) throw new Error('Unsupported argument; use --help')
  const sources = args.filter(value => value.startsWith('--source='))
  if (sources.length > 1) throw new Error('Specify --source only once')
  const source = sources.length ? sources[0].slice('--source='.length).trim() : null
  if (source === '') throw new Error('--source requires a non-empty source ID')
  return { apply: args.includes('--apply'), source }
}

export async function repairUnspecifiedPublicJobTypes({ model = Job, apply = false, source = null,
  refreshSummary = refreshJobDatasetSummary } = {}) {
  const filter = { status: 'active',
    'classification.policyVersion': JOB_CLASSIFICATION_POLICY_VERSION,
    'classification.authoritative': true, 'classification.mode': 'policy', 'classification.complete': true,
    'classification.resolved.jobType': 'Unspecified', 'postClassification.mode': 'policy',
    'postClassification.status': 'completed', ...(source ? { source } : {}) }
  const summary = { mode: apply ? 'applied' : 'preview', scanned: 0, eligible: 0, updated: 0, stale: 0, skipped: 0 }
  const cursor = model.find(filter).sort({ _id: 1 }).lean().cursor({ batchSize: 100 })
  try {
    for await (const job of cursor) {
      summary.scanned++
      const operation = buildUnspecifiedPublicTypeRepair(job)
      if (!operation) { summary.skipped++; continue }
      summary.eligible++
      if (!apply) continue
      const result = await model.updateOne(operation.filter, operation.update)
      if (result.modifiedCount === 1) summary.updated++
      else summary.stale++
    }
  } finally {
    await cursor.close()
    // Keep summaries current even if a later row fails after earlier updates.
    if (apply && summary.updated) await refreshSummary()
  }
  return summary
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log('Preview: node scripts/repairUnspecifiedPublicJobTypes.js [--source=source-id]\nApply: add --apply. No model requests are made.')
  } else {
    try {
      const options = parseRepairArguments(args)
      const { default: connectDB } = await import('../db/db.js')
      await connectDB()
      console.log(JSON.stringify(await repairUnspecifiedPublicJobTypes(options), null, 2))
    } catch (error) {
      console.error('Unspecified-label repair failed:', error.message)
      process.exitCode = 1
    } finally { await mongoose.disconnect() }
  }
}
