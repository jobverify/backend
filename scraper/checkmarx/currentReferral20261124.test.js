import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { parseCheckmarxBoard } from './nativeContract.js'
import { readNativeData } from './nativeData.js'
import { run } from './script.js'
import { PROVIDER_METADATA } from './catalog.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-referral-20261124.json.gz', import.meta.url))))
const html = Buffer.from(capture.responses[0].bodyBase64, 'base64').toString('utf8')
const rows = readNativeData(html, 'COMPANY_POSITIONS_DATA')
const options = { now: capture.completedAt }

function changeRow(id, mutate) {
  return html.replace(/(\bCOMPANY_POSITIONS_DATA\s*=\s*)([^\r\n]+)/, (_match, prefix, line) => {
    const next = structuredClone(rows)
    mutate(next.find(row => row.uid === id))
    return prefix + JSON.stringify(next).replaceAll('<', '\\u003C').replaceAll('>', '\\u003E') + (line.match(/[,;]\s*$/)?.[0] || '')
  })
}

function changeOfficialURL(row, mutate) {
  const url = new URL(row.url_active_page)
  mutate(url)
  row.url_active_page = url.href
  row.url_detected_page = url.href
}

test('current public referral flags preserve the live Checkmarx board and query-free India identity', () => {
  const board = parseCheckmarxBoard(html, options)
  assert.equal(board.rows.length, 22)
  assert.deepEqual(board.rows, rows)
  const india = board.rows.find(row => row.uid === '5D.474')
  assert.equal(india.location.country, 'IN')
  assert.equal(india.is_internal, false)
  assert.equal(new URL(india.url_comeet_hosted_page).search, '')
  assert.equal(new URL(india.url_active_page).search, '?1794383627636&employeeShare')
  assert.equal(board.companyIndiaTotal, null)
})

for (const [label, mutate] of [
  ['an assigned clock value', url => { url.search = '?1794383627636=true&employeeShare' }],
  ['an assigned employee flag', url => { url.search = '?1794383627636&employeeShare=true' }],
  ['an extra unqualified query', url => { url.search += '&unqualified=true' }],
  ['a different official role', url => { url.pathname = '/job-openings/position/00.000' }],
  ['a foreign publisher', url => { url.hostname = 'unrelated.invalid' }],
]) {
  test('current India referral still rejects ' + label, () => {
    assert.throws(() => parseCheckmarxBoard(changeRow('5D.474', row => changeOfficialURL(row, mutate)), options), /Checkmarx native contract:/)
  })
}

test('current original workflow recovers two complete eligible India roles without granting inventory cleanup', async () => {
  const workflow = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-workflow-20261124.json.gz', import.meta.url))))
  const visits = new Map()
  const jobs = await run({
    now: workflow.completedAt,
    fetchImpl: async (url, init) => {
      assert.equal(init.method ?? 'GET', 'GET')
      assert.equal(init.body, undefined)
      const index = visits.get(url) ?? 0
      const packet = workflow.responses.filter(row => row.requestedURL === url)[index]
      assert.ok(packet, 'Only original captured public native reads are allowed: ' + url)
      visits.set(url, index + 1)
      return Object.defineProperty(new Response(Buffer.from(packet.bodyBase64, 'base64'), {
        status: packet.status, headers: packet.headers,
      }), 'url', { value: packet.url })
    },
  })
  assert.equal([...visits.values()].reduce((total, count) => total + count, 0), 4)
  assert.deepEqual(jobs.map(job => job.jobId), ['5D.474', 'C7.471'])
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete && !job.activeApplyVerified))
  const assessment = assessSoftFailureAcquisition(PROVIDER_METADATA, jobs)
  assert.equal(assessment.eligibleJobs, 2)
  assert.equal(assessment.runnerOutcome.success, true)
  assert.equal(assessment.inventoryEvidence.listingComplete, false)
  assert.deepEqual(assessment.cleanupOptions, { replaceExisting: false })
  assert.equal(jobs.nativeCollectionEvidence.openingNativeRows.length, 22)
  assert.deepEqual(jobs.nativeCollectionEvidence.openingNativeRows, jobs.nativeCollectionEvidence.closingNativeRows)
})

for (const [label, mutate] of [
  ['a changed opaque query', row => changeOfficialURL(row, url => { url.search = '?-other' })],
  ['a changed country', row => { row.location.country = 'SG' }],
  ['employee-only visibility', row => { row.is_internal = true }],
]) {
  test('reviewed current foreign referral still rejects ' + label, () => {
    assert.throws(() => parseCheckmarxBoard(changeRow('35.27F', mutate), options), /Checkmarx native contract:/)
  })
}
