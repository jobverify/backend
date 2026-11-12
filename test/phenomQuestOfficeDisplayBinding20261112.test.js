import assert from 'node:assert/strict'
import test from 'node:test'
import { cases, replay, changedDetail } from './helpers/phenomCurrentDetails20261112.js'

const sample = cases.find(row => row.jobId === 'P-120607')
test('Quest binds the reviewed secondary display to the same listing/native/schema office without equating administrative names', async () => {
  const [job] = await replay(sample)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.title, 'Mechanical Lead Engineer')
  assert.equal(job.city, 'Bengaluru')
  assert.equal(job.country, 'India')
  assert.ok(job.jobDescription.length > 1000)
  const [evidence] = job.sourceNativeCountryEvidence.nativeReviewedOfficeDisplayEvidence
  assert.equal(evidence.nativeOffice.city, 'Bangalore Division')
  assert.equal(evidence.nativeOffice.location, 'Bengaluru Urban, Karnataka, India')
  assert.equal(evidence.listingOffice.location, 'Bengaluru Urban, Karnataka, India')
  assert.equal(evidence.schemaOffice.address.addressLocality, 'Bangalore Division')
})

for (const [name, mutate] of [
  ['different native secondary city', model => { model.structured.multi_location[1].city = 'Unrelated city' }],
  ['different native secondary display', model => { model.structured.multi_location[1].location = 'Unreviewed display, Karnataka, India' }],
  ['different native secondary state', model => { model.structured.multi_location[1].state = 'Maharashtra' }],
  ['foreign native secondary country', model => { model.structured.multi_location[1].country = 'United States' }],
  ['different native secondary coordinates', model => { model.structured.multi_location[1].latlong.lat = 1 }],
  ['different schema secondary city', model => { model.posting.jobLocation[1].address.addressLocality = 'Unrelated city' }],
  ['foreign schema secondary country', model => { model.posting.jobLocation[1].address.addressCountry = 'United States' }],
  ['different schema secondary coordinates', model => { model.posting.jobLocation[1].geo.latitude = '1' }],
  ['different native sequence', model => { model.structured.jobSeqNo = 'unrelated-sequence' }],
]) test('Quest reviewed office display rejects ' + name, async () => {
  const [job] = await replay(sample, changedDetail(sample, mutate))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})

for (const [name, mutate] of [
  ['different listing coordinates', listing => { listing.multi_location_array[1].latlong.lat = 1 }],
  ['different listing display', listing => { listing.multi_location_array[1].location = 'Unreviewed display, Karnataka, India' }],
  ['absent listing secondary office', listing => { listing.multi_location_array.pop() }],
  ['ambiguous duplicate listing office', listing => { listing.multi_location_array.push(structuredClone(listing.multi_location_array[1])) }],
]) test('Quest reviewed office display rejects ' + name, async () => {
  const changed = structuredClone(sample)
  mutate(changed.listing)
  const [job] = await replay(changed)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})
