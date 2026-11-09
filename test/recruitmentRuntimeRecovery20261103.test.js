import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { remainingRecruitmentBatchProvider } from '../scraper-support/utils/remainingRecruitmentBatch20261103.js'

const config = { source: 'recovery-example', companyName: 'Example Corporation', companyDomain: 'example.test',
  companyCareerPage: 'https://example.test/careers' }
const board = 'https://example.wd1.myworkdayjobs.com/external'
const api = 'https://example.wd1.myworkdayjobs.com/wday/cxs/example/external'
const path = '/job/Main-Office/Software-Engineer_R123'
const description = '<p>Develop and maintain production software services, review API contracts, investigate distributed system failures, and collaborate with the product engineering team.</p>'
const native = { hiringOrganization: { name: config.companyName }, jobPostingInfo: { jobReqId: 'R123', title: 'Software Engineer',
  externalUrl: board + path, jobPostingSiteId: 'external', country: { descriptor: 'India' },
  location: 'Bengaluru', jobDescription: description, canApply: true, posted: true } }
const role = { externalPath: path, title: native.jobPostingInfo.title, locationsText: 'Bengaluru, India' }
const run = (changes = {}, provider = config) => createVerifiedRecruitmentScraper(provider).run({
  now: () => '2026-11-03T12:00:00Z',
  fetchPage: async url => ({ status: 200, url, html: `<h1>Example Corporation</h1><a href="${board}">Open roles</a>` }),
  fetchJson: async url => url === api + '/jobs' ? { total: 1, jobPostings: [role] }
    : { ...native, jobPostingInfo: { ...native.jobPostingInfo, ...changes } },
})

test('Workday accepts a native canonical site capitalization without granting a different site or role', async t => {
  const jobs = await run({ jobPostingSiteId: 'External', externalUrl: board.replace('/external', '/External') + path })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, board.replace('/external', '/External') + path)
  for (const changes of [
    { jobPostingSiteId: 'AnotherSite', externalUrl: board.replace('/external', '/AnotherSite') + path },
    { jobPostingSiteId: 'External', externalUrl: board.replace('/external', '/External') + path + '-other' },
    { jobPostingSiteId: 'AnotherSite' },
    { externalUrl: 'https://foreign.test/external' + path },
  ]) await t.test(JSON.stringify(changes), async () => {
    const rejected = await run(changes)
    assert.equal(rejected.length, 0)
    assert.ok(rejected[RECRUITMENT_OBSERVATIONS].failures.some(x => /listing\/detail identity/.test(x.message)))
  })
})

