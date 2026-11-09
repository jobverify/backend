import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { saveDryRunSnapshot } from '../utils/saveToDB.js'

for (const targeted of [false, true]) {
  test('dry-run cancellation prevents writes after ' + (targeted ? 'targeted' : 'full') + ' enrichment', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-dry-cancel-'))
    const output = path.join(dir, 'jobs.json')
    const controller = new AbortController()
    const reason = new Error('source lifecycle expired')
    const job = { title: 'Cloud Engineer', company: 'Example', location: 'Pune, India', sourceUrl: 'https://careers.jobverify.dev/jobs/42', applyUrl: 'https://careers.jobverify.dev/jobs/42' }
    try {
      await assert.rejects(saveDryRunSnapshot([job], output, {
        signal: controller.signal, useBrowserFallback: false,
        ...(targeted ? { maxJobsToEnrich: 1 } : {}),
        fetchText: async () => { controller.abort(reason); return '<h1>Cloud Engineer</h1><p>Experience: 4 years</p>' },
      }), reason)
      assert.equal(fs.existsSync(output), false)
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  })
}
