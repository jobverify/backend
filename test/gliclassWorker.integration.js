import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startGliclassWorker } from '../scripts/gliclassWorker.js'

test('offline GLiClass receives Unicode job text without corrupting the Windows pipe', {
  skip: !process.env.GLICLASS_MODEL_DIRECTORY,
  timeout: 180000,
}, async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gliclass-unicode-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const worker = await startGliclassWorker({ logFile: path.join(directory, 'worker.log') })
  t.after(() => worker.stop())
  assert.ok(worker.configuration.cpuThreads >= 1 && worker.configuration.cpuThreads <= 4)
  assert.ok(worker.configuration.cpuThreads <= worker.configuration.availableCpus)
  const prediction = await worker.classify({ inputHash: 'unicode-regression',
    title: 'Software Engineer in Karnātaka',
    body: 'Full-time engineering position. Minimum 5 years of professional software development experience required.',
    sourceEmploymentType: 'Full time',
  })
  assert.equal(prediction.fullDescriptionCovered, true)
  assert.equal(prediction.windows, 1)
  assert.equal(Object.keys(prediction.scores).length, 4)
})
