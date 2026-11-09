import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { resolveClassification } from '../src/services/jobClassificationPolicy.js'
import { postScrapeInput, resolvePostScrapeClassification, sourceGuardedClassification } from '../src/services/postScrapeClassification.js'
import { readTrialCorpusJobs } from './trialCorpusArchive.js'

const directory = path.resolve(process.argv[2])
const fold = process.argv[3] || 'development'
if (!['development', 'holdout', 'all'].includes(fold)) throw new Error('Invalid review split')
const packet = JSON.parse(fs.readFileSync(path.join(directory, 'review-source-packet.json')))
const gold = JSON.parse(fs.readFileSync(path.join(directory, 'manual-review.json')))
const wanted = new Set(packet.jobs.map(job => job.trialId || `${job.source}\0${job.url}`))
const corpus = []
for await (const job of readTrialCorpusJobs(directory)) {
  if (wanted.has(job.trialId) || wanted.has(`${job.source}\0${job.sourceUrl}`)) corpus.push(job)
}
const rows = []
for (const reviewed of gold.labels.filter(row => fold === 'all' || row.split === fold)) {
  const original = packet.jobs.find(row => row.id === reviewed.id)
  const job = original.trialId ? corpus.find(row => row.trialId === original.trialId)
    : corpus.find(row => row.source === original.source && row.sourceUrl === original.url)
  if (!job) throw new Error(`Review job missing: ${reviewed.id}`)
  const file = path.join(directory, 'classifications', `${job.trialId}.json`)
  let stored
  try { stored = JSON.parse(fs.readFileSync(file)) } catch {}
  if (stored?.inputHash !== postScrapeInput(job).inputHash) stored = null
  const baseline = resolveClassification(job, null, { mode: 'policy' }).resolved.jobType
  const guardedSourcePolicy = sourceGuardedClassification(job, { mode: 'policy' }).resolved.jobType
  const focused = stored?.prediction.focusedScores && Object.entries(stored.prediction.focusedScores).sort((a,b) => b[1]-a[1])[0][0]
  const hybrid = stored && resolvePostScrapeClassification(job, stored.prediction, { mode: 'policy' }).resolved.jobType
  rows.push({ ...reviewed, title: original.title, source: original.source, baseline, guardedSourcePolicy,
    model: stored?.prediction.modelLabel || null, focused: focused || null, hybrid: hybrid || null })
}
const eligible = rows.filter(row => ['Intern', 'Contract', 'Full-time Fresher', 'Full-time Experienced'].includes(row.label))
const stats = predictor => {
  const available = eligible.filter(row => row[predictor])
  return { reviewed: eligible.length, evaluated: available.length,
    correct: available.filter(row => row[predictor] === row.label).length,
    accuracy: available.length ? available.filter(row => row[predictor] === row.label).length/available.length : null,
    perClass: Object.fromEntries(['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract'].map(label => {
      const group = available.filter(row => row.label === label)
      return [label, { support: group.length, correct: group.filter(row => row[predictor] === label).length }]
    })),
  }
}
const result = { split: fold, reviewHash: createHash('sha256').update(JSON.stringify(gold)).digest('hex'),
  method: packet.method, excluded: rows.length - eligible.length,
  baseline: stats('baseline'), guardedSourcePolicy: stats('guardedSourcePolicy'), model: stats('model'), focused: stats('focused'), hybrid: stats('hybrid'), rows }
fs.writeFileSync(path.join(directory, `quality-${fold}.json`), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
