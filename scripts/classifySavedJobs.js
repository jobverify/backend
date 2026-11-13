import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import connectDB from '../db/db.js'
import Job from '../src/models/Job.js'
import { CLASSIFICATION_FIELDS } from '../src/services/jobClassificationPolicy.js'
import { normalizePublicJobType } from '../src/utils/publicJobTypeLabel.js'
import { alreadyClassified, classificationShard, postScrapeInput, GLICLASS_CONFIG,
  resolvePostScrapeClassification, sourceSnapshotFilter } from '../src/services/postScrapeClassification.js'
import { startGliclassWorker } from './gliclassWorker.js'
import { createProgressLogger } from './lib/progressLogger.js'
import { trialNativeInputHash, trialNativeRuntimeHash } from './trialNativePredictionCache.js'
import { classificationSkipReason, createClassificationReport, recordClassificationInput, recordClassificationDecision,
  recordClassificationInference } from '../classification/reporting.js'
import { assignedSavedJobs } from './lib/assignedSavedJobs.js'
import { refreshJobBatchEligibility } from './lib/batchEligibilityPhase.js'

export async function classifySavedJobs({ model = Job, worker, now = () => new Date(),
  mode = 'shadow', shard = 0, shardCount = 1, budgetSeconds = 18000, concurrency = 1, signal,
  monotonicNow = () => performance.now(),
  onProgress = () => {}, onResult = () => {} } = {}) {
  if (!['shadow', 'policy'].includes(mode)) throw new Error('Mode must be shadow or policy')
  if (!Number.isSafeInteger(shard) || shard < 0 || shard >= shardCount) throw new Error('Invalid shard')
  classificationShard('validate', shardCount)
  if (!Number.isFinite(budgetSeconds) || budgetSeconds <= 0) throw new Error('Invalid time budget')
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('Invalid classification concurrency (1-8)')
  // The serialized worker allows five minutes per request. Queued jobs need
  // that allowance for every request ahead of them as well as their own lease.
  const leaseMilliseconds = (10 + 5*(concurrency-1))*60*1000
  const started = Date.now(), owner = randomUUID(), nativeRuntime = trialNativeRuntimeHash()
  const summary = { ...createClassificationReport(worker.configuration),
    modelId: GLICLASS_CONFIG.model, modelRevision: GLICLASS_CONFIG.revision,
    mode, shard, shardCount, concurrency, timingBasis: 'summed_operation_durations', scanned: 0, assigned: 0, cached: 0, nativeCached: 0,
    completed: 0, skipped: 0, failed: 0, stale: 0, leased: 0, budgetExhausted: false,
    timingMs: { sourceRead: 0, input: 0, claim: 0, modelRoundTrip: 0, decision: 0, save: 0, reporting: 0 } }
  const recordTiming = (phase, began, jobTimings) => {
    const duration = Math.max(0, monotonicNow() - began)
    summary.timingMs[phase] += duration
    if (jobTimings) jobTimings[phase] += duration
  }
  const measure = async (phase, operation, jobTimings) => {
    const began = monotonicNow()
    try { return await operation() } finally { recordTiming(phase, began, jobTimings) }
  }
  const measureSync = (phase, operation, jobTimings) => {
    const began = monotonicNow()
    try { return operation() } finally { recordTiming(phase, began, jobTimings) }
  }
  const shouldStop = () => signal?.aborted || Date.now()-started >= budgetSeconds*1000
  const cursor = assignedSavedJobs(model, shard, shardCount, summary, shouldStop)
  let reportQueue = Promise.resolve()
  const processJob = async job => {
      summary.assigned++
      const jobStarted = Date.now()
      const jobTimings = { input: 0, claim: 0, modelRoundTrip: 0, decision: 0, save: 0 }
      const clock = now(), input = measureSync('input', () => postScrapeInput(job, { now: clock }), jobTimings)
      recordClassificationInput(summary, input)
      const inputBytes = Buffer.byteLength(input.body, 'utf8')
      const emit = async (status, details = {}) => {
        const row = { id: String(job._id), company: String(job.company || '').slice(0, 200),
            title: input.title.slice(0, 200), source: String(job.source || '').slice(0, 200),
            inputHash: input.inputHash, inputBytes, descriptionOrigin: input.descriptionOrigin,
            shard, status, durationMs: Date.now() - jobStarted, timingMs: { ...jobTimings }, ...details }
        const reported = reportQueue.then(() => measure('reporting', async () => {
          await onResult(row)
          await onProgress({ ...summary, timingMs: { ...summary.timingMs }, elapsedSeconds: (Date.now() - started) / 1000 })
        }))
        reportQueue = reported.catch(() => {})
        await reported
      }
      const decisionDetails = (result, prediction, publicJobType) => {
        const modelJobType = prediction?.modelLabel ?? result?.comparison?.modelJobType ?? null
        const finalJobType = result?.resolved?.jobType
        return {
          resolvedJobType: result?.resolved?.jobType ?? null, publicJobType: publicJobType ?? null,
          modelJobType, sourcePolicyJobType: result?.comparison?.logicJobType ?? null,
          modelMatchesFinalLabel: modelJobType && finalJobType ? modelJobType === finalJobType : null,
          decisionSource: result?.decisionSource ?? null, classificationStatus: result?.status ?? null,
          uncertain: result?.resolved ? result.status === 'uncertain' || result.resolved.jobType === 'Unspecified' : null,
          modelAgreement: result?.comparison?.agreement ?? null,
          uncalibratedModelScore: result?.decisions?.jobType?.probability ?? null,
          reason: result?.reason ?? null,
          sourceQualityIssues: result?.sourceQualityIssues ?? [], reviewReasons: result?.reviewReasons ?? [],
        }
      }
      if (measureSync('input', () => alreadyClassified(job, input, mode), jobTimings)) {
        summary.cached++
        const previous = job.postClassification.result
        const publicJobType = mode === 'policy' ? job.jobType : null
        recordClassificationDecision(summary, { input, result: previous?.classification,
          prediction: previous?.prediction, publicJobType })
        await emit('cached', { ...decisionDetails(previous?.classification, previous?.prediction, publicJobType), modelRequest: false })
        return
      }
      const snapshot = measureSync('input', () => sourceSnapshotFilter(job), jobTimings)
      if (input.incomplete) {
        const reason = classificationSkipReason(input, GLICLASS_CONFIG.maxInputBytes)
        const clearPolicyFields = mode === 'policy'
        const saved = await measure('save', () => model.updateOne(snapshot, { $set: {
          ...(clearPolicyFields ? Object.fromEntries(CLASSIFICATION_FIELDS.map(field => [field,
            field === 'jobType' ? 'Unspecified' : field === 'experienceYears' ? [] : null])) : {}),
          postClassification: {
          inputHash: input.inputHash, mode, status: 'skipped', reason, attemptedAt: clock,
        } }, ...(clearPolicyFields ? { $unset: { classification: '' } } : {}) }), jobTimings)
        if (saved.matchedCount === 0) {
          summary.stale++
          await emit('stale', { reason: 'source_changed', modelRequest: false })
        } else {
          summary.skipped++
          summary.skipReasons[reason]++
          await emit('skipped', { reason, maxInputBytes: GLICLASS_CONFIG.maxInputBytes, modelRequest: false })
        }
        return
      }
      const claimed = await measure('claim', () => model.updateOne({ ...snapshot, $or: [
        { 'postClassification.status': { $ne: 'processing' } },
        { 'postClassification.leaseUntil': { $lte: clock } },
        { 'postClassification.leaseUntil': { $exists: false } },
      ] }, { $set: { postClassification: { inputHash: input.inputHash, mode, status: 'processing',
        owner, attemptedAt: clock, leaseUntil: new Date(clock.getTime()+leaseMilliseconds),
        attempts: job.postClassification?.inputHash === input.inputHash ? (job.postClassification.attempts || 0)+1 : 1,
      } } }), jobTimings)
      if (!claimed.modifiedCount) { summary.leased++; await emit('leased', { reason: 'live_lease_or_source_changed', modelRequest: false }); return }
      let outcome, details = {}, inferred = false
      try {
        const nativeInputHash = measureSync('input', () => trialNativeInputHash(input, nativeRuntime), jobTimings)
        const priorNative = job.postClassification?.status === 'completed'
          && job.postClassification.result?.nativeInputHash === nativeInputHash
          ? job.postClassification.result.prediction : null
        let prediction = priorNative
        if (!prediction) {
          inferred = true
          summary.modelRequests++
          prediction = await measure('modelRoundTrip', () => worker.classify(input), jobTimings)
          recordClassificationInference(summary, prediction)
        }
        const result = measureSync('decision', () => resolvePostScrapeClassification(job, prediction, { now: clock, mode }), jobTimings)
        if (priorNative) summary.nativeCached++
        const fields = mode === 'policy' ? { classification: result,
          ...Object.fromEntries(CLASSIFICATION_FIELDS.map(field => [field, result.resolved[field] ?? null])),
          jobType: normalizePublicJobType(result.resolved.jobType) } : {}
        const updated = await measure('save', () => model.updateOne({ ...snapshot, 'postClassification.owner': owner,
          'postClassification.inputHash': input.inputHash }, { $set: { ...fields,
          'postClassification.status': 'completed', 'postClassification.completedAt': now(),
          'postClassification.result': { classification: result, prediction, nativeInputHash },
        }, $unset: { 'postClassification.owner': '', 'postClassification.leaseUntil': '' } }), jobTimings)
        if (updated.modifiedCount) {
          summary.completed++
          outcome = 'completed'
          const publicJobType = mode === 'policy' ? fields.jobType : null
          recordClassificationDecision(summary, { input, result, prediction, publicJobType })
          details = { ...decisionDetails(result, prediction, publicJobType), nativeCached: !!priorNative,
            windows: prediction.windows, descriptionTokens: prediction.descriptionTokens,
            ...(inferred ? { inferenceSeconds: prediction.seconds, cpuSeconds: prediction.cpuSeconds,
              peakRssBytes: prediction.peakRssBytes } : {}) }
        }
        else {
          summary.stale++
          outcome = 'stale'
          details = { reason: 'source_changed' }
          await measure('save', () => model.updateOne({ _id: job._id, 'postClassification.owner': owner }, {
            $set: { 'postClassification.status': 'failed', 'postClassification.reason': 'source_changed' },
            $unset: { 'postClassification.owner': '', 'postClassification.leaseUntil': '' },
          }), jobTimings)
        }
      } catch (error) {
        summary.failed++
        outcome = 'failed'
        details = { reason: 'classification_error', errorType: error.name }
        await measure('save', () => model.updateOne({ _id: job._id, 'postClassification.owner': owner }, {
          $set: { 'postClassification.status': 'failed', 'postClassification.reason': String(error.message).slice(0, 300) },
          $unset: { 'postClassification.owner': '', 'postClassification.leaseUntil': '' },
        }), jobTimings)
      }
      await emit(outcome, { ...details, modelRequest: inferred })
  }
  const inFlight = new Set()
  let fatalError
  const launch = job => {
    const task = processJob(job).catch(error => { fatalError ||= error }).finally(() => inFlight.delete(task))
    inFlight.add(task)
  }
  try {
    while (!fatalError) {
      if (inFlight.size >= concurrency) await Promise.race(inFlight)
      if (fatalError) break
      const { value: job, done } = await measure('sourceRead', () => cursor.next())
      if (done || fatalError) break
      if (shouldStop()) { summary.budgetExhausted = true; break }
      launch(job)
    }
  } catch (error) { fatalError ||= error }
  finally {
    // A fatal reporting/read failure stops admission, but owned jobs must finish
    // before the caller shuts down the worker or database connection.
    await Promise.all(inFlight)
    try { await measure('sourceRead', () => cursor.return()) } catch (error) { fatalError ||= error }
  }
  if (fatalError) throw fatalError
  return { ...summary, elapsedSeconds: (Date.now()-started)/1000 }
}

