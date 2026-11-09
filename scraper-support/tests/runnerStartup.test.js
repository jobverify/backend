import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as runner from '../runner.js'
import { MongoRunLeaseHeldError } from '../utils/runLease.js'

const sources = [{ name: 'alpha' }, { name: 'beta' }]
const prepare = options => {
  assert.equal(typeof runner.prepareScraperRun, 'function', 'startup can prepare recovery state before acquiring the lease')
  return runner.prepareScraperRun({ scrapers: sources, runId: 'startup-test', ...options })
}
const stop = (error, options) => {
  assert.equal(typeof runner.finishStoppedScraperRun, 'function', 'stopped startup has a structured summary')
  return runner.finishStoppedScraperRun(error, options)
}
const directoryFor = async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scraper-startup-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  return directory
}

test('preparing a run writes an ordered checkpoint before any source execution', async t => {
  const directory = await directoryFor(t)
  const checkpointFile = path.join(directory, 'run-state.json')
  const prepared = prepare({ checkpointFile })
  const state = JSON.parse(await fs.readFile(checkpointFile, 'utf8'))
  assert.deepEqual(state.catalogSources, ['alpha', 'beta'])
  assert.equal(state.remainingCount, 2)
  assert.equal(state.runId, 'startup-test')
  assert.deepEqual(prepared.summary, {})
  assert.deepEqual(prepared.scrapers.map(value => value.name), ['alpha', 'beta'])
})

test('lease contention preserves resumed results and records the real remaining work', async t => {
  const directory = await directoryFor(t)
  const checkpointFile = path.join(directory, 'run-state.json')
  prepare({ checkpointFile }).checkpoint.markSourceCompleted('alpha', { success: true, inserted: 2, jobs: 2 })
  const prepared = prepare({ checkpointFile })
  const error = new MongoRunLeaseHeldError({ ownerId: 'other-owner', runId: 'other-run', hostname: 'other-host', pid: 42, expiresAt: new Date('2026-11-01T06:00:00Z') })
  const summary = stop(error, prepared)
  assert.equal(summary.stopReason, 'run_lease_held')
  assert.equal(summary.retryable, true)
  assert.equal(summary.checkpointRetained, true)
  assert.equal(summary.pendingEstimate, 1)
  assert.equal(summary.scanned, 1)
  assert.equal(summary.inserted, 2)
  assert.equal(summary.lease.runId, 'other-run')
  const state = JSON.parse(await fs.readFile(checkpointFile, 'utf8'))
  assert.equal(state.status, 'interrupted')
  assert.equal(state.interruptedBy, 'run_lease_held')
  assert.equal(state.completed.alpha.result.inserted, 2)
  assert.equal(state.remainingCount, 1)
})

test('stopped runs distinguish database errors and cancellation and do not invent a checkpoint', () => {
  const unavailable = stop(Object.assign(new Error('offline'), { name: 'MongoNetworkError' }))
  assert.equal(unavailable.stopReason, 'database_unavailable')
  assert.equal(unavailable.checkpointRetained, false)
  assert.equal(unavailable.interrupted, true)
  const cancelled = stop(new Error('shutdown'), { interruptedBy: 'SIGTERM' })
  assert.equal(cancelled.stopReason, 'interrupted')
  assert.equal(cancelled.retryable, true)
})

test('direct CLI persists recovery state and exits 75 when a live owner remains', { timeout: 30000 }, async t => {
  const directory = await directoryFor(t)
  const checkpointFile = path.join(directory, 'run-state.json')
  const summaryFile = path.join(directory, 'summary.json')
  const hook = path.join(directory, 'lease-held.mjs')
  const mongooseUrl = pathToFileURL(fileURLToPath(new URL('../../node_modules/mongoose/index.js', import.meta.url))).href
  await fs.writeFile(hook, `import mongoose from ${JSON.stringify(mongooseUrl)};
mongoose.connect = async () => {
Object.defineProperty(mongoose.connection, 'readyState', { value: 1 });
mongoose.connection.db = { collection(name) {
  if (name !== 'scraper_run_leases') throw new Error('Source database access before acquiring a lease');
  return {
    async findOneAndUpdate() { throw Object.assign(new Error('duplicate key'), { code: 11000 }); },
    async findOne() { return { ownerId: 'other-owner', runId: 'other-run', hostname: 'other-host', pid: 42, expiresAt: new Date(Date.now() + 60000) }; },
    async deleteOne() { throw new Error('Must not release another owner'); },
  };
} };
return mongoose;
};
globalThis.fetch = async () => { throw new Error('Unexpected external request'); };
`)
  const execute = promisify(execFile)
  let failure
  try {
    await execute(process.execPath, ['--import', pathToFileURL(hook).href, fileURLToPath(new URL('../runner.js', import.meta.url)), '--parallel'], {
      cwd: directory, windowsHide: true, timeout: 20000,
      env: { ...process.env, MONGO_URI: 'mongodb://test.invalid/test', SCRAPER_RUN_LEASE: '1', SCRAPER_RUN_LEASE_WAIT_MS: '0',
        SCRAPER_ONLY: 'amdocs,nielseniq', SCRAPER_START_AT: '', SCRAPER_START_AFTER: '', SCRAPER_FIRST_N: '',
        SCRAPER_CHECKPOINT_FILE: checkpointFile, PIPELINE_SUMMARY_FILE: summaryFile },
    })
  } catch (error) { failure = error }
  assert.equal(failure?.code, 75, failure?.stderr)
  assert.match(failure.stderr, /lease/i)
  assert.doesNotMatch(failure.stderr, /Database unavailable/)
  assert.equal(await fs.access(summaryFile).then(() => true, () => false), true, 'startup writes the interrupted pipeline summary')
  const summary = JSON.parse(await fs.readFile(summaryFile, 'utf8'))
  assert.equal(summary.stopReason, 'run_lease_held')
  assert.equal(summary.scanned, 0)
  assert.equal(summary.pendingEstimate, 2)
  assert.equal(summary.checkpointRetained, true)
  const state = JSON.parse(await fs.readFile(checkpointFile, 'utf8'))
  assert.equal(state.status, 'interrupted')
  assert.equal(state.totalSources, 2)
  assert.equal(state.remainingCount, 2)
})
