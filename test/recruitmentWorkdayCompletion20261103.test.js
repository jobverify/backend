import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedRecruitmentScraper, recruitmentIndiaFacet, RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const source = { source: 'workday-completion', companyName: 'Example', companyDomain: 'example.test', companyCareerPage: 'https://example.test/careers' }
const board = 'https://example.wd1.myworkdayjobs.com/External'
const role = (id, title = 'Software Engineer') => ({ externalPath: `/job/Bengaluru/${id}`, title, locationsText: 'Bengaluru, India' })
const description = '<p>Develop and maintain software services, collaborate with product engineering, investigate production failures and review changes to improve service performance and reliability.</p>'
const run = (listing, changes = {}) => createVerifiedRecruitmentScraper({ ...source, ...changes }).run({
  fetchPage: async url => ({ status: 200, url, html: `<h1>Example Careers</h1><a href="${board}">Jobs</a>` }),
  fetchJson: async (url, init) => url.endsWith('/jobs') ? listing(JSON.parse(init.body)) : { hiringOrganization: { name: 'Example' }, jobPostingInfo: {
    jobReqId: url.split('/').at(-1), title: 'Software Engineer', externalUrl: board + '/job/Bengaluru/' + url.split('/').at(-1),
    country: { alpha2Code: 'IN' }, location: 'Bengaluru', jobDescription: description,
  } },
})

test('uses the publisher country facet parameter rather than assuming locationCountry', async () => {
  const requests = []
  const jobs = await run(body => {
    requests.push(body)
    if (!body.appliedFacets.Country_and_Jurisdiction) return { total: 5000, jobPostings: [], facets: [{ facetParameter: 'Country_and_Jurisdiction', descriptor: 'Country and Jurisdiction',
      values: [{ descriptor: 'India', id: 'native-country-id', count: 1 }] }] }
    return { total: 1, jobPostings: [{ ...role('R1'), locationsText: 'Main Office' }] }
  }, { preferIndiaInventory: true, prioritizeRecruitmentSearch: true })
  assert.equal(jobs.length, 1)
  assert.deepEqual(requests.map(x => x.appliedFacets), [{}, { Country_and_Jurisdiction: ['native-country-id'] }])
  assert.equal(jobs[0].country, 'India')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('India labels under office or job-family facets cannot create a country filter', () => {
  for (const facet of [{ facetParameter: 'locations', descriptor: 'Locations' }, { facetParameter: 'jobFamilyGroup', descriptor: 'Job Category' }]) {
    assert.equal(recruitmentIndiaFacet({ facets: [{ ...facet, values: [{ descriptor: 'India', id: 'not-country', count: 1 }] }] }), null)
  }
})

test('a repeated identical native listing does not discard later distinct postings', async () => {
  const requests = []
  const jobs = await run(body => {
    requests.push(body.offset)
    return body.offset === 0 ? { total: 4, jobPostings: [role('R1'), role('R2')] }
      : { total: 0, jobPostings: [role('R2'), role('R3')] }
  })
  assert.deepEqual(jobs.map(job => job.jobId), ['R1', 'R2', 'R3'])
  assert.deepEqual(requests, [0, 2])
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-pagination-repeated-role'))
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].failures.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('a fully repeated page stops pagination and remains a coverage gap', async () => {
  const offsets = []
  const jobs = await run(body => { offsets.push(body.offset); return { total: body.offset ? 0 : 100, jobPostings: [role('R1')] } })
  assert.deepEqual(offsets, [0, 1])
  assert.equal(jobs.length, 1)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-pagination-no-progress'))
})

test('conflicting identities on repeated Workday paths remain failures', async () => {
  const jobs = await run(body => body.offset === 0 ? { total: 2, jobPostings: [role('R1')] }
    : { total: 0, jobPostings: [role('R1', 'Another title')] })
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].failures.some(row => /conflict|duplicate/i.test(row.message)))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
