import test from 'node:test'
import assert from 'node:assert/strict'
import { createPublishingGapAtsScraper } from '../utils/publishingGapAts.js'
import { reconcileGreenhouseOfficeCountries, withGreenhouseOfficeCountries } from '../utils/greenhouseOfficeCountry.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

// Synthetic native feed: a custom employer URL must bind its exact posting ID
// before a current same-office-ID country reference may be used.
const provider = { source: 'example', companyName: 'Example', atsPlatform: 'greenhouse',
  boardToken: 'example', companyCareerPage: 'https://www.example.com/careers/job/?gh_jid=101' }
const office = { id: 47, name: 'Berlin', location: null, parent_id: null, child_ids: [] }
const reference = { id: 101, internal_job_id: 2101, title: 'Software Engineer',
  location: { name: 'Berlin, Germany' }, offices: [office],
  absolute_url: 'https://www.example.com/careers/job/?gh_jid=101', content: '<p>Build production software.</p>' }
const target = { ...reference, id: 102, internal_job_id: 2102, location: { name: 'Berlin' },
  absolute_url: 'https://www.example.com/careers/job/?gh_jid=102' }

test('same-response office ID resolves a custom employer posting using its exact native gh_jid', async () => {
  const scope = reconcileGreenhouseOfficeCountries([reference, target], provider)
  assert.equal(scope.proofs.length, 1)
  assert.equal(scope.proofs[0].country, 'DE')
  assert.equal(scope.proofs[0].references[0].nativeUrl, reference.absolute_url)
  assert.equal(withGreenhouseOfficeCountries(target, provider, scope).offices[0].location, 'Berlin, Germany')
  assert.equal(target.offices[0].location, null, 'native response is preserved')
  const jobs = await createPublishingGapAtsScraper(provider).run({ fetchJson: async () => ({
    jobs: [reference, target], meta: { total: 2 },
  }) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})

for (const [name, url] of [
  ['foreign employer', 'https://other.example/careers/job/?gh_jid=101'],
  ['employer subdomain', 'https://apply.example.com/careers/job/?gh_jid=101'],
  ['mismatched posting ID', 'https://www.example.com/careers/job/?gh_jid=999'],
  ['duplicate ID parameter', 'https://www.example.com/careers/job/?gh_jid=101&gh_jid=101'],
  ['conflicting ID parameter', 'https://www.example.com/careers/job/?gh_jid=101&gh_jid=999'],
  ['unrecognized ID parameter', 'https://www.example.com/careers/job/?jobId=101'],
  ['unbound slug', 'https://www.example.com/careers/software-engineer-101'],
  ['fragment', 'https://www.example.com/careers/job/?gh_jid=101#other-role'],
  ['credentials', 'https://user@www.example.com/careers/job/?gh_jid=101'],
  ['insecure protocol', 'http://www.example.com/careers/job/?gh_jid=101'],
  ['nonstandard port', 'https://www.example.com:8443/careers/job/?gh_jid=101'],
]) {
  test(`custom ${name} cannot provide a native office country reference`, () => {
    const scope = reconcileGreenhouseOfficeCountries([{ ...reference, absolute_url: url }, target], provider)
    assert.equal(scope.proofs.length, 0)
    assert.equal(withGreenhouseOfficeCountries(target, provider, scope).offices[0].location, null)
  })
  test(`custom ${name} cannot consume another posting's office country reference`, () => {
    const invalidTarget = { ...target, absolute_url: url.replaceAll('101', '102') }
    const scope = reconcileGreenhouseOfficeCountries([reference, invalidTarget], provider)
    assert.equal(withGreenhouseOfficeCountries(invalidTarget, provider, scope).offices[0].location, null)
  })
}

test('an explicit reference cannot resolve a different office ID or changed office definition', () => {
  const scope = reconcileGreenhouseOfficeCountries([reference, target], provider)
  for (const changed of [{ ...target, offices: [{ ...office, id: 48 }] },
    { ...target, offices: [{ ...office, name: 'Remote' }] },
    { ...target, offices: [{ ...office, location: 'Unknown' }] }]) {
    assert.notEqual(withGreenhouseOfficeCountries(changed, provider, scope).offices[0].location, 'Berlin, Germany')
  }
})

test('conflicting native board regions cannot authorize custom employer office references', () => {
  const conflicting = { ...provider, bindingEvidence: { matchedLinks: [
    'https://job-boards.greenhouse.io/example', 'https://job-boards.eu.greenhouse.io/example',
  ] } }
  const scope = reconcileGreenhouseOfficeCountries([reference, target], conflicting)
  assert.equal(scope.proofs.length, 0)
  assert.equal(withGreenhouseOfficeCountries(target, conflicting, scope).offices[0].location, null)
})
