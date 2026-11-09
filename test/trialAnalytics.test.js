import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { reportLocalClassificationTrial } from '../scripts/reportLocalClassificationTrial.js'
import { postScrapeInput, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'
import { trialNativeInputHash } from '../scripts/trialNativePredictionCache.js'

test('trial analytics cannot count stale sources as complete and report skipped coverage separately', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trial-analytics-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  fs.mkdirSync(path.join(directory, 'classifications'))
  const history=path.join(directory,'resume-history','previous-pass')
  fs.mkdirSync(history,{recursive:true})
  fs.writeFileSync(path.join(history,'resource-guard.json'),JSON.stringify({peakCpuPercent:90.7,peakRamPercent:62.5,status:'stopped_resource_limit'}))
  fs.writeFileSync(path.join(history,'resource-summary.json'),JSON.stringify({peakModelRssBytes:2048,peakTreeRssBytes:8192}))
  fs.writeFileSync(path.join(directory,'resource-guard.json'),JSON.stringify({metric:'either',limitPercent:90,peakCpuPercent:20,peakRamPercent:50}))
  fs.writeFileSync(path.join(directory,'resource-summary.json'),JSON.stringify({peakModelRssBytes:512,peakTreeRssBytes:1024}))
  fs.writeFileSync(path.join(directory, 'source-summary.json'), JSON.stringify({ totalSources: 100, completed: 100 }))
  const valid = { trialId: 'valid', title: 'Engineer', sourceDescription: 'Minimum 3 years of professional experience required.' }
  const stale = { ...valid, trialId: 'stale', sourceDescription: 'Minimum 5 years of professional experience required.' }
  const missing = { ...valid, trialId: 'missing' }
  const oversized = { ...valid, trialId: 'oversized', sourceDescription: 'long source text '.repeat(20000) }
  const input = postScrapeInput(valid)
  const prediction = { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 2,
    scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 },
    seconds: 2, cpuSeconds: 1.9, peakRssBytes: 1024 }
  const stored = { inputHash: input.inputHash, nativeInputHash: trialNativeInputHash(input), prediction,
    classification: resolvePostScrapeClassification(valid, prediction, { mode: 'policy' }) }
  fs.writeFileSync(path.join(directory, 'corpus.jsonl'), [valid,stale,missing,oversized].map(job => JSON.stringify(job)).join('\n')+'\n')
  for (const id of ['valid','stale']) fs.writeFileSync(path.join(directory, 'classifications', `${id}.json`), JSON.stringify(stored))
  const report = await reportLocalClassificationTrial(directory)
  assert.equal(report.total, 4)
  assert.equal(report.completed, 1)
  assert.equal(report.inputAccountingComplete, false)
  assert.equal(report.fullCorpusTextCovered, false)
  assert.equal(report.classifiedRecordFraction, .25)
  assert.equal(report.acceptedInputCount, 3)
  assert.deepEqual(report.skipReasons, { oversized_description: 1 })
  assert.equal(report.coverageComplete, false)
  assert.deepEqual(report.staleNative, ['stale'])
  assert.deepEqual(report.missing, ['missing'])
  assert.equal(report.skipped[0].reason, 'oversized_description')
  assert.equal(report.inference.meanSeconds, 2)
  assert.equal(report.seconds, 2)
  assert.equal(report.resourceGuardHistory.length,1)
  assert.equal(report.resourceHistory.length,1)
  assert.deepEqual(report.resourcePeaks,{hostCpuPercent:90.7,hostRamPercent:62.5,modelRssBytes:2048,treeRssBytes:8192})
  assert.equal(report.simulatedShards.reduce((total,shard) => total+shard.jobs,0), 1)
  assert.match(fs.readFileSync(path.join(directory, 'FINAL-REPORT.md'), 'utf8'), /^This local trial attempted 100 sources/)
})

test('accounting for every skipped record does not imply that any description was classified', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trial-all-skipped-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  fs.writeFileSync(path.join(directory, 'corpus.jsonl'), JSON.stringify({ trialId: 'empty', title: 'Engineer' })+'\n')
  const report = await reportLocalClassificationTrial(directory)
  assert.equal(report.inputAccountingComplete, true)
  assert.equal(report.coverageComplete, false)
  assert.equal(report.fullCorpusTextCovered, false)
  assert.equal(report.classifiedRecordFraction, 0)
  assert.equal(report.acceptedInputCount, 0)
  assert.deepEqual(report.skipReasons, { missing_description: 1 })
  assert.equal(report.inference.meanSeconds, null)
  assert.ok(report.projections.every(row => row.oneCpuInferenceHours === null))
  assert.match(fs.readFileSync(path.join(directory, 'FINAL-REPORT.md'), 'utf8'), /Classified records: 0\/1/)
})

