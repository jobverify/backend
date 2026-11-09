import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { compactTrialJob, writeTrialCorpus, readTrialCorpusJobs, readPrioritizedTrialCorpusJobs } from '../scripts/trialCorpusArchive.js'
import { postScrapeInput } from '../src/services/postScrapeClassification.js'

test('one complete employer description preserves classification inputs while removing repeated aliases', () => {
  const job = { trialId: '1', title: 'Engineer', sourceEmploymentType: 'Full time',
    sourceDescription: '<p>Work in Karnātaka. Minimum 3 years of experience.</p>',
    description: 'Public formatted version.', jobDescription: 'Alternate provider description.',
    minimumQualification: 'Engineering degree.', preferredQualification: 'Masters preferred.',
  }
  const compact = compactTrialJob(job)
  assert.equal(compact.sourceDescription, '<p>Work in Karnātaka. Minimum 3 years of experience.</p>')
  assert.equal(Object.hasOwn(compact, 'description'), false)
  assert.equal(Object.hasOwn(compact, 'jobDescription'), false)
  assert.equal(postScrapeInput(compact).inputHash, postScrapeInput(job).inputHash)
  assert.equal(job.description, 'Public formatted version.')
})

test('streamed corpus records round-trip long Unicode descriptions and preserve their count', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trial-archive-'))
  assert.equal(path.dirname(directory), os.tmpdir())
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const body = 'Karnātaka — engineering requirements.\nSecond line\u2028same JSON record\u2029still the same record.\n'.repeat(4000)
  const jobs = [{ trialId: 'first', title: 'Engineer', sourceDescription: body },
    { trialId: 'second', title: 'Intern', jobDescription: 'Complete internship description.' }]
  writeTrialCorpus(directory, jobs, { modelRevision: 'test' })
  const restored = []
  for await (const job of readTrialCorpusJobs(directory)) restored.push(job)
  assert.equal(restored.length, 2)
  assert.equal(restored[0].sourceDescription, body)
  assert.equal(restored[1].sourceDescription, 'Complete internship description.')
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'corpus-manifest.json'))).jobCount, 2)
  const prioritized = []
  for await (const job of readPrioritizedTrialCorpusJobs(directory, ['second', 'second', 'missing'])) prioritized.push(job)
  assert.deepEqual(prioritized.map(job => job.trialId), ['second', 'first'])
  assert.equal(prioritized[1].sourceDescription, body)
})
