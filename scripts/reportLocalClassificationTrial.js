import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { postScrapeInput, GLICLASS_CONFIG, GLICLASS_IDENTITY, classificationShard } from '../src/services/postScrapeClassification.js'
import { readTrialCorpusJobs } from './trialCorpusArchive.js'
import { trialNativeInputHash, trialNativeRuntimeHash } from './trialNativePredictionCache.js'
import { summarizeClassificationExperiments } from './summarizeClassificationExperiments.js'

const readJson = file => { try { return JSON.parse(fs.readFileSync(file)) } catch { return null } }
const increment = (object, key) => { object[key] = (object[key] || 0) + 1 }
const percentile = (values, fraction) => values.length ? values[Math.ceil(values.length*fraction)-1] : null
const validNativePrediction = prediction => {
  if (prediction?.fullDescriptionCovered !== true || !Number.isInteger(prediction.windows) || prediction.windows < 1
    || !Number.isFinite(prediction.seconds) || prediction.seconds < 0
    || !Number.isFinite(prediction.cpuSeconds) || prediction.cpuSeconds < 0
    || !Number.isFinite(prediction.peakRssBytes) || prediction.peakRssBytes <= 0) return false
  const entries = Object.entries(prediction.scores || {})
  return entries.length === GLICLASS_CONFIG.labels.length
    && GLICLASS_CONFIG.labels.every(label => Number.isFinite(prediction.scores[label])
      && prediction.scores[label] >= 0 && prediction.scores[label] <= 1)
    && Math.abs(entries.reduce((sum, [, score]) => sum + score, 0) - 1) <= .002
    && prediction.modelLabel === entries.sort((a, b) => b[1] - a[1])[0][0]
}
const archivedResources = (directory, name) => {
  const history = path.join(directory, 'resume-history')
  if (!fs.existsSync(history)) return []
  return fs.readdirSync(history, { withFileTypes: true }).filter(entry => entry.isDirectory())
    .sort((a,b) => a.name.localeCompare(b.name)).map(entry => {
      const record = readJson(path.join(history, entry.name, name))
      return record ? { ...record, archivePath: `resume-history/${entry.name}/${name}`,
        archiveSha256: createHash('sha256').update(fs.readFileSync(path.join(history, entry.name, name))).digest('hex') } : null
    }).filter(Boolean)
}

