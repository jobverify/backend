import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { refreshTrialClassificationPolicy } from '../scripts/refreshTrialClassificationPolicy.js'
import { trialNativeInputHash } from '../scripts/trialNativePredictionCache.js'
import { postScrapeInput } from '../src/services/postScrapeClassification.js'

test('policy refresh preserves valid native predictions and rejects changed source inputs', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trial-policy-refresh-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  fs.mkdirSync(path.join(directory, 'classifications'))
  const job = { trialId: 'valid', title: 'Customer Support', sourceDescription: 'We are currently hiring fresh graduates. Communication skills required.' }
  const stale = { ...job, trialId: 'stale', sourceDescription: 'Requires 5 years of professional experience.' }
  const prediction = { modelLabel: 'Full-time Experienced', windows: 1, fullDescriptionCovered: true,
    scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 }, seconds: .25 }
  const saved = { inputHash: 'previous-policy-hash', nativeInputHash: trialNativeInputHash(postScrapeInput(job)), prediction }
  fs.writeFileSync(path.join(directory, 'corpus.jsonl'), [job, stale].map(value => JSON.stringify(value)).join('\n')+'\n')
  for (const id of ['valid', 'stale']) fs.writeFileSync(path.join(directory, 'classifications', `${id}.json`), JSON.stringify(saved))
  const result = await refreshTrialClassificationPolicy(directory)
  assert.equal(result.refreshed, 1)
  assert.equal(result.staleNative, 1)
  const updated = JSON.parse(fs.readFileSync(path.join(directory, 'classifications/valid.json')))
  assert.deepEqual(updated.prediction, prediction)
  assert.equal(updated.classification.resolved.jobType, 'Full-time Fresher')
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'classifications/stale.json'))).inputHash, 'previous-policy-hash')
  assert.equal((await refreshTrialClassificationPolicy(directory)).current, 1)
})
