import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../utils/verifiedRecruitment.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../utils/inventoryEvidence.js'

const root = 'https://employer.test/careers'
const config = { source: 'bounded-native-candidates', companyName: 'Example Employer',
  companyDomain: 'employer.test', officialHomepageUrl: root, companyCareerPage: root,
  requireCorporateIdentityMatch: true, prioritizeRecruitmentSearch: true, preferIndiaInventory: true }
const description = '<p>Design and maintain production software services, review API contracts, investigate distributed system failures, and collaborate with the product engineering team to improve reliability.</p>'
const posting = (id, country, title = 'Software Engineer') => ({ '@context': 'https://schema.org',
  '@type': 'JobPosting', identifier: { value: id }, title, url: root + '/role/' + id,
  hiringOrganization: { name: config.companyName }, description,
  jobLocation: { address: { addressCountry: country } } })
const script = value => '<script type="application/ld+json">' + JSON.stringify(value) + '</script>'
const run = async (candidates, { details = [], navigation = '', ...options } = {}) => {
  const calls = []
  const pages = new Map([...candidates, ...details].map(row => [row.url,
    '<h1>' + row.title + '</h1>' + description + script(row)]))
  if (navigation) pages.set(root + '/benefits', '<title>Example Employer Careers</title>')
  const jobs = await createVerifiedRecruitmentScraper(config).run({ maxPages: 2, maxRequests: 2,
    maxDetails: 1, sourceTimeoutMs: 3000, ...options, fetchPage: async url => {
      calls.push(url)
      assert.ok(url === root || pages.has(url), 'Only current declared candidates can be read')
      return { status: 200, url, html: url === root
        ? '<title>Example Employer Careers</title>' + script(candidates) + navigation : pages.get(url) }
    } })
  return { jobs, calls }
}

// Reversing the declared array or selecting opaque URLs before their native
// India candidate exhausts this source's bounded detail budget.
test('an explicitly typed India candidate is read before earlier and later foreign candidates exhaust the page budget', async () => {
  const candidates = [posting('foreign-before-1', 'US'), posting('foreign-before-2', 'GB'),
    posting('selected-native-role', 'IN'), posting('foreign-after-1', 'DE'), posting('foreign-after-2', 'FR')]
  const { jobs, calls } = await run(candidates)
  assert.deepEqual(calls, [root, root + '/role/selected-native-role'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'selected-native-role')
  assert.equal(jobs[0].country, 'India')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('equally qualified native India candidates retain their declaration order', async () => {
  const { jobs, calls } = await run([posting('first-declared', 'India'), posting('second-declared', 'IN')])
  assert.deepEqual(calls, [root, root + '/role/first-declared'])
  assert.equal(jobs[0].jobId, 'first-declared')
})

test('unknown country candidates remain eligible for their own native detail without India words changing priority', async () => {
  const unknown = posting('first-unresolved', undefined)
  const { jobs, calls } = await run([unknown, posting('foreign-country', 'US', 'India Software Engineer'),
    posting('ambiguous-country', ['IN', 'US'])], { details: [{ ...unknown,
      jobLocation: { address: { addressCountry: 'IN', addressLocality: 'Bengaluru' } } }] })
  assert.deepEqual(calls, [root, root + '/role/first-unresolved'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
})

test('an explicit foreign country is still observed when later titles and ambiguous country arrays mention India', async () => {
  const { jobs, calls } = await run([posting('first-foreign', 'US'),
    posting('title-only', undefined, 'India Software Engineer'), posting('ambiguous-country', ['IN', 'US']),
    posting('contradictory-country', { name: 'India', alpha2Code: 'US' })])
  assert.deepEqual(calls, [root, root + '/role/first-foreign'])
  assert.equal(jobs.length, 0)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('a remote role with an explicit India applicant country is selected before foreign candidates', async () => {
  const remote = { ...posting('remote-native-role', undefined), jobLocationType: 'TELECOMMUTE',
    applicantLocationRequirements: { '@type': 'Country', name: 'India' } }
  const { jobs, calls } = await run([remote, posting('foreign-after', 'US')])
  assert.deepEqual(calls, [root, root + '/role/remote-native-role'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
})

test('a declared India candidate cannot supply country evidence for its foreign full native detail', async () => {
  const candidate = posting('changed-native-country', 'IN')
  const { jobs } = await run([candidate], { details: [posting('changed-native-country', 'US')] })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('current structured role candidates are read before additional careers navigation consumes the page budget', async () => {
  const { jobs, calls } = await run([posting('selected-native-role', 'IN')], {
    navigation: '<a href="' + root + '/benefits">Career benefits</a>',
  })
  assert.deepEqual(calls, [root, root + '/role/selected-native-role'])
  assert.equal(jobs.length, 1)
})

test('a caller can disable country prioritization while preserving native declaration order', async () => {
  const { jobs, calls } = await run([posting('first-foreign', 'US'), posting('later-india', 'IN')], {
    preferIndiaInventory: false,
  })
  assert.deepEqual(calls, [root, root + '/role/first-foreign'])
  assert.equal(jobs.length, 0)
})

test('foreign structured candidates do not overtake a currently declared India search', async () => {
  const calls = [], search = 'https://employer.test/search?country=India'
  const selected = { ...posting('india-search-role', 'IN'), url: search }
  const jobs = await createVerifiedRecruitmentScraper(config).run({ maxPages: 2, maxRequests: 2,
    fetchPage: async url => {
      calls.push(url)
      return { status: 200, url, html: url === root
        ? '<title>Example Employer Careers</title>' + script([posting('foreign-role', 'US')])
          + '<a href="' + search + '">India jobs</a>'
        : url === search ? '<h1>Software Engineer</h1>' + description + script(selected)
          : '<h1>Software Engineer</h1>' + description + script(posting('foreign-role', 'US')) }
    } })
  assert.deepEqual(calls, [root, search])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'india-search-role')
})
