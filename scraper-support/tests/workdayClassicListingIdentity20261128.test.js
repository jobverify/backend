import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { runWorkdayScraper } from '../myworkday/engine.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/workdayBlueOriginOrphan20261128.json.gz', import.meta.url))))
const capturedRows = JSON.parse(capture.body).jobPostings
const orphan = capturedRows.find(row => row.title == null && row.externalPath == null)
const BOARD = 'https://classic-identity.wd103.myworkdayjobs.com/Careers'
const API = 'https://classic-identity.wd103.myworkdayjobs.com/wday/cxs/classic-identity/Careers/jobs'
const nativeIndia = { title: 'Software Engineer', externalPath: '/job/Bengaluru/Software-Engineer_R1',
  locationsText: 'Bengaluru, India', bulletFields: ['R1'], postedOn: 'Posted Today' }
const nativeForeign = { title: 'Service Engineer', externalPath: '/job/London/Service-Engineer_R2',
  locationsText: 'London, United Kingdom', bulletFields: ['R2'], postedOn: 'Posted Today' }

// The full captured response is genuine. Small listing envelopes, known rows
// and malformed variations below are explicitly synthetic protocol controls.
function exercise(t, batches) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workday-classic-identity-'))
  t.after(() => {
    const resolved = fs.realpathSync(directory)
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(resolved).startsWith('workday-classic-identity-'))
    fs.rmSync(resolved, { recursive: true })
  })
  fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({
    listingStrategy: 'jobs-api', jobsApiUrl: API, detailUrlBase: BOARD,
    locationCountry: null, searchText: '', workdayMaxPages: 5, detailEnrichmentBudgetMs: 1000,
  }))
  let passes = 0, details = 0
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input)
    let response
    if (init.method === 'POST') {
      assert.equal(url, API)
      const request = JSON.parse(init.body)
      assert.equal(request.offset, 0, 'all explicitly small protocol controls fit one page')
      const rows = batches[Math.min(passes++, batches.length - 1)]
      response = Response.json({ total: rows.length, jobPostings: rows })
    } else if (url.includes('/wday/cxs/') && url.includes('/job/')) {
      assert.equal(url, API.slice(0, -5) + nativeIndia.externalPath)
      details++
      response = Response.json({ jobPostingInfo: { title: nativeIndia.title, jobReqId: 'R1',
        location: 'Bengaluru, India', country: { alpha2Code: 'IN' },
        externalUrl: BOARD + nativeIndia.externalPath, startDate: '2026-11-27',
        jobDescription: '<p>Build reliable software and maintain distributed services. Two years of professional experience required.</p>' } })
    } else {
      assert.equal(url, BOARD, 'malformed and explicit foreign rows cannot start detail or unrelated reads')
      response = new Response('<html>Anonymous classic Workday bootstrap control</html>', { headers: { 'content-type': 'text/html' } })
    }
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  return { passes: () => passes, details: () => details,
    run: () => runWorkdayScraper({ source: 'classic-identity', company: 'Classic Identity',
      baseUrl: BOARD, scraperDir: directory, boardIdentityVerified: true, nativeDetailRecovery: false,
      requestTimeoutMs: 1000, retryBaseDelayMs: 0,
      requestScheduler: { acquire: async () => () => {}, recordRateLimit() {} } }) }
}
async function rejectsIdentity(operation, reason, rowIndex = 0, externalPath = null) {
  await assert.rejects(operation.run(), error => {
    assert.equal(error.name, 'WorkdayIncompleteListingError')
    assert.equal(error.failureKind, 'parser_or_contract_error')
    assert.equal(error.abortRetries, true)
    assert.notEqual(error.softFailure, true)
    assert.deepEqual(error.listingIdentity, { reason, board: BOARD, rowIndex, externalPath })
    assert.doesNotMatch(error.message, /(?:payload|query|fragment)-must-stay-private/)
    return true
  })
  assert.equal(operation.passes(), 2, 'at most one fresh whole-pass retry')
  assert.equal(operation.details(), 0, 'identity uncertainty stops before native role hydration')
}

