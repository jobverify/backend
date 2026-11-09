import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import * as source from './script.js'

const native = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261102.json.gz', import.meta.url))))
const detail = source.extractJobDetail(native.detail, { jobId: native.listing.jobId })
const reader = (payload = native.lever, privacy = native.privacy) => async url => {
  if (url === detail.applyUrl) return privacy
  if (url === `https://api.lever.co/v0/postings/brillio-2/${native.lever.id}`) return JSON.stringify(payload)
  assert.fail(url)
}

test('Brillio qualifies the actual unresolved Pleasanton role using its role-owned published application and native Lever country', async () => {
  assert.equal(detail.sourceDetailComplete, true)
  const evidence = await source.resolveNativeApplicationCountry(native.listing, detail, reader())
  assert.equal(evidence.country, 'United States')
  assert.equal(evidence.nativeCountryCode, 'US')
  assert.equal(evidence.nativePostingId, native.lever.id)
  assert.equal(evidence.jobId, '21241')
})

for (const field of ['id', 'text', 'hostedUrl', 'applyUrl']) test(`Brillio refuses a native application country when ${field} does not bind to the exact published role`, async () => {
  await assert.rejects(source.resolveNativeApplicationCountry(native.listing, detail, reader({ ...native.lever, [field]: 'unrelated' })), /identity|title|bound/i)
})

test('Brillio never uses an unbound proceed link or salary/city as a country substitute', async () => {
  await assert.rejects(source.resolveNativeApplicationCountry(native.listing, detail, reader(native.lever, native.privacy.replace(native.lever.applyUrl, 'https://jobs.lever.co/other-employer/'+native.lever.id+'/apply'))), /employer|handoff|binding/i)
  await assert.rejects(source.resolveNativeApplicationCountry(native.listing, detail, reader({ ...native.lever, country: null })), /country/i)
})
