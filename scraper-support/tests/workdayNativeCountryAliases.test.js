import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { hasRecognizedWorkdayCountry, explicitWorkdayCountryScope } from '../myworkday/countryInventoryProof.js'

const folder = new URL('./fixtures/workdayNativeCountryAliases/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
const receipt = manifest.requests[0]
const body = gunzipSync(fs.readFileSync(new URL(receipt.filename, folder)))
assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
const info = JSON.parse(body).jobPostingInfo
assert.equal(info.jobReqId, '123323')
assert.equal(info.country.descriptor, 'Korea, Republic of')
assert.equal(info.jobRequisitionLocation.country.alpha2Code, 'KR')

test('recognizes the actual CAE native country name and its matching KR requisition country', () => {
  assert.equal(hasRecognizedWorkdayCountry(info.country), true)
  assert.equal(hasRecognizedWorkdayCountry(info.jobRequisitionLocation.country), true)
})

test('the exact native Korean country name establishes foreign scope without relying on Seoul', () => {
  assert.equal(explicitWorkdayCountryScope(info.country.descriptor), 'foreign')
  assert.equal(explicitWorkdayCountryScope('Seoul'), null)
})

test('the alias does not invent a country for generic or unsupported Korean labels', () => {
  assert.equal(hasRecognizedWorkdayCountry({ descriptor: 'Korea', alpha2Code: 'KR' }), false)
  assert.equal(hasRecognizedWorkdayCountry({ descriptor: 'Unknown Korean territory', alpha2Code: 'KR' }), false)
})

for (const [label, fields] of [
  ['India code', { alpha2Code: 'IN' }],
  ['India native country identifier', { id: 'c4f78be1a8f14da0ab49ce1162348a5e' }],
  ['North Korea code', { alpha2Code: 'KP' }],
]) test('the exact native alias cannot override a conflicting ' + label, () => {
  assert.equal(hasRecognizedWorkdayCountry({ ...info.country, ...fields }), false)
})