export async function reportLocalClassificationTrial(directory) {
  const runtime = trialNativeRuntimeHash(), sources = readJson(path.join(directory, 'source-summary.json'))
  const report = { generatedAt: new Date(), identity: GLICLASS_IDENTITY, localOnly: true,
    sources, total: 0, completed: 0, skipped: [], missing: [], staleNative: [], stalePolicy: [],
    categories: {}, modelCategories: {}, sourceQualityIssues: {}, seconds: 0, cpuSeconds: 0,
    windows: 0, peakModelRssBytes: 0, modelAgreements: 0,
    simulatedShards: Array.from({ length: 4 }, (_, shard) => ({ shard, jobs: 0, seconds: 0 })) }
  const times = []
  for await (const job of readTrialCorpusJobs(directory)) {
    report.total++
    const input = postScrapeInput(job)
    if (input.incomplete) {
      report.skipped.push({ trialId: job.trialId, source: job.source, title: job.title,
        reason: input.body ? 'oversized_description' : 'missing_description', bytes: Buffer.byteLength(input.body) })
      continue
    }
    const stored = readJson(path.join(directory, 'classifications', `${job.trialId}.json`))
    if (!stored) { report.missing.push(job.trialId); continue }
    if (stored.nativeInputHash !== trialNativeInputHash(input, runtime) || !validNativePrediction(stored.prediction)) {
      report.staleNative.push(job.trialId); continue
    }
    if (stored.inputHash !== input.inputHash || stored.classification?.inputHash !== input.inputHash
      || stored.classification?.complete !== true) { report.stalePolicy.push(job.trialId); continue }
    report.completed++
    const { prediction, classification } = stored
    increment(report.categories, classification.resolved.jobType)
    increment(report.modelCategories, prediction.modelLabel)
    for (const issue of classification.sourceQualityIssues || []) increment(report.sourceQualityIssues, issue)
    if (prediction.modelLabel === classification.resolved.jobType) report.modelAgreements++
    report.seconds += prediction.seconds
    report.cpuSeconds += prediction.cpuSeconds
    report.windows += prediction.windows
    report.peakModelRssBytes = Math.max(report.peakModelRssBytes, prediction.peakRssBytes)
    times.push(prediction.seconds)
    // Snapshots without MongoDB IDs use their local trial identity. This is a
    // distribution simulation, not an observed GitHub/production shard timing.
    const shard = report.simulatedShards[classificationShard(job.fingerprint || job.trialId, 4)]
    shard.jobs++; shard.seconds += prediction.seconds
  }
  times.sort((a,b) => a-b)
  report.inference = { meanSeconds: report.completed ? report.seconds/report.completed : null,
    medianSeconds: percentile(times, .5), p95Seconds: percentile(times, .95),
    p99Seconds: percentile(times, .99), maxSeconds: times.at(-1) || null }
  report.inputAccountingComplete = report.completed + report.skipped.length === report.total
    && !report.missing.length && !report.staleNative.length && !report.stalePolicy.length
  report.acceptedInputCount = report.total - report.skipped.length
  report.coverageComplete = report.inputAccountingComplete && report.acceptedInputCount > 0
  report.fullCorpusTextCovered = report.total > 0 && report.completed === report.total
  report.classifiedRecordFraction = report.total ? report.completed/report.total : null
  report.skipReasons = {}
  for (const input of report.skipped) increment(report.skipReasons, input.reason)
  report.resourceGuard = readJson(path.join(directory, 'resource-guard.json'))
  report.resourceGuardHistory = [readJson(path.join(directory, 'resource-guard-ram-before-either.json')),
    ...archivedResources(directory, 'resource-guard.json')].filter(Boolean)
  report.resources = readJson(path.join(directory, 'resource-summary.json'))
  report.resourceHistory = archivedResources(directory, 'resource-summary.json')
  const guards = [report.resourceGuard, ...report.resourceGuardHistory].filter(Boolean)
  const resources = [report.resources, ...report.resourceHistory].filter(Boolean)
  const measurementNotes = readJson(path.join(directory, 'resource-measurement-notes.json'))?.notes
  report.resourceMeasurementNotes = (Array.isArray(measurementNotes) ? measurementNotes : [])
    .filter(note => note.kind === 'startup_cpu_sample_without_interval')
    .flatMap(note => {
      const guard = report.resourceGuardHistory.find(record => record.archiveSha256 === note.guardSha256)
      return guard ? [{ kind: note.kind, guardSha256: note.guardSha256, ownerPid: guard.ownerPid,
        archivePath: guard.archivePath, recordedCpuPercent: guard.peakCpuPercent,
        qualification: 'The startup sample was taken without an adequate interval and does not establish sustained CPU usage. The raw reading is preserved.' }] : []
    })
  report.resourcePeaks = {
    hostCpuPercent: Math.max(0, ...guards.map(record => record.peakCpuPercent || 0)),
    hostRamPercent: Math.max(0, ...guards.map(record => record.peakRamPercent || 0)),
    modelRssBytes: Math.max(report.peakModelRssBytes, ...resources.map(record => record.peakModelRssBytes || 0)),
    treeRssBytes: Math.max(0, ...resources.map(record => record.peakTreeRssBytes || 0)),
  }
  report.reviewMetadataCorrections = readJson(path.join(directory, 'review-metadata-corrections.json'))
  report.quality = Object.fromEntries(['development', 'holdout', 'fresher-audit-latest', 'fresher-confirmation-latest']
    .map(name => [name, readJson(path.join(directory, `quality-${name}.json`))]))
  report.modelExperiments = summarizeClassificationExperiments(directory)
  report.projections = [30000,35000,report.total].map(jobs => ({ jobs,
    oneCpuInferenceHours: report.inference.meanSeconds === null ? null : report.inference.meanSeconds * jobs / 3600,
    fourRunnerBalancedInferenceHours: report.inference.meanSeconds === null ? null : report.inference.meanSeconds * jobs / 4 / 3600,
    fiveHourMeanSecondsBudget: 18000 / (jobs/4),
    caveat: 'Inference-only extrapolation from this laptop; setup, MongoDB, runner speed and shard imbalance are not measured.' }))
  fs.writeFileSync(path.join(directory, 'classification-final-analytics.json'), JSON.stringify(report, null, 2))
  const table = object => Object.entries(object).map(([label,count]) => `| ${label} | ${count} |`).join('\n')
  const hours = value => Number.isFinite(value) ? value.toFixed(2) : 'unavailable'
  const qualityRows = Object.entries(report.quality).filter(([,result]) => result).map(([name,result]) => {
    const source = result.guardedSourcePolicy || result.guarded
    return `| ${name} | ${result.model?.correct ?? '?'} / ${result.model?.evaluated ?? '?'} | ${source?.correct ?? '?'} / ${source?.evaluated ?? '?'} |`
  }).join('\n')
  const score = value => value ? `${value.correct} / ${value.evaluated}` : 'unavailable'
  const pooledModel = names => names.every(name => report.quality[name]?.model)
    ? names.reduce((sum,name) => ({ correct: sum.correct+report.quality[name].model.correct,
      evaluated: sum.evaluated+report.quality[name].model.evaluated }), {correct:0,evaluated:0}) : null
  const experimentRows = report.modelExperiments.map(experiment => `| ${experiment.model} (${experiment.precision}) | ${score(experiment.development)} | ${score(experiment.validation)} | ${experiment.passedDevelopmentGate ? 'passed development' : 'rejected on development'} |`).join('\n')
  const experimentTiming = report.modelExperiments.filter(experiment => experiment.timing).map(experiment => {
    const timing = experiment.timing
    return `The isolated ${experiment.model} (${experiment.precision}) timing sample processed ${timing.records} frozen corpus records on ${timing.cpuThreads} CPU thread(s). Mean ${timing.meanSeconds.toFixed(3)} seconds/job; p95 ${timing.p95Seconds.toFixed(3)} seconds. Inference RSS observed: ${(timing.peakInferenceRssBytes/1024**2).toFixed(1)} MiB; recorded startup RSS peak: ${timing.startupPeakRssBytes === null ? 'unavailable' : (timing.startupPeakRssBytes/1024**2).toFixed(1)+' MiB'}.\n\n`
      + `| Jobs | Four runners hours | Eight runners hours | Twelve runners hours | Sixteen runners hours | Twenty runners hours |\n| ---: | ---: | ---: | ---: | ---: | ---: |\n${timing.projections.map(row => `| ${row.jobs} | ${[4,8,12,16,20].map(workers => hours(row.balancedInferenceHours[workers])).join(' | ')} |`).join('\n')}\n\nThese are balanced inference-only projections from a timing sample, not measured GitHub runtimes. Setup, MongoDB traffic, runner speed and job imbalance remain unmeasured. Timing records carry no reference labels or accuracy claim.\n\n`
  }).join('')
  const content = `This local trial attempted ${sources?.totalSources ?? sources?.total ?? 'unknown'} sources at scraper concurrency 10 and captured ${report.total} unique source records. Native classification started only after the source pass finished. Production MongoDB, alerts and rewriting were disabled.\n\n`
    + `Classified records: ${report.completed}/${report.total} (${report.classifiedRecordFraction === null ? 'unavailable' : (report.classifiedRecordFraction*100).toFixed(2)+'%'}). All inputs accounted for: ${report.inputAccountingComplete}. All accepted descriptions classified: ${report.coverageComplete}. Full corpus text covered: ${report.fullCorpusTextCovered}. These coverage figures do not establish correctness.\n\n`
    + `Skipped inputs: ${report.skipped.length}; missing predictions: ${report.missing.length}; stale or invalid native predictions: ${report.staleNative.length}; stale policy results: ${report.stalePolicy.length}.\n\n| Skip reason | Records |\n| --- | ---: |\n${table(report.skipReasons)}\n\n`
    + `| Source-policy category | Jobs |\n| --- | ---: |\n${table(report.categories)}\n\n`
    + `| Raw model category | Jobs |\n| --- | ---: |\n${table(report.modelCategories)}\n\n`
    + `Native inference total: ${hours(report.seconds/3600)} hours, CPU time: ${hours(report.cpuSeconds/3600)} hours. Mean ${report.inference.meanSeconds?.toFixed(3)} seconds/job, p95 ${report.inference.p95Seconds?.toFixed(3)} seconds, p99 ${report.inference.p99Seconds?.toFixed(3)} seconds. This sums one valid prediction per job, including saved predictions reused across resumes. It excludes model startup, source scraping, interruptions and file/database overhead. Peak model RSS recorded in valid predictions: ${(report.peakModelRssBytes/1024**2).toFixed(1)} MiB.\n\n`
    + `The resource watchdog sampled total laptop memory and normalized host CPU usage every two seconds. Its configured trigger is ${report.resourceGuard?.metric || 'unavailable'}, strictly above ${report.resourceGuard?.limitPercent ?? 'unavailable'}%. Its status and measured peaks are saved in resource-guard.json, with the earlier RAM-only period preserved separately. Saved predictions survive a stop. The completion supervisor applies the persisted limits during reporting too.\n\n`
    + `Preserved guard records across stops and resumes reached ${report.resourcePeaks.hostCpuPercent.toFixed(1)}% total host CPU and ${report.resourcePeaks.hostRamPercent.toFixed(1)}% RAM. The observed model RSS peak across resource monitors and valid predictions was ${(report.resourcePeaks.modelRssBytes/1024**2).toFixed(1)} MiB; the trial process tree reached ${(report.resourcePeaks.treeRssBytes/1024**2).toFixed(1)} MiB. These historical peaks include earlier stopped attempts. Resume-history records remain attached to their original process owners, so a short metadata retry cannot replace the full-pass resource measurements.\n\n`
    + report.resourceMeasurementNotes.map(note => `CPU measurement qualification for owner ${note.ownerPid}: ${note.qualification} The corrected watchdog uses two-second measurement windows.\n\n`).join('')
    + `| Jobs | One CPU inference hours | Four balanced runners inference hours |\n| ---: | ---: | ---: |\n${report.projections.map(row => `| ${row.jobs} | ${hours(row.oneCpuInferenceHours)} | ${hours(row.fourRunnerBalancedInferenceHours)} |`).join('\n')}\n\n`
    + `These are projections, not GitHub measurements. Four standard public runners execute separate six-hour jobs; each prepared shard reserves five hours for inference. Standard public Ubuntu runners currently provide four CPUs and 16 GB RAM. Public standard-runner compute is free. [Runner specifications](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [limits](https://docs.github.com/en/actions/reference/limits), [billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).\n\n`
    + `| Diagnostic review | Raw model correct / evaluated | Source guards correct / evaluated |\n| --- | ---: | ---: |\n${qualityRows}\n\n`
    + (report.modelExperiments.length ? `| Model comparison | Development correct / clear | Frozen validation correct / clear | Experiment status |\n| --- | ---: | ---: | --- |\n| Selected edge model | ${score(pooledModel(['development','fresher-audit-latest']))} | ${score(pooledModel(['holdout','fresher-confirmation-latest']))} | full-corpus checkpoint |\n${experimentRows}\n\nThe other checkpoints are isolated experiments; they have not replaced the full-run model or production configuration. Validation excludes ambiguous and insufficient references. Artifact hashes and reference identities are checked before including frozen validation and complete timing samples. Passing a development gate does not establish production readiness or population accuracy.\n\n${experimentTiming}` : '')
    + `The raw model is not ready to be the sole production classifier on these diagnostics. Missing and conflicting source requirements also limit the guards. The additional fresher audit was promoted to development; the separate confirmation packet did not supply policy changes. Results on uncertain references are saved separately in each quality artifact. These small diagnostic samples were manually reviewed by Codex, not independent experts, and cannot support a population accuracy claim. No model weights were fine-tuned.\n\n`
    + `The prepared MongoDB workflow remains in shadow mode by default. It has not been deployed or run on GitHub. Broader repository tests reported 196 failures; focused classification checks passed. Further source-quality work and independent labels are needed before approving production decisions. Detailed provenance, skip reasons, timing distributions and quality rows are in classification-final-analytics.json and the frozen review artifacts.\n`
  fs.writeFileSync(path.join(directory, 'FINAL-REPORT.md'), content)
  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/reportLocalClassificationTrial.js RUN_DIRECTORY')
  const result = await reportLocalClassificationTrial(path.resolve(process.argv[2]))
  console.log(JSON.stringify({ total: result.total, completed: result.completed, skipped: result.skipped.length,
    inputAccountingComplete: result.inputAccountingComplete, coverageComplete: result.coverageComplete,
    fullCorpusTextCovered: result.fullCorpusTextCovered, meanSeconds: result.inference.meanSeconds }))
  if (!result.inputAccountingComplete) process.exitCode = 1
}
