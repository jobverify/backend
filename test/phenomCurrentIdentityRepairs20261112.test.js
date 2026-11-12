import assert from 'node:assert/strict'
import test from 'node:test'
import { cases, replay, changedDetail } from './helpers/phenomCurrentDetails20261112.js'

const titleRoles = new Set(['2025101', '2026979', 'P-123658', '393832', '386559', '387809', '1166611'])
const repaired = cases.filter(sample => sample.source === 'abb' || titleRoles.has(sample.jobId))

for (const sample of repaired) test('captured ' + sample.source + ' ' + sample.jobId + ' recovers its identity-bound native description', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const [job] = await replay(sample)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.jobId, sample.listing.jobId)
  assert.equal(job.title, sample.listing.title.replace(/\s+/g, ' ').trim())
  assert.equal(job.country, 'India')
  assert.ok(job.jobDescription.length > 200)
  if (titleRoles.has(sample.jobId)) {
    assert.equal(job.sourceNativeDetailEvidence.nativeTitle, sample.structured.title)
    assert.equal(job.sourceNativeDetailEvidence.jsonLdTitle, sample.posting.title)
  }
})

for (const [label, mutate] of [
  ['different requisition', model => { model.structured.reqId = 'unrelated-role' }],
  ['different sequence', model => { model.structured.jobSeqNo = 'unrelated-sequence' }],
  ['foreign country', model => { model.structured.country = 'United States' }],
  ['foreign schema country', model => { model.posting.jobLocation.address.addressCountry = 'United States' }],
  ['unreviewed alternate title', model => { model.posting.title = 'Unreviewed alternate role' }],
  ['missing native body', model => { delete model.structured.ml_Description }],
]) test('current reviewed Cisco title rejects ' + label, async () => {
  const sample = cases.find(row => row.jobId === '2025101')
  const [job] = await replay(sample, changedDetail(sample, mutate))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})

for (const [label, mutate] of [
  ['different state-only office country', model => { model.structured.multi_location[1].country = 'India' }],
  ['different state-only office state', model => { model.structured.multi_location[1].state = 'Unrelated state' }],
  ['different state-only office city label', model => { model.structured.multi_location[1].cityState = 'Unrelated city' }],
  ['different state-only office country label', model => { model.structured.multi_location[1].cityCountry = 'India' }],
  ['unknown city marker', model => { model.structured.multi_location[1].city = 'Unknown city' }],
]) test('ABB native state-only marker rejects ' + label, async () => {
  const sample = cases.find(row => row.jobId === 'JR00047042')
  const [job] = await replay(sample, changedDetail(sample, mutate))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})