test('resource sampling corrections qualify matching archived readings without hiding their peaks', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trial-resource-notes-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  fs.writeFileSync(path.join(directory, 'corpus.jsonl'), JSON.stringify({ trialId: 'empty', title: 'Engineer' })+'\n')
  const history = path.join(directory, 'resume-history', 'startup-stop')
  fs.mkdirSync(history, { recursive: true })
  const stopped = JSON.stringify({ ownerPid: 123, samples: 1, peakCpuPercent: 100, peakRamPercent: 44, status: 'stopped_resource_limit' })
  fs.writeFileSync(path.join(history, 'resource-guard.json'), stopped)
  const guardSha256 = createHash('sha256').update(stopped).digest('hex')
  fs.writeFileSync(path.join(directory, 'resource-measurement-notes.json'), JSON.stringify({ notes: [
    { guardSha256, kind: 'startup_cpu_sample_without_interval' },
    { guardSha256: '0'.repeat(64), kind: 'startup_cpu_sample_without_interval' },
  ] }))
  const report = await reportLocalClassificationTrial(directory)
  assert.equal(report.resourcePeaks.hostCpuPercent, 100)
  assert.equal(report.resourceMeasurementNotes.length, 1)
  assert.equal(report.resourceMeasurementNotes[0].ownerPid, 123)
  assert.equal(report.resourceMeasurementNotes[0].guardSha256, guardSha256)
  const markdown = fs.readFileSync(path.join(directory, 'FINAL-REPORT.md'), 'utf8')
  assert.match(markdown, /does not establish sustained CPU usage/)
  assert.match(markdown, /100\.0%/)
})

test('matching input hashes cannot turn corrupt native scores or timings into complete coverage', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trial-corrupt-native-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  fs.mkdirSync(path.join(directory, 'classifications'))
  const source = { title: 'Engineer', sourceDescription: 'Minimum 3 years of professional experience required.' }
  const input = postScrapeInput(source)
  const prediction = { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 2,
    scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 },
    seconds: 2, cpuSeconds: 1.9, peakRssBytes: 1024 }
  const record = { inputHash: input.inputHash, nativeInputHash: trialNativeInputHash(input), prediction,
    classification: resolvePostScrapeClassification(source, prediction, { mode: 'policy' }) }
  const corruptions = {
    'missing-class': p => { delete p.scores.Contract },
    'extra-class': p => { p.scores.Unknown = 0 },
    'unnormalized-scores': p => { p.scores['Full-time Experienced'] = .3 },
    'wrong-top-label': p => { p.modelLabel = 'Intern' },
    'string-coverage': p => { p.fullDescriptionCovered = 'true' },
    'negative-wall-time': p => { p.seconds = -2 },
    'missing-cpu-time': p => { delete p.cpuSeconds },
    'string-memory': p => { p.peakRssBytes = '1024' },
  }
  const ids = ['valid', ...Object.keys(corruptions)]
  fs.writeFileSync(path.join(directory, 'corpus.jsonl'), ids.map(trialId => JSON.stringify({ ...source, trialId })).join('\n')+'\n')
  for (const id of ids) {
    const stored = structuredClone(record)
    corruptions[id]?.(stored.prediction)
    fs.writeFileSync(path.join(directory, 'classifications', `${id}.json`), JSON.stringify(stored))
  }
  const report = await reportLocalClassificationTrial(directory)
  assert.equal(report.total, ids.length)
  assert.equal(report.completed, 1)
  assert.equal(report.coverageComplete, false)
  assert.equal(report.inputAccountingComplete, false)
  assert.deepEqual(report.staleNative, Object.keys(corruptions))
  assert.equal(report.seconds, 2)
  assert.equal(report.cpuSeconds, 1.9)
  assert.equal(report.inference.meanSeconds, 2)
  assert.ok(report.projections.every(row => Number.isFinite(row.oneCpuInferenceHours)))
})
