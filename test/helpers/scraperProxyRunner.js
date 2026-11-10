import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const endpoint = new URL(process.argv[2])
assert.equal(endpoint.protocol, 'http:')
assert.equal(endpoint.hostname, '127.0.0.1')
assert.equal(endpoint.username + endpoint.password, '')
// Exercise the real runner, filtering and local snapshot persistence without a database.
process.argv.push('--dry-run')
process.env.SCRAPER_RAW_CAPTURE_DIRECTORY = ''
process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY = ''
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'scraper-proxy-runner-'))
const snapshotFile = path.join(directory, 'jobs.json')
const originalLog = console.log
console.log = (...args) => console.error(...args)
try {
  const { runAll } = await import('../../scraper-support/runner.js')
  const scraper = {
    name: 'proxy-fixture',
    dryRunFile: snapshotFile,
    provider: { source: 'proxy-fixture', adapter: 'script', dryRunEnrichPublicExperience: false },
    async run({ signal }) {
      const response = await fetch(endpoint, { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) })
      assert.equal(response.ok, true)
      assert.equal((await response.json()).ok, true)
      return [{
        jobId: 'proxy-role', title: 'Engineer', company: 'Fixture', location: 'Bengaluru, India',
        applyUrl: 'https://example.test/jobs/proxy-role', description: 'Build and maintain software for customers.',
      }]
    },
  }
  const summary = await runAll({ preparedRun: { scrapers: [scraper], checkpoint: null, summary: {}, resumeMessage: null } })
  const savedJobs = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'))
  assert.ok(Array.isArray(savedJobs))
  process.stdout.write(JSON.stringify({ saves: savedJobs.length, summary }) + '\n')
} finally {
  console.log = originalLog
  assert.equal(path.dirname(directory), path.resolve(os.tmpdir()))
  assert.match(path.basename(directory), /^scraper-proxy-runner-/)
  fs.rmSync(directory, { recursive: true, force: true })
}
