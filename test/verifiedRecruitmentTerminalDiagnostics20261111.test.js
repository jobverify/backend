import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { getScraperCatalog, decorateJobsWithProviderMetadata } from '../scraper-support/providers/index.js'
import { runRecruitmentBatchSource } from '../scraper-support/utils/recruitmentBatch20261103.js'
import { RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
import { buildScraperAttemptDiagnostics, resolveZeroJobOutcome } from '../scraper-support/runner.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { finishScraperProcessing, inventoryCleanupOptions } from '../scraper-support/utils/scraperOutcome.js'
import { saveRawSourceCapture } from '../scraper-support/utils/rawCapture.js'
import { openRunCheckpoint } from '../scraper-support/utils/runCheckpoint.js'

const provider = getScraperCatalog().find(row => row.source === 'bayer')
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-eightfold-classic-20261111.json.gz', import.meta.url))))
const packets = new Map()
for (const row of fixture.responses) {
  const bytes = Buffer.from(row.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), row.bodySHA256)
  const rows = packets.get(row.requestedURL) || []
  rows.push({ ...row, body: bytes.toString('utf8') }); packets.set(row.requestedURL, rows)
}
const ownURL = 'https://talent.bayer.com/api/apply/v2/jobs/562949978833200?domain=bayer.com'
const secret = 'SYNTHETIC_TERMINAL_DIAGNOSTIC_SECRET'
const observe = async (t, kind) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Diagnostic fixture forbids uncontrolled HTTP'))
  const counts = new Map()
  const jobs = await runRecruitmentBatchSource('bayer', {
    maxPages: 2, maxDetails: 1, maxRequests: 16, now: () => '2026-11-11T06:40:00.000Z',
    fetchImpl: async (url, init) => {
      const index = counts.get(url) || 0, row = packets.get(url)?.[index]
      assert.ok(row, 'Only captured current public reads are allowed: ' + url)
      counts.set(url, index + 1)
      assert.equal(init.method || 'GET', 'GET')
      let body = row.body
      if (url === ownURL) {
        if (kind === 'transport') throw Object.assign(new Error('Native read failed Authorization: Bearer ' + secret
          + ' https://user:' + secret + '@talent.bayer.com/private?token=' + secret), { code: 'ECONNRESET' })
        if (kind === 'semantic') body = JSON.stringify({ ...JSON.parse(body), unreviewedContractField: true })
      }
      const response = new Response(body, { status: row.status, headers: { 'content-type': row.contentType } })
      Object.defineProperty(response, 'url', { value: row.finalURL })
      return response
    },
  })
  return decorateJobsWithProviderMetadata(jobs, provider)
}

for (const kind of ['semantic', 'transport']) test('bounded ' + kind + ' failure context survives real terminal, checkpoint and raw capture serialization', async t => {
  const jobs = await observe(t, kind), observations = jobs[RECRUITMENT_OBSERVATIONS]
  assert.equal(jobs.length, 0)
  assert.equal(observations.nativeRecords, 10)
  assert.equal(observations.failures.length, 1)
  const failure = observations.failures[0], evidence = readInventoryEvidence(jobs)
  assert.equal(failure.stage, 'native-eightfold')
  assert.ok(!JSON.stringify(failure).includes(secret), 'The existing producer must sanitize the original diagnostic')
  assert.ok(evidence.reason.includes(failure.message), 'Retain the real validation or transport cause when returning an observed coverage gap')
  assert.ok(evidence.reason.includes('native-eightfold'))
  assert.ok(evidence.reason.length <= 1600)
  if (kind === 'transport') {
    assert.equal(failure.code, 'ECONNRESET')
    assert.ok(evidence.reason.includes('ECONNRESET'))
    assert.ok(evidence.reason.includes('/api/apply/v2/jobs/562949978833200'))
  } else assert.equal(failure.requestUrl, undefined, 'A semantic guard must not invent a failed request URL')

  const directory = mkdtempSync(join(tmpdir(), 'recruitment-terminal-diagnostics-'))
  t.after(() => {
    const target = resolve(directory)
    assert.equal(dirname(target), resolve(tmpdir()))
    assert.match(basename(target), /^recruitment-terminal-diagnostics-/)
    rmSync(target, { recursive: true, force: true })
  })
  const result = finishScraperProcessing({ success: true,
    ...buildScraperAttemptDiagnostics(jobs, undefined, provider),
    zeroJobEvidence: resolveZeroJobOutcome({ provider }, jobs, []),
  })
  assert.equal(result.success, false)
  assert.equal(result.failureKind, 'coverage_gap')
  assert.equal(result.softFailure, true)
  assert.equal(result.partial, true)
  assert.equal(result.processingComplete, true)
  assert.equal(result.rawRecords, 10)
  assert.equal(result.jobs, 0)
  assert.equal(result.inventoryEvidence.listingComplete, false)
  assert.equal(result.inventoryEvidence.reportedTotal, null)
  assert.deepEqual(inventoryCleanupOptions(result), { replaceExisting: false })
  const checkpoint = openRunCheckpoint({ filePath: join(directory, 'checkpoint.json'), sources: ['bayer'],
    mode: 'dry-run', parallel: false, now: () => new Date('2026-11-11T06:40:00.000Z') })
  checkpoint.markSourceCompleted('bayer', result)
  const rawFile = await saveRawSourceCapture(jobs, { directory: join(directory, 'raw'), source: 'bayer',
    dryRun: true, now: new Date('2026-11-11T06:40:00.000Z') })
  const stored = JSON.parse(readFileSync(join(directory, 'checkpoint.json'), 'utf8'))
  const raw = JSON.parse(readFileSync(rawFile, 'utf8'))
  for (const output of [result, stored.completed.bayer.result, raw]) {
    const serialized = JSON.stringify(output)
    assert.ok(serialized.includes(failure.message), 'The real serialization boundary must retain the original sanitized cause')
    assert.ok(serialized.includes('native-eightfold'))
    assert.ok(!serialized.includes(secret))
    assert.equal(output.inventoryEvidence.listingComplete, false)
  }
})

test('a zero-failure recruitment result retains its existing inventory reason and source holds', async t => {
  const jobs = await observe(t, 'none')
  assert.equal(jobs.length, 1)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].failures.length, 0)
  assert.equal(readInventoryEvidence(jobs).reason,
    'runtime-first-party-recruitment;source-scope-unverified;cleanup-forbidden;failures=0')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})
