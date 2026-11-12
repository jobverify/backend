import assert from 'node:assert/strict'
import test from 'node:test'
import { cases, replay, changedDetail } from './helpers/phenomCurrentDetails20261112.js'

for (const [id, source, title] of [
  ['P-101048', 'royalenfield', 'Executive - Time Office'],
  ['R-01369441', 'thermofisherscientific', 'Lead DevOps Engineer'],
  ['P-124494', 'questglobal', 'Mechanical parts design lead engineer – Antenna module ,USB / 機械部品設計・リードエンジニア – 車載アンテナ、USB'],
  ['395378', 'nttdataservices', 'Systems Engineering Specialist'],
]) test('captured ' + source + ' ' + id + ' retains a corroborated native office format', async () => {
  const sample = cases.find(row => row.jobId === id)
  const [job] = await replay(sample)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.jobId, id)
  assert.equal(job.title, title)
  assert.equal(job.country, 'India')
  assert.ok(job.jobDescription.length > 200)
  if (id === 'P-101048') {
    assert.equal(Object.hasOwn(sample.structured.multi_location[0], 'postalCode'), false)
    const [office] = job.sourceNativeCountryEvidence.nativeStatePostalLiteralOffices
    assert.equal(office.location, 'Oragadam, Tamil Nadu 603105, India')
    assert.equal(Object.hasOwn(office, 'postalCode'), false, 'A display suffix cannot invent a typed postal field')
  }
  if (id === 'R-01369441') {
    assert.equal(job.sourceNativeCountryEvidence.ml_country, 'Sierra Leone')
    assert.equal(job.sourceNativeCountryEvidence.derivedCountryConflict, true)
    assert.equal(job.sourceNativeCountryEvidence.verifiedMultiCountryDerivedConflict, true)
    assert.deepEqual(job.sourceNativeCountryEvidence.nativeOfficeCountries, ['India', 'Philippines'])
  }
  if (id === '395378') assert.equal(job.sourceNativeCountryEvidence.nativeCommaCityOffices[0].city, 'Noida, Bangalore')
})

for (const [name, mutate] of [
  ['different native city', model => { model.structured.multi_location[0].city = 'Mumbai' }],
  ['different native state', model => { model.structured.multi_location[0].state = 'Maharashtra' }],
  ['foreign native country', model => { model.structured.multi_location[0].country = 'United States' }],
  ['different literal state', model => { model.structured.multi_location[0].location = 'Oragadam, Maharashtra 603105, India' }],
  ['invalid literal suffix', model => { model.structured.multi_location[0].location = 'Oragadam, Tamil Nadu ABCDEF, India' }],
  ['different supplied postal code', model => { model.structured.multi_location[0].postalCode = '999999' }],
  ['different supplied zip code', model => { model.structured.multi_location[0].zipCode = '999999' }],
  ['different schema city', model => { model.posting.jobLocation.address.addressLocality = 'Mumbai' }],
  ['different schema state', model => { model.posting.jobLocation.address.addressRegion = 'Maharashtra' }],
  ['foreign schema country', model => { model.posting.jobLocation.address.addressCountry = 'United States' }],
  ['different schema postal code', model => { model.posting.jobLocation.address.postalCode = '999999' }],
  ['different native sequence', model => { model.structured.jobSeqNo = 'unrelated-sequence' }],
]) test('Royal Enfield literal postal label rejects ' + name, async () => {
  const sample = cases.find(row => row.jobId === 'P-101048')
  const [job] = await replay(sample, changedDetail(sample, mutate))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})

for (const [name, mutate] of [
  ['another unreviewed derived country', model => { model.structured.ml_country = 'United States' }],
  ['foreign typed primary country', model => { model.structured.country = 'United States' }],
  ['foreign standardized primary country', model => { model.structured.standardisedCountry = 'United States' }],
  ['foreign native secondary country', model => { model.structured.multi_location[1].country = 'United States' }],
  ['foreign schema secondary country', model => { model.posting.jobLocation[1].address.addressCountry = 'United States' }],
  ['different schema secondary city', model => { model.posting.jobLocation[1].address.addressLocality = 'Cebu' }],
  ['missing native secondary office', model => { model.structured.multi_location.pop() }],
  ['missing schema secondary office', model => { model.posting.jobLocation.pop() }],
  ['missing native sequence', model => { delete model.structured.jobSeqNo }],
  ['missing native authored body', model => { delete model.structured.ml_Description }],
]) test('Thermo Fisher reviewed derived-country reconciliation rejects ' + name, async () => {
  const sample = cases.find(row => row.jobId === 'R-01369441')
  const [job] = await replay(sample, changedDetail(sample, mutate))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})

for (const [name, mutate] of [
  ['foreign country in literal city', model => { model.structured.multi_location[0].city = 'Noida, United States' }],
  ['different explicit state', model => { model.structured.multi_location[0].state = 'IN-KA' }],
  ['different redundant city-country', model => { model.structured.multi_location[0].cityCountry = 'Noida, Mumbai, India' }],
  ['foreign schema country', model => { model.posting.jobLocation.address.addressCountry = 'United States' }],
]) test('NTT comma city literal rejects ' + name, async () => {
  const sample = cases.find(row => row.jobId === '395378')
  const [job] = await replay(sample, changedDetail(sample, mutate))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})

for (const sample of cases.filter(row => row.failureKind === 'missing-content')) test('captured ' + sample.source + ' ' + sample.jobId + ' keeps its unresolved content visible', async () => {
  const jobs = await replay(sample)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, sample.jobId)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].jobDescription, null)
})