test('explicit foreign Workday countries are excluded; absent or contradictory countries remain failures', async () => {
  for (const value of [{ descriptor: 'United States of America' }, { descriptor: 'France' }, { descriptor: 'United States of America', alpha2Code: 'US' }]) {
    const jobs = await run({ country: value })
    assert.equal(jobs.length, 0)
    assert.deepEqual(jobs[RECRUITMENT_OBSERVATIONS].unresolved, [])
    assert.equal(jobs[RECRUITMENT_OBSERVATIONS].exclusions[0].reason, 'native-explicit-non-India-primary-country')
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
  }
  const unknown = await run({ country: null })
  assert.ok(unknown[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-location-scope-unresolved'))
  for (const changes of [
    { country: { descriptor: 'India', alpha2Code: 'US' } },
    { country: { descriptor: 'India' }, jobRequisitionLocation: { country: { alpha2Code: 'US' } } },
  ]) {
    const jobs = await run(changes)
    assert.equal(jobs.length, 0)
    assert.ok(jobs[RECRUITMENT_OBSERVATIONS].failures.some(x => /Contradictory/.test(x.message)))
  }
})

test('the primary Workday country cannot certify additional location strings as foreign', async () => {
  const jobs = await run({ country: { descriptor: 'United States of America' }, additionalLocations: ['Bengaluru'] })
  assert.equal(jobs.length, 0)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-additional-location-scope-unresolved'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Workday can use its typed requisition country but excludes explicitly unavailable roles', async () => {
  const jobs = await run({ country: null, jobRequisitionLocation: { country: { alpha2Code: 'IN' } } })
  assert.equal(jobs.length, 1)
  for (const changes of [{ canApply: false }, { posted: false }]) {
    const rejected = await run(changes)
    assert.equal(rejected.length, 0)
    assert.equal(rejected[RECRUITMENT_OBSERVATIONS].exclusions[0].reason, 'native-role-unavailable')
  }
})

test('an observed India facet selects detail candidates even when the display location omits India', async () => {
  const bodies = []
  const jobs = await createVerifiedRecruitmentScraper(config).run({ preferIndiaInventory: true,
    fetchPage: async url => ({ status: 200, url, html: `<a href="${board}">Jobs</a>` }),
    fetchJson: async (url, init) => {
      if (url !== api + '/jobs') return native
      bodies.push(JSON.parse(init.body))
      return { total: 1, facets: [{ facetParameter: 'locationCountry', values: [{ descriptor: 'India', id: 'observed-india-id', count: 1 }] }],
        jobPostings: [{ ...role, locationsText: 'Main Office' }] }
    } })
  assert.equal(jobs.length, 1)
  assert.deepEqual(bodies.map(x => x.appliedFacets), [{}, { locationCountry: ['observed-india-id'] }])
})

test('a malformed native row remains unresolved while subsequent Workday roles can still be verified', async () => {
  const jobs = await createVerifiedRecruitmentScraper(config).run({
    fetchPage: async url => ({ status: 200, url, html: `<a href="${board}">Jobs</a>` }),
    fetchJson: async url => url.endsWith('/jobs') ? { total: 2, jobPostings: [{ bulletFields: ['R45327'] }, role] } : native,
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].unqualifiedNativeRows, 1)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-role-identity-unavailable'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Workday India text search discovers candidates but cannot replace detail country proof', async () => {
  const bodies = []
  const rows = ['R123', 'R124', 'R125'].map((id, i) => ({ ...role, title: 'Engineer ' + i, externalPath: path.replace('R123', id), locationsText: 'Main Office' }))
  const jobs = await createVerifiedRecruitmentScraper({ ...config, searchIndiaWithoutFacet: true }).run({ preferIndiaInventory: true,
    fetchPage: async url => ({ status: 200, url, html: `<a href="${board}">Jobs</a>` }),
    fetchJson: async (url, init) => {
      if (url === api + '/jobs') { bodies.push(JSON.parse(init.body)); return { total: 3, facets: [], jobPostings: rows } }
      const index = rows.findIndex(row => url === api + row.externalPath), row = rows[index]
      return { ...native, jobPostingInfo: { ...native.jobPostingInfo, title: row.title, jobReqId: 'R' + (123 + index),
        externalUrl: board + row.externalPath, country: index === 0 ? { descriptor: 'India' } : index === 1 ? { descriptor: 'United States of America' } : null } }
    } })
  assert.deepEqual(bodies.map(x => x.searchText), ['', 'India'])
  assert.ok(bodies.every(x => Object.keys(x.appliedFacets).length === 0))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'R123')
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-location-scope-unresolved'))
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('reviewed employer aliases remain source-specific and retain their native response proof', () => {
  for (const [source, name] of [['nielsen', 'The Nielsen Company'], ['simcorp', 'SimCorp India LLP'],
    ['veradigm', 'LE9220 Veradigm India Private Limited - Pune'], ['kone', '282 KONE Elevator India P.Ltd'],
    ['michelin', '508 MICHELIN INDIA PRIVATE LTD - 508'], ['magnainternational', 'Magna Automotive India Private Limited'],
    ['riotinto', '8750 Rio Tinto India Private Limited'], ['prudentialplc', 'PTSI Prudential Technology and Services India Private Limited'],
    ['unilever', '3128 Unilever Industries Private Limited (UIPL)'], ['ssandctechnologies', 'SS&C Fintech Svc India - Hyderabad']]) {
    const provider = remainingRecruitmentBatchProvider(source)
    assert.ok(provider.nativeEmployerNames.includes(name))
    const proof = provider.nativeEmployerNameEvidence.find(x => x.nativeName === name)
    assert.match(proof.nativeResponseSHA256, /^[a-f0-9]{64}$/)
    assert.ok(proof.currentCorporateBindingURLs.length)
  }
  const group = remainingRecruitmentBatchProvider('prysmiangroup')
  const member = group.nativeEmployerNameEvidence.find(row => row.nativeName === 'IN1786 Associated Cables Pvt. Ltd.')
  assert.ok(group.nativeEmployerNames.includes(member.nativeName))
  assert.equal(member.scopeRule, 'current-consolidated-entity-within-registered-group')
  assert.match(member.entityReviewURL, /^https:\/\/www\.prysmian\.com\//)
  assert.match(member.nativeResponseSHA256, /^[a-f0-9]{64}$/)
  assert.ok(member.currentCorporateBindingURLs.length)
  for (const [source, name] of [['nasdaq', 'ADIN Adenza India Private Ltd.'],
    ['magnainternational', 'Vehma Engineering Solutions (India) Private Limited'], ['unilever', '1609 HINDUSTAN UNILEVER LIMITED'],
    ['riotinto', ''], ['ssandctechnologies', 'GlobeOp India - GIFT City']]) {
    assert.ok(!remainingRecruitmentBatchProvider(source).nativeEmployerNames?.includes(name))
  }
})
