import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCargillPage, parseCargillOfficialRole, parseCargillRmkDetail } from './nativeContract.js'
import { parseCargillAtStage } from './nativeErrors.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261021.json.gz', import.meta.url))))
const now = '2026-10-21T03:00:00Z'
const row = parseCargillPage(fixture.pages[0], 1, 81).jobs[0]
const native = fixture.roles[0].native
const official = parseCargillOfficialRole(fixture.roles[0].public.body, row, { now })
const missingRequisition = native.body.replaceAll('data-careersite-propertyid="customfield1"', 'data-absent-requisition="customfield1"')

function reject(body, expected, record = official) {
  assert.throws(() => parseCargillRmkDetail(body, native.finalURL, record, { now }), error => {
    assert.equal(error.message, 'Cargill native contract: Expected one native requisition')
    assert.equal(error.code, expected)
    assert.match(error.code, /^[A-Z_0-9]{1,80}$/)
    return true
  })
}

test('missing native requisition retains the guard and reports the validated public requisition', () => {
  assert.ok(missingRequisition !== native.body, 'Native requisition attribute was removed')
  reject(missingRequisition, `CARGILL_REQUISITION_${official.requisitionId}_MISSING_OR_AMBIGUOUS`)
})

test('duplicate native requisition retains the same rejection with bounded public identity', () => {
  reject(native.body.replace('</body>', `<span data-careersite-propertyid="customfield1">${official.requisitionId}</span></body>`),
    `CARGILL_REQUISITION_${official.requisitionId}_MISSING_OR_AMBIGUOUS`)
})

test('ordinary SAP parse boundary preserves the public requisition code', () => {
  assert.throws(() => parseCargillAtStage(() =>
    parseCargillRmkDetail(missingRequisition, native.finalURL, official, { now }), 'sap'), error => {
    assert.equal(error.code, `CARGILL_REQUISITION_${official.requisitionId}_MISSING_OR_AMBIGUOUS`)
    assert.match(error.code, /^[A-Z_0-9]{1,80}$/)
    return true
  })
})

test('untrusted or oversized requisition values never enter diagnostic codes', () => {
  for (const requisitionId of ['secret?token=abc', '123_456', '0', '012345', '1'.repeat(13), null, 123456]) {
    reject(missingRequisition, 'CARGILL_CONTRACT_EXPECTED_ONE_NATIVE_REQUISITION', { ...official, requisitionId })
  }
})

test('valid native requisition mismatch keeps its original fixed guard code', () => {
  const body = native.body.replace(/(data-careersite-propertyid="customfield1"[^>]*>)[\s\S]*?(<\/span>)/,
    (_match, opening, closing) => opening + '999999' + closing)
  assert.ok(body !== native.body, 'One native requisition span was changed')
  assert.throws(() => parseCargillRmkDetail(body, native.finalURL, official, { now }),
    error => error.code === 'CARGILL_CONTRACT_NATIVE_REQUISITION_MISMATCH')
})

test('valid role output remains identical and no diagnostic identity is added to jobs', () => {
  const result = parseCargillRmkDetail(native.body, native.finalURL, official, { now })
  assert.equal(result.requisitionId, official.requisitionId)
  assert.equal(result.jobId, official.requisitionId)
  assert.equal(result.failureCode, undefined)
  assert.equal(result.diagnosticRequisitionId, undefined)
})
