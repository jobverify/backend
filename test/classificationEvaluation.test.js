import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

test('quality evaluation excludes stale predictions instead of reporting them as current model accuracy', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'classification-evaluation-'))
  assert.equal(path.dirname(directory), os.tmpdir())
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const job = { trialId: 'vacancy-1', source: 'company', title: 'Engineer',
    sourceUrl: 'https://example.com/role', sourceEmploymentType: 'Full time',
    sourceDescription: 'At least 5 years of professional engineering experience required.' }
  fs.mkdirSync(path.join(directory, 'classifications'))
  for (const [name, data] of Object.entries({
    'corpus.json': { jobs: [job] },
    'review-source-packet.json': { method: 'Test source-only review', jobs: [{ id: 'review-1', title: 'Engineer', source: 'company', url: job.sourceUrl }] },
    'manual-review.json': { labels: [{ id: 'review-1', split: 'holdout', label: 'Full-time Experienced' }] },
    'classifications/vacancy-1.json': { inputHash: 'old-input', prediction: {
      modelLabel: 'Intern', windows: 1, fullDescriptionCovered: true,
      scores: { 'Full-time Experienced': .01, 'Full-time Fresher': .01, Intern: .97, Contract: .01 },
    } },
  })) fs.writeFileSync(path.join(directory, name), JSON.stringify(data))
  const result = spawnSync(process.execPath, ['scripts/evaluatePostScrapeClassification.js', directory, 'holdout'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const quality = JSON.parse(fs.readFileSync(path.join(directory, 'quality-holdout.json')))
  assert.equal(quality.baseline.correct, 1)
  assert.equal(quality.model.evaluated, 0)
  assert.equal(quality.model.accuracy, null)
})