test('the complete genuine BlueOrigin response retains its captured hash and identity-less row', () => {
  assert.equal(capture.source, 'blueorigin')
  assert.equal(capture.status, 200)
  assert.equal(capture.requestedUrl, capture.url)
  assert.equal(capture.packetIndex0, 146)
  assert.equal(createHash('sha256').update(capture.body).digest('hex'), capture.sha256)
  assert.equal(capture.sha256, '9f0d190466b3a09bd57c4378beff73a1114d69e63c8f7570e6c0df463eaed807')
  assert.equal(capturedRows.length, 20)
  assert.deepEqual(orphan, { bulletFields: ['R74450'] })
})
test('a genuine classic orphan cannot become an authoritative successful zero', async t => {
  await rejectsIdentity(exercise(t, [[orphan]]), 'missing-title')
})
for (const [label, edit, reason, expectedPath] of [
  ['missing title', row => { delete row.title }, 'missing-title', nativeForeign.externalPath],
  ['blank title', row => { row.title = '' }, 'missing-title', nativeForeign.externalPath],
  ['whitespace title', row => { row.title = ' \t ' }, 'missing-title', nativeForeign.externalPath],
  ['nonstring title', row => { row.title = { private: 'payload-must-stay-private' } }, 'missing-title', nativeForeign.externalPath],
  ['missing path', row => { delete row.externalPath }, 'invalid-external-path', null],
  ['blank path', row => { row.externalPath = '' }, 'invalid-external-path', null],
  ['whitespace path', row => { row.externalPath = '\t ' }, 'invalid-external-path', null],
  ['nonstring path', row => { row.externalPath = { private: 'payload-must-stay-private' } }, 'invalid-external-path', null],
  ['null path', row => { row.externalPath = null }, 'invalid-external-path', null],
  ['foreign absolute path', row => { row.externalPath = 'https://foreign.invalid/job/London/Engineer_R1?query-must-stay-private' }, 'invalid-external-path', null],
  ['non-HTTP path', row => { row.externalPath = 'javascript:payload-must-stay-private' }, 'invalid-external-path', null],
  ['non-native relative path', row => { row.externalPath = '/careers' }, 'invalid-external-path', null],
  ['other-board absolute path', row => { row.externalPath = 'https://classic-identity.wd103.myworkdayjobs.com/Other/job/London/Engineer_R1' }, 'invalid-external-path', null],
  ['non-HTTPS absolute path', row => { row.externalPath = 'http://classic-identity.wd103.myworkdayjobs.com/Careers/job/London/Engineer_R1' }, 'invalid-external-path', null],
  ['credentialed absolute path', row => { row.externalPath = 'https://payload-must-stay-private@classic-identity.wd103.myworkdayjobs.com/Careers/job/London/Engineer_R1' }, 'invalid-external-path', null],
  ['malformed URL path', row => { row.externalPath = 'https://[' }, 'invalid-external-path', null],
  ['fragment-bearing native path', row => { row.externalPath += '#fragment-must-stay-private' }, 'invalid-external-path', nativeForeign.externalPath],
  ['normalized-outside-board path', row => { row.externalPath = '/job/../../Other/Engineer_R1' }, 'invalid-external-path', '/job/../../Other/Engineer_R1'],
]) test('classic Workday rejects ' + label + ' even on an explicitly foreign summary', async t => {
  const row = structuredClone(nativeForeign);edit(row)
  await rejectsIdentity(exercise(t, [[row]]), reason, 0, expectedPath)
})
test('classic identity diagnostics retain only the public path when title is missing', async t => {
  await rejectsIdentity(exercise(t, [[{ ...nativeForeign, title: null,
    externalPath: nativeForeign.externalPath + '?query-must-stay-private#fragment-must-stay-private' }]]),
  'missing-title', 0, nativeForeign.externalPath)
})
test('a malformed row after a valid India row cannot leak a partial completed inventory', async t => {
  await rejectsIdentity(exercise(t, [[nativeIndia, orphan]]), 'missing-title', 1)
})
test('one fresh classic pass discards earlier candidates and can recover from a transient orphan', async t => {
  const operation = exercise(t, [[nativeIndia, orphan], [nativeForeign]])
  const jobs = await operation.run()
  assert.equal(operation.passes(), 2)
  assert.equal(operation.details(), 0)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
})
test('valid classic India native detail and explicit foreign exclusion retain existing behavior', async t => {
  const operation = exercise(t, [[nativeIndia, nativeForeign]])
  const jobs = await operation.run()
  assert.equal(operation.passes(), 1)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, nativeIndia.title)
  assert.match(jobs[0].location, /India/)
  assert.match(jobs[0].jobDescription, /Build reliable software/)
  assert.ok(operation.details() > 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
})
for (const [label, externalPath] of [
  ['missing optional native slug', '/job/_JR-2023-01064-1'],
  ['native path ending in underscore', '/job/Hyderabad-India---Office/Senior-Software-Engineer---Front-End--Angular-TypeScript-_'],
]) test('safe native publisher path shape remains supported: ' + label, async t => {
  // Actual path shapes from saved Covestro/Elemica responses; the foreign
  // summary and one-row envelope are explicit synthetic geography controls.
  const operation = exercise(t, [[{ ...nativeForeign, externalPath }]])
  const jobs = await operation.run()
  assert.equal(operation.passes(), 1)
  assert.equal(operation.details(), 0)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
})

test('a true classic zero without India-facet authority remains unverified and unsuccessful', async t => {
  const jobs = await exercise(t, [[]]).run()
  const assessment = assessSoftFailureAcquisition({ source: 'classic-identity' }, jobs)
  assert.equal(jobs.length, 0)
  assert.equal(assessment.inventoryEvidence.status, 'unverified')
  assert.equal(assessment.runnerOutcome.success, false)
})