export async function classifyJobsWithBatches(options = {}) {
  const began = Date.now(), clock = options.now?.() || new Date()
  let summary
  try { summary = await classifySavedJobs(options) }
  finally { await options.worker.stop?.() }
  const batchEligibility = await refreshJobBatchEligibility({ ...options, referenceDate: clock,
    budgetSeconds: Math.max(0, (options.budgetSeconds ?? 18000) - (Date.now() - began) / 1000),
    extractorFactory: options.extractorFactory,
    onResult: options.onResult, onProgress: batch => options.onProgress?.({ ...summary, batchEligibility: batch }),
  })
  return { ...summary, batchEligibility, elapsedSeconds: (Date.now() - began) / 1000 }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  dotenv.config({ quiet: true })
  const controller = new AbortController()
  process.once('SIGTERM', () => controller.abort())
  process.once('SIGINT', () => controller.abort())
  let worker
  const shard = Number(process.env.CLASSIFICATION_SHARD || 0)
  let latestProgress = {}
  const progress = createProgressLogger('classification', () => ({ shard, ...latestProgress }))
  const output = process.env.CLASSIFICATION_SUMMARY_FILE || `.cache/scraper-actions/classification-${shard}.json`
  const diagnostics = process.env.CLASSIFICATION_DIAGNOSTICS_FILE || output.replace(/\.json$/, '') + '.ndjson'
  const persist = summary => { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output,
    JSON.stringify({ ...summary, diagnosticsFile: path.basename(diagnostics) }, null, 2)) }
  try {
    progress.phase('configuration')
    if (path.resolve(diagnostics) === path.resolve(output)) throw new Error('Classification diagnostics and summary must use different files')
    fs.mkdirSync(path.dirname(diagnostics), { recursive: true })
    fs.writeFileSync(diagnostics, '')
    progress.phase('connect')
    await connectDB()
    progress.phase('start_worker')
    worker = await startGliclassWorker()
    progress.phase('process_queue')
    const summary = await classifyJobsWithBatches({ worker, shard, shardCount: Number(process.env.CLASSIFICATION_SHARD_COUNT || 1),
      mode: process.env.POST_SCRAPE_CLASSIFICATION_MODE || 'shadow',
      concurrency: Number(process.env.CLASSIFICATION_CONCURRENCY || 1),
      budgetSeconds: Number(process.env.CLASSIFICATION_BUDGET_SECONDS || 18000), signal: controller.signal,
      onProgress: value => {
        const { scanned, assigned, completed, cached, nativeCached, skipped, failed, stale, leased, modelRequests } = value
        latestProgress = { scanned, assigned, completed, cached, nativeCached, skipped, failed, stale, leased, modelRequests,
          ...(value.batchEligibility ? { batchEligibility: value.batchEligibility } : {}) }
        persist(value)
      }, onResult: row => fs.appendFileSync(diagnostics, JSON.stringify(row) + '\n') })
    persist(summary)
    console.log(JSON.stringify(summary))
    if (summary.failed || summary.stale || summary.budgetExhausted || summary.batchEligibility.failed
      || summary.batchEligibility.pending || summary.batchEligibility.budgetExhausted) process.exitCode = 1
  } finally {
    progress.stop()
    await worker?.stop()
    await mongoose.disconnect()
  }
}
