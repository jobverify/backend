import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../utils/verifiedRecruitment.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'
import { createRecruitmentObservationAccounting } from '../utils/recruitmentObservationAccounting.js'
import { extractionRawJobMetrics } from '../utils/extractionRawJobMetrics.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { readInventoryDelegationEvidence } from '../utils/inventoryDelegationEvidence.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { extractionDetailHealth } from '../utils/extractionDetailHealth.js'
import { jobIdentityHashes } from '../utils/jobYield.js'
import { decorateJobsWithProviderMetadata, getScraperCatalog, createCatalogScraper } from '../providers/index.js'
import * as exported2u from '../../scraper/2u/script.js'

// Controls are synthetic except the explicitly identified original 2U public
// response replay. Synthetic controls make no current employer inventory claim.
const clock = '2026-11-03T10:00:00.000Z'
const config = { source: 'recruitment-observation-fixture', companyName: 'Example Corporation',
  companyDomain: 'employer.test', companyCareerPage: 'https://employer.test/careers' }
const description = '<p>Design and maintain production software services, review API contracts, investigate distributed system failures, and collaborate with the product engineering team.</p>'
const posting = (id, country = 'US', change = {}) => ({ '@type': 'JobPosting', identifier: { value: id },
  title: 'Software Engineer', url: 'https://employer.test/careers/jobs/' + id,
  hiringOrganization: { name: config.companyName }, description, datePosted: '2026-10-30',
  jobLocation: { address: { addressCountry: country, addressLocality: country === 'IN' ? 'Bengaluru' : 'San Francisco' } }, ...change })
const schemaHtml = rows => '<h1>' + rows[0].title + '</h1>' + description
  + '<script type="application/ld+json">' + JSON.stringify(rows) + '</script>'
const htmlTransport = (rows, { extraLinks = [], changes = new Map(), root = config.companyCareerPage } = {}) => async url => ({
  status: changes.has(url) ? changes.get(url).status : 200, url,
  html: changes.has(url) ? changes.get(url).html : rows.some(row => row.url === url)
    ? schemaHtml(rows.filter(row => row.url === url))
    : '<h1>' + config.companyName + ' Careers</h1>' + [...rows.map(row => row.url), ...extraLinks]
      .map(target => '<a href="' + target + '">Open job</a>').join(''),
})
const runHtml = (rows, options = {}, overrides = {}) => createVerifiedRecruitmentScraper({ ...config, ...overrides }).run({
  now: () => clock, fetchPage: htmlTransport(rows), ...options,
})
const audit = (jobs, records, vacancies = records, kind = vacancies === records ? 'vacancy-rows' : vacancies ? 'mixed' : 'hiring-signals', provider = config) => {
  const expected = { source: provider.source, recordKind: kind, observedRecordCount: records, observedVacancyCount: vacancies,
    sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null }
  assert.deepEqual(readSourceObservationEvidence(jobs, provider.source), expected)
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'coverage-gap')
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(inventory.verifiedAt, clock)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].lifecycleCleanupAllowed, false)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].sourceScopeComplete, false)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].observedAt, clock)
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false && job.sourceScopeComplete === false))
  assert.equal(extractionRawJobMetrics(provider, jobs, inventory).rawJobs, vacancies)
  return expected
}

// Read the one trusted local pure declaration. Do not import runner.js: its
// top-level environment/database/storage effects are forbidden by the guard.
const runnerText = readFileSync(new URL('../runner.js', import.meta.url), 'utf8')
const runnerDeclaration = parse(runnerText, { ecmaVersion: 'latest', sourceType: 'module' }).body
  .filter(node => node.type === 'ExportNamedDeclaration').flatMap(node => node.declaration?.declarations || [])
  .find(node => node.id.name === 'buildScraperAttemptDiagnostics')
assert.equal(runnerDeclaration.init.type, 'ArrowFunctionExpression')
const diagnostics = new Function('analyzePublishableJobs', 'extractionRawJobMetrics', 'readInventoryEvidence',
  'extractionDetailHealth', 'readInventoryDelegationEvidence', 'readSourceObservationEvidence', 'jobIdentityHashes',
  'return (' + runnerText.slice(runnerDeclaration.init.start, runnerDeclaration.init.end) + ')')(
  analyzePublishableJobs, extractionRawJobMetrics, readInventoryEvidence, extractionDetailHealth,
  readInventoryDelegationEvidence, readSourceObservationEvidence, jobIdentityHashes)

test.beforeEach(t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Synthetic recruitment observation tests forbid network'))
})

test('a recognized US vacancy survives the empty India result and actual provider decoration', async () => {
  const jobs = await runHtml([posting('us-1')])
  assert.equal(jobs.length, 0)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 1)
  const expected = audit(jobs, 1)
  const decorated = decorateJobsWithProviderMetadata(jobs, config)
  assert.notEqual(decorated, jobs)
  audit(decorated, 1)
  assert.deepEqual(diagnostics(decorated, undefined, config).sourceObservations, expected)
  assert.equal(diagnostics(decorated, undefined, config).rawRecords, 1)
  assert.equal(diagnostics(decorated, undefined, config).eligibleJobs, 0)
})

test('US, India and unknown countries count before eligibility while native India payload stays exact', async () => {
  const rows = [posting('us-1'), posting('in-1', 'IN'), posting('unknown-1', undefined, { jobLocation: { address: { addressLocality: 'Bengaluru' } } })]
  const jobs = await runHtml(rows)
  assert.deepEqual(jobs.map(job => job.jobId), ['in-1'])
  assert.deepEqual(jobs[0].nativeSourceRecord, rows[1])
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceDescription, description)
  audit(jobs, 3)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-location-scope-unresolved'))
  const result = diagnostics(decorateJobsWithProviderMetadata(jobs, config), analyzePublishableJobs(jobs, { now: clock }), config)
  assert.equal(result.rawRecords, 3)
  assert.equal(result.jobs, 1)
  assert.equal(result.eligibleJobs, 1)
  assert.equal(result.filteredNonIndia, 0)
})

test('repeated JobPosting blocks and repeated same-account IDs are observed once', async () => {
  const row = posting('same-id')
  const alias = { ...row, url: row.url + '-alias' }
  const jobs = await runHtml([row, row, alias])
  assert.equal(jobs.length, 0)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 2)
  audit(jobs, 1)
})

test('distinct native identities with the same title are separate observations', async () => {
  audit(await runHtml([posting('different-1'), posting('different-2')]), 2)
})

test('generic intake and a vacancy retain mixed record typing without inflating vacancies', async () => {
  const jobs = await runHtml([posting('actual-vacancy'), posting('intake', 'US', { title: 'Join our Talent Community' })])
  audit(jobs, 2, 1, 'mixed')
  const intake = await runHtml([posting('intake', 'US', { title: 'General Application' })])
  audit(intake, 1, 0, 'hiring-signals')
  assert.equal(extractionRawJobMetrics(config, intake, readInventoryEvidence(intake)).rawJobsBasis, 'observed-native-non-vacancy-records')
})

test('a specific vacancy mentioning a talent community is still a vacancy', async () => {
  for (const country of ['US', 'IN']) {
    const row = posting('community-manager', country, { title: 'Talent Community Manager' })
    const jobs = await runHtml([row])
    audit(jobs, 1)
    assert.equal(jobs.length, country === 'IN' ? 1 : 0)
    if (jobs.length) assert.deepEqual(jobs[0].nativeSourceRecord, row)
  }
})

test('a full India General Application is a retained intake record with zero observed vacancies', async () => {
  const row = posting('india-intake', 'IN', { title: 'General Application' })
  const jobs = await runHtml([row])
  assert.equal(jobs.length, 0)
  audit(jobs, 1, 0, 'hiring-signals')
  const excluded = jobs[RECRUITMENT_OBSERVATIONS].exclusions.find(item => item.reason === 'native-generic-intake')
  assert.equal(excluded.url, row.url)
  assert.deepEqual(excluded.nativeSourceRecord, row)
  const result = diagnostics(decorateJobsWithProviderMetadata(jobs, config), undefined, config)
  assert.equal(result.rawRecords, 0)
  assert.equal(result.eligibleJobs, 0)
  assert.equal(result.sourceObservations.observedRecordCount, 1)
  assert.equal(result.sourceObservations.observedVacancyCount, 0)
})

test('unidentified schema cannot erase a known vacancy or invent a count for the unidentified row', async () => {
  const known = posting('known')
  const unknown = posting('unknown', 'US', { identifier: undefined, url: undefined })
  const unknownURL = 'https://employer.test/careers/jobs/unknown'
  const fetchPage = async url => ({ status: 200, url, html: url === known.url ? schemaHtml([known])
    : url === unknownURL ? schemaHtml([unknown])
      : '<h1>Careers</h1><a href="' + known.url + '">Job</a><a href="' + unknownURL + '">Job</a>' })
  const jobs = await runHtml([], { fetchPage })
  assert.equal(jobs.length, 0)
  audit(jobs, 1)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-observation-identity-unavailable'))
  const allUnknown = await runHtml([], { fetchPage: async url => ({ status: 200, url, html: schemaHtml([unknown]) }) })
  assert.equal(readSourceObservationEvidence(allUnknown, config.source), null)
  assert.notEqual(readInventoryEvidence(allUnknown).status, 'verified-empty')
})

test('department, category, role-area and counts-only metadata never become vacancies', async () => {
  await assert.rejects(runHtml([], { fetchPage: async url => ({ status: 200, url, html: '<h1>Careers</h1>'
    + '<script type="application/ld+json">' + JSON.stringify({ '@type': 'ItemList', numberOfItems: 900,
      itemListElement: ['Department', 'Category', 'RoleArea'].map((type, id) => ({ '@type': type, identifier: { value: id }, title: 'Engineering' })) }) + '</script>' }) }),
  error => error.failureKind === 'coverage_gap' && error.recruitmentObservations.nativeRecords === 0)
})

const workdayURL = 'https://fixture.wd1.myworkdayjobs.com/External'
const workdayRow = (id, locationsText = 'United States') => ({ title: 'Software Engineer', externalPath: '/job/City/Engineer_' + id,
  locationsText, bulletFields: [id] })
const runWorkday = (payload, options = {}, overrides = {}) => createVerifiedRecruitmentScraper({ ...config, ...overrides }).run({
  now: () => clock, fetchPage: async url => ({ status: 200, url, html: '<h1>Careers</h1><a href="' + workdayURL + '">Jobs</a>' }),
  fetchJson: async url => { assert.ok(url.includes('/wday/cxs/fixture/External/jobs')); return structuredClone(payload) }, ...options,
})

test('Workday observes identified listing rows even when country filtering avoids every detail', async () => {
  const row = workdayRow('R1')
  const jobs = await runWorkday({ total: 3, jobPostings: [row, row, { title: 'Unidentified role' }] }, { maxPages: 1 })
  assert.equal(jobs.length, 0)
  audit(jobs, 1)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-role-identity-unavailable'))
})

test('Workday counts actually observed global rows before selecting an India facet', async () => {
  const global = { total: 500, jobPostings: [workdayRow('R-US')], facets: [{ facetParameter: 'locationCountry', values: [{ id: 'india-id', descriptor: 'India', count: 0 }] }] }
  const jobs = await runWorkday(global, { preferIndiaInventory: true, fetchJson: async (_url, init) =>
    Object.keys(JSON.parse(init.body).appliedFacets).length ? { total: 0, jobPostings: [] } : structuredClone(global) })
  assert.equal(jobs.length, 0)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 0)
  audit(jobs, 1)
})

test('Workday opening and actual closing listing, role and publisher reads count one native vacancy', async () => {
  const row = workdayRow('R1', 'Bengaluru, India')
  const country = { id: 'c4f78be1a8f14da0ab49ce1162348a5e', descriptor: 'India', alpha2Code: 'IN' }
  const detail = { hiringOrganization: { name: config.companyName }, jobPostingInfo: {
    id: '11111111111111111111111111111111', title: row.title, jobReqId: 'R1', jobPostingId: 'Engineer_R1',
    jobPostingSiteId: 'External', externalUrl: workdayURL + row.externalPath, jobDescription: description,
    country, jobRequisitionLocation: { country, descriptor: 'Bengaluru' }, location: 'Bengaluru', additionalLocations: [],
    startDate: '2026-10-30', posted: true, canApply: true,
  } }
  let listingReads = 0, roleReads = 0, publisherReads = 0
  const jobs = await runWorkday({ total: 1, jobPostings: [row] }, {
    fetchPage: async url => { if (url === config.companyCareerPage) publisherReads++; return { status: 200, url,
      html: '<h1>Careers</h1><a href="' + workdayURL + '">Jobs</a>' } },
    fetchJson: async url => { if (url.endsWith('/jobs')) { listingReads++; return { total: 1, jobPostings: [structuredClone(row)] } }
      roleReads++; return structuredClone(detail) },
  }, { reconcileWorkdayNativeContext: true })
  assert.equal(listingReads, 2)
  assert.equal(roleReads, 2)
  assert.equal(publisherReads, 2)
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0].nativeSourceRecord, detail)
  assert.deepEqual(jobs[0].nativeClosingSourceRecord, detail)
  assert.equal(jobs[0].sourceNativeClosingContext.eachFullRoleRechecked, true)
  assert.equal(jobs[0].sourceNativeClosingContext.allSelectedListingPagesRechecked, true)
  audit(jobs, 1)
})

test('a native total without observed identifiable rows stays unknown', async () => {
  const jobs = await runWorkday({ total: 27, jobPostings: [] }, { maxPages: 1 })
  assert.equal(readSourceObservationEvidence(jobs, config.source), null)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeInventoryReads[0].reportedTotal, 27)
})

const ashbyRow = (id, title = 'Software Engineer') => ({ id, title, isListed: true, location: 'San Francisco, United States',
  address: { postalAddress: { addressCountry: 'US' } }, descriptionHtml: description,
  jobUrl: 'https://jobs.ashbyhq.com/fixture/' + id, applyUrl: 'https://jobs.ashbyhq.com/fixture/' + id + '/application' })
const runAts = (boards, fetchJson, options = {}) => createVerifiedRecruitmentScraper(config).run({ now: () => clock,
  fetchPage: async url => ({ status: 200, url, html: '<h1>Careers</h1>' + boards.map(board => '<a href="' + board + '">Jobs</a>').join('') }),
  fetchJson, ...options })

test('delegated ATS records are typed before filtering and explicit prospects are non-vacancies', async () => {
  const jobs = await runAts(['https://jobs.ashbyhq.com/fixture'], async () => ({ apiVersion: '1', jobs: [ashbyRow('job-1'), ashbyRow('pool-1', 'Talent Network')] }))
  audit(jobs, 2, 1, 'mixed')
  const greenhouse = await runAts(['https://job-boards.greenhouse.io/fixture'], async () => ({ jobs: [
    { id: 1, title: 'Software Engineer', company_name: config.companyName, location: { name: 'United States' }, content: description,
      absolute_url: 'https://job-boards.greenhouse.io/fixture/jobs/1', internal_job_id: 10 },
    { id: 2, title: 'Future opportunities', company_name: config.companyName, content: description,
      absolute_url: 'https://job-boards.greenhouse.io/fixture/jobs/2', internal_job_id: null },
  ], departments: [{ id: 45, name: 'Engineering' }], meta: { total: 2 } }))
  audit(greenhouse, 2, 1, 'mixed')
})

test('the same native ID on different advertised ATS boards remains two observations', async () => {
  const jobs = await runAts(['https://jobs.ashbyhq.com/fixture', 'https://jobs.ashbyhq.com/second'], async url => {
    const board = url.split('/').at(-1)
    const row = ashbyRow('same-id')
    return { apiVersion: '1', jobs: [{ ...row, jobUrl: row.jobUrl.replace('/fixture/', '/' + board + '/'), applyUrl: row.applyUrl.replace('/fixture/', '/' + board + '/') }] }
  })
  audit(jobs, 2)
})

test('a failed ATS envelope or category payload cannot manufacture vacancies', async () => {
  const jobs = await runAts(['https://jobs.ashbyhq.com/fixture'], async () => ({ error: 'denied', jobs: [ashbyRow('not-observed')] }))
  assert.equal(jobs.length, 0)
  assert.equal(readSourceObservationEvidence(jobs, config.source), null)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
  await assert.rejects(runAts(['https://jobs.ashbyhq.com/fixture'], async () => ({ categories: [{ id: 'category', title: 'Engineering' }], total: 400 })),
    error => error.failureKind === 'coverage_gap' && error.recruitmentObservations.nativeRecords === 0)
})

test('Lever native vacancy rows remain observable when an unresolved country prevents extraction', async () => {
  const row = { id: 'lever-1', text: 'Software Engineer', country: null, categories: { location: 'Worldwide' },
    description, hostedUrl: 'https://jobs.lever.co/fixture/lever-1', applyUrl: 'https://jobs.lever.co/fixture/lever-1/apply' }
  const jobs = await runAts(['https://jobs.lever.co/fixture'], async () => [row])
  assert.equal(jobs.length, 0)
  audit(jobs, 1)
})

test('SmartRecruiters counts distinct native listing IDs before requesting India details', async () => {
  const jobs = await runAts(['https://jobs.smartrecruiters.com/fixture'], async () => ({ totalFound: 3, content: [
    { id: 'sr-us', name: 'Software Engineer', location: { country: 'US' } },
    { id: 'sr-unknown', name: 'Software Engineer', location: {} },
    { id: 'sr-other', name: 'Software Engineer', location: { country: 'GB' } },
  ] }))
  assert.equal(jobs.length, 0)
  audit(jobs, 3)
})

test('Workable observes listing shortcodes before country and explicit detail-budget filters', async () => {
  let detailCalls = 0
  const jobs = await runAts(['https://apply.workable.com/fixture/'], async url => {
    if (url.endsWith('/api/v1/accounts/fixture')) return { id: 10, uid: 'account-uid', name: config.companyName,
      subdomain: 'fixture', url: 'https://employer.test/' }
    if (url.includes('/widget/')) return { name: config.companyName, jobs: [
      { shortcode: 'POSTUS1', title: 'Software Engineer', country: 'US', url: 'https://apply.workable.com/fixture/j/POSTUS1/' },
      { shortcode: 'POSTIN1', title: 'Software Engineer', country: 'IN', url: 'https://apply.workable.com/fixture/j/POSTIN1/' },
      { shortcode: 'POSTIN2', title: 'Software Engineer', country: 'IN', url: 'https://apply.workable.com/fixture/j/POSTIN2/' },
    ] }
    detailCalls++
    return { id: 101, accountUid: 'account-uid', shortcode: 'POSTIN1', title: 'Software Engineer', state: 'published',
      isInternal: false, approvalStatus: 'approved', locations: [{ hidden: false, countryCode: 'IN', country: 'India', city: 'Bengaluru' }],
      description, published: '2026-10-30' }
  }, { maxDetails: 1 })
  assert.equal(detailCalls, 1)
  assert.equal(jobs.length, 1)
  audit(jobs, 3)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-detail-budget-reached'))
})

const phenomRef = 'EXAMPLE_REF'
const phenomRow = { jobId: 'ph-1', title: 'Software Engineer', country: 'India', siteType: 'external', visibilityType: 'External',
  uniqueValue: { refNum: phenomRef, jobId: 'ph-1', siteType: 'external' }, description, companyName: config.companyName,
  city: 'Bengaluru', postedDate: '2026-10-30' }
const phenomPage = (pageName, { rows = [phenomRow], role = null, facets = false } = {}) => {
  const app = { baseUrl: 'https://employer.test/', baseDomain: 'https://employer.test', widgetApiEndpoint: 'https://employer.test/widgets',
    siteType: 'external', refNum: phenomRef, pageName, locale: 'en', deviceType: 'desktop', country: 'global' }
  const ddo = { siteConfig: { status: 'success', data: { refNum: phenomRef, urlMap: { job: 'job/:jobId/:title' } } },
    eagerLoadRefineSearch: { status: 200, totalHits: 100, data: { jobs: rows,
      ...(facets ? { aggregations: [{ field: 'country', value: { India: 1 } }] } : {}) } },
    ...(role ? { jobDetail: { status: 200, hits: 1, totalHits: 1, data: { job: role } } } : {}) }
  return '<h1>Software Engineer</h1>' + description + '<script>var phApp=' + JSON.stringify(app)
    + ';phApp.ddo=' + JSON.stringify(ddo) + ';</script>'
}

test('Phenom eager, API, repeated full-role and schema representations share a native identity', async () => {
  const roleURL = 'https://employer.test/job/ph-1/Software%20Engineer'
  const schema = { ...posting('ph-1', 'IN'), url: roleURL }
  let apiCalls = 0
  const jobs = await createVerifiedRecruitmentScraper({ ...config, discoverLiteralRecruitmentData: true, deduplicatePhenomNativeIds: true }).run({
    now: () => clock, fetchPage: async url => ({ status: 200, url, html: url === roleURL
      ? phenomPage('job', { role: phenomRow }) + '<script type="application/ld+json">' + JSON.stringify(schema) + '</script>'
      : phenomPage('search-results', { facets: true }) }),
    fetchJson: async url => { assert.equal(url, 'https://employer.test/widgets'); apiCalls++; return {
      refineSearch: { status: 200, totalHits: 1, data: { jobs: [phenomRow] } },
    } },
  })
  assert.equal(apiCalls, 1)
  assert.equal(jobs.length, 1)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords >= 4)
  audit(jobs, 1)
  assert.deepEqual(jobs[0].nativeSourceRecord, phenomRow)
})

test('Phenom duplicate listing IDs never turn the published total into observed vacancies', async () => {
  const foreign = { ...phenomRow, country: 'United States' }
  const jobs = await createVerifiedRecruitmentScraper({ ...config, discoverLiteralRecruitmentData: true }).run({
    now: () => clock, maxPages: 1, fetchPage: async url => ({ status: 200, url, html: phenomPage('careers', { rows: [foreign, foreign] }) }),
  })
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 2)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeInventoryReads[0].reportedTotal, 100)
  audit(jobs, 1)
})

test('Keka validated row callbacks deduplicate a public schema and retain foreign and unknown rows', async () => {
  const identifier = '11111111-1111-4111-8111-111111111111'
  const board = 'https://fixture.keka.com/careers', prefix = board + '/', roleURL = prefix + 'jobdetails/1'
  const documentURL = 'https://fixture.keka.com/ats/documents/' + identifier + '/careerportal/abc123.html'
  const rows = [{ id: 1, title: 'Software Engineer', description, jobLocations: [{ countryCode: 'US', countryName: 'United States' }] },
    { id: 2, title: 'Software Engineer', description, jobLocations: [] }]
  const jobs = await createVerifiedRecruitmentScraper({ ...config, officialHomepageUrl: config.companyCareerPage }).run({ now: () => clock,
    fetchPage: async url => ({ status: 200, url, html: url === board ? '<script>fetch(' + JSON.stringify(documentURL) + ')</script>'
      : url === documentURL ? '<script>window.khConfig=' + JSON.stringify({ identifier, domain: prefix }) + '</script><script src="' + prefix + 'api/embedjobs/js/' + identifier + '"></script>'
        : url.includes('/api/embedjobs/js/') ? 'api/organization/${portalName}/careerportalinfo api/embedjobs/${portalName}/active/ khConfig.identifier job.jobLocations jobdetails/'
          : url === roleURL ? schemaHtml([{ ...posting('1'), url: roleURL }])
            : '<h1>Careers</h1><a href="' + board + '">Jobs</a><a href="' + roleURL + '">Job</a>' }),
    fetchJson: async url => url.endsWith('/careerportalinfo')
      ? { name: config.companyName, careersPortalDomain: 'fixture.keka.com' } : structuredClone(rows),
  })
  assert.equal(jobs.length, 0)
  audit(jobs, 2)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 3)
})

test('the declared first-party Keka feed observes native rows before native country filtering', async () => {
  const feed = { contract: 'keka-webflow', url: 'https://employer.test/current-roles.json', rolePrefix: 'https://fixture.keka.com/careers/jobdetails/' }
  const rows = [1, 2].map(id => ({ id: '11111111-1111-4111-8111-' + String(id).padStart(12, '0'), name: 'Software Engineer',
    url: feed.rolePrefix + id, description, locations: [{ country: { name: id === 1 ? 'United States' : 'Unknown' } }] }))
  const jobs = await createVerifiedRecruitmentScraper({ ...config, nativeJsonFeed: feed }).run({ now: () => clock,
    fetchPage: async url => ({ status: 200, url, html: '<h1>Careers</h1><script>fetch(' + JSON.stringify(feed.url) + ')</script>' }),
    fetchJson: async url => { assert.equal(url, feed.url); return structuredClone(rows) },
  })
  assert.equal(jobs.length, 0)
  audit(jobs, 2)
})

test('Oracle validated native callbacks count row identities before country and detail eligibility', async () => {
  const board = 'https://fixture.fa.us1.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1'
  const jobs = await createVerifiedRecruitmentScraper(config).run({ now: () => clock,
    fetchPage: async url => ({ status: 200, url, html: url === board
      ? '<title>' + config.companyName + '</title><base href="' + board + '/" data-sitenumber="1" data-apibaseurl="https://fixture.fa.us1.oraclecloud.com/">'
      : '<h1>Careers</h1><a href="' + board + '">Jobs</a>' }),
    fetchJson: async () => ({ count: 1, hasMore: false, items: [{ SiteNumber: '1', Offset: 0, Limit: 20, TotalJobsCount: 2,
      requisitionList: [{ Id: '101', Title: 'Software Engineer', PrimaryLocationCountry: 'US' }, { Id: '102', Title: 'Software Engineer' }] }] }),
  })
  assert.equal(jobs.length, 0)
  audit(jobs, 2)
})

test('Jibe validated native callbacks count repeated paginated identities once before country filtering', async () => {
  const client = 'https://app.jibecdn.com/prod/search/1.2.3/main.js'
  const account = { cid: 'fixture' }, searchConfig = { externalSearch: true, isLoggedIn: false, path: '/jobs', locale: 'en-us', numRowsPerPage: 20 }
  const script = 'this.http.get("/api/jobs");this.http.get(`/api/jobs/${slug}/${language}`);const role=`/jobs/${data.slug}?lang=${language}`;'
  const jobs = await createVerifiedRecruitmentScraper({ ...config, discoverJibeRecruitmentData: true }).run({ now: () => clock,
    fetchPage: async url => ({ status: 200, url, html: url === client ? script : '<h1>Careers</h1><script>var _jibe='
      + JSON.stringify(account) + ';var searchConfig=' + JSON.stringify(searchConfig) + ';</script><script src="' + client + '"></script>' }),
    fetchJson: async () => ({ totalCount: 2, jobs: [{ data: { req_id: 'jibe-1', slug: 'native-role', title: 'Software Engineer',
      client_code: 'fixture', internal: false, searchable: true, applyable: true, country: 'United States', country_code: 'US' } }] }),
  })
  assert.equal(jobs.length, 0)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 1)
  audit(jobs, 1)
})

test('SAP unified search candidates are observations even if every detail is unavailable', async () => {
  const manager = 'j2w.SearchManager=(function(){ $.ajax({type:"POST",url:"/services/recruiting/v1/jobs"}); })();'
  const renderer = 'j2w.SearchResultsUnify=(function(){const route="/job/";const locale=resultStyles.currentLocale;})();'
  const jobs = await createVerifiedRecruitmentScraper({ ...config, prioritizeRecruitmentSearch: true }).run({ now: () => clock,
    fetchPage: async url => ({ status: url.includes('/job/') ? 403 : 200, url, html: url.includes('searchManager') ? manager
      : url.includes('searchResultsUnify') ? renderer : url.includes('/job/') ? 'Denied'
        : '<h1>Careers</h1><div id="jobSearch_fixture"></div><script>var resultStyles={companyId:"fixture",currentLocale:"en_US"};</script>'
          + '<script src="/platform/js/j2w/min/j2w.searchManager.min.js"></script><script src="/platform/js/j2w/min/j2w.searchResultsUnify.min.js"></script>' }),
    fetchJson: async () => ({ totalJobs: 900, jobSearchResult: ['101', '102'].map(id => ({ response: { id, unifiedStandardTitle: 'Software Engineer',
      unifiedUrlTitle: 'Software-Engineer', supportedLocales: ['en_US'] } })) }),
  })
  assert.equal(jobs.length, 0)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 0)
  audit(jobs, 2)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].failures.some(failure => failure.status === 403))
})

test('known vacancies survive later native detail or optional page failures', async () => {
  const denied = 'https://employer.test/careers/jobs/denied'
  const jobs = await runHtml([posting('known')], { fetchPage: htmlTransport([posting('known')], {
    extraLinks: [denied], changes: new Map([[denied, { status: 403, html: 'Denied' }]]),
  }) })
  audit(jobs, 1)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].failures[0].status, 403)
})

test('limits are enforced and pre-observation outages retain actual errors', async () => {
  for (const name of ['maxPages', 'maxRequests', 'maxDetails', 'sourceTimeoutMs']) {
    await assert.rejects(runHtml([], { [name]: 0 }), new RegExp('Invalid recruitment limit: ' + name))
  }
  await assert.rejects(runHtml([posting('not-read')], { maxPages: 1 }), error =>
    error.failureKind === 'coverage_gap' && error.recruitmentObservations.nativeRecords === 0)
  for (const status of [403, 503]) await assert.rejects(runHtml([], { fetchPage: async url => ({ status, url, html: 'Unavailable' }) }), error => {
    assert.equal(error.status, status)
    assert.equal(error.recruitmentObservations.nativeRecords, 0)
    assert.equal(error.upstreamOutage, true)
    assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed, false)
    return true
  })
})

test('opaque cancellation reasons propagate exactly before and during native requests', async () => {
  for (const during of [false, true]) {
    const controller = new AbortController(), reason = Object.freeze({ opaqueCancellation: during ? 'during' : 'before' })
    if (!during) controller.abort(reason)
    await assert.rejects(runHtml([], { signal: controller.signal, fetchPage: async url => {
      controller.abort(reason); return { status: 200, url, html: schemaHtml([posting('cancelled')]) }
    } }), error => error === reason)
  }
})

test('an existing source export and its actual registered adapter preserve positive empty-array observations', async () => {
  const provider = getScraperCatalog().find(item => item.source === exported2u.SOURCE)
  assert.ok(provider)
  // The current 2U export uses original publication bytes. Keep this same
  // positive foreign-vacancy/empty-India contract on its real public model.
  const directory = new URL('./fixtures/twoUCurrent20261107C31/', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'))
  const pages = new Map(manifest.records.map(record => {
    const body = gunzipSync(readFileSync(new URL(record.bodyFile, directory)))
    assert.equal(body.length, record.bytes)
    assert.equal(createHash('sha256').update(body).digest('hex'), record.sha256)
    return [record.requestedUrl, { url: record.finalUrl, status: record.status, headers: record.headers,
      bodyBase64: body.toString('base64'), requestedAt: record.sourceRequestedAt, completedAt: record.sourceCompletedAt }]
  }))
  const calls = []
  const options = { now: () => clock,
    fetchPage: async (url, init) => {
      assert.ok(pages.has(url), 'Only exact original 2U publication URLs may run')
      assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit')
      calls.push(url)
      return structuredClone(pages.get(url))
    },
  }
  const exported = await exported2u.run(options), registered = await createCatalogScraper(provider).run(options)
  assert.equal(calls.length, 32)
  assert.equal(exported.length, 0)
  assert.equal(registered.length, 0)
  const expected = { source: provider.source, recordKind: 'vacancy-rows', observedRecordCount: 1, observedVacancyCount: 1,
    sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null }
  for (const jobs of [exported, registered]) {
    assert.deepEqual(readSourceObservationEvidence(jobs, provider.source), expected)
    const inventory = readInventoryEvidence(jobs)
    assert.equal(inventory.status, 'coverage-gap'); assert.equal(inventory.listingComplete, false)
    assert.equal(inventory.reportedTotal, null); assert.equal(inventory.indiaFacetCount, null)
    assert.equal(inventory.verifiedAt, clock)
    assert.equal(extractionRawJobMetrics(provider, jobs, inventory).rawJobs, 1)
  }
  assert.equal(exported.sourceAudit.lifecycleCleanupAllowed, false)
  assert.equal(exported.sourceAudit.sourceScopeComplete, false)
  assert.equal(exported.sourceAudit.observedAt, clock)
  assert.equal(exported.sourceAudit.observations[0].country, 'United States')
  assert.equal(exported.sourceAudit.observations[0].sourceDetailComplete, true)
  const result = diagnostics(registered, undefined, provider)
  assert.equal(result.rawRecords, 1)
  assert.equal(result.jobs, 0)
  assert.equal(result.eligibleJobs, 0)
  assert.deepEqual(result.sourceObservations, expected)
  assert.equal(result.inventoryEvidence.reportedTotal, null)
})

// Regression controls promoted from the independently reproduced four-case RED
// report. These remain synthetic and make no current employer inventory claim.
test('delegated India Open Application is a retained hiring signal rather than a returned vacancy', async () => {
  const row = { ...ashbyRow('open-intake', 'Open Application'), location: 'Bengaluru, India',
    address: { postalAddress: { addressCountry: 'IN' } } }
  const jobs = await runAts(['https://jobs.ashbyhq.com/fixture'], async () => ({ apiVersion: '1', jobs: [row] }))
  assert.equal(jobs.length, 0)
  audit(jobs, 1, 0, 'hiring-signals')
  const excluded = jobs[RECRUITMENT_OBSERVATIONS].exclusions.find(item => item.reason === 'native-generic-intake')
  assert.deepEqual(excluded.nativeSourceRecord, row)
})

test('a rejected foreign account intake cannot erase a proven vacancy from the first advertised account', async () => {
  const vacancy = ashbyRow('same-id'), foreignIntake = { ...vacancy, title: 'General Application' }
  const jobs = await runAts(['https://jobs.ashbyhq.com/fixture', 'https://jobs.ashbyhq.com/second'],
    async url => ({ apiVersion: '1', jobs: [url.endsWith('/fixture') ? vacancy : foreignIntake] }))
  assert.equal(jobs.length, 0)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].failures.length > 0)
  audit(jobs, 1)
})

test('Workday employment bullets do not merge distinct native requisition paths', async () => {
  const rows = [workdayRow('R1'), { ...workdayRow('R2'), title: 'Product Designer' }]
    .map(row => ({ ...row, bulletFields: ['Full time'] }))
  const jobs = await runWorkday({ total: 2, jobPostings: rows }, { maxPages: 1 })
  assert.equal(jobs.length, 0)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 2)
  audit(jobs, 2)
})

test('Jibe native ID and schema representation deduplicate at the declared language URL', async () => {
  const roleURL = 'https://employer.test/jobs/native-role?lang=en-us'
  const row = { data: { req_id: 'jibe-1', slug: 'native-role', title: 'Software Engineer', client_code: 'fixture',
    internal: false, searchable: true, applyable: true, country: 'United States', country_code: 'US' } }
  const schema = { ...posting('jibe-1'), url: roleURL }
  const client = 'https://app.jibecdn.com/prod/search/1.2.3/main.js'
  const script = 'this.http.get("/api/jobs");this.http.get(`/api/jobs/${slug}/${language}`);const role=`/jobs/${data.slug}?lang=${language}`;'
  const jobs = await createVerifiedRecruitmentScraper({ ...config, discoverJibeRecruitmentData: true }).run({ now: () => clock,
    fetchPage: async url => ({ status: 200, url, html: url === client ? script : url === roleURL ? schemaHtml([schema])
      : '<h1>Careers</h1><script>var _jibe={cid:"fixture"};var searchConfig={externalSearch:true,isLoggedIn:false,path:"/jobs",locale:"en-us",numRowsPerPage:20};</script>'
        + '<script src="' + client + '"></script><a href="' + roleURL + '">Job</a>' }),
    fetchJson: async () => ({ totalCount: 1, jobs: [row] }) })
  assert.equal(jobs.length, 0)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 2)
  audit(jobs, 1)
})

test('an existing page ID alias cannot join two independently identified native accounts', () => {
  const ledger = createRecruitmentObservationAccounting(config.source)
  const first = { scope: 'ashby:global:one', id: '42', url: 'https://jobs.ashbyhq.com/one/42', title: 'Software Engineer' }
  const second = { scope: 'ashby:global:two', id: '42', url: 'https://jobs.ashbyhq.com/two/42', title: 'Product Designer' }
  assert.equal(ledger.observe(first), true)
  assert.equal(ledger.observe(second), true)
  assert.equal(ledger.observe({ ...first, scope: 'native-page:https://jobs.ashbyhq.com' }), true)
  assert.equal(ledger.observe({ ...second, scope: 'native-page:https://jobs.ashbyhq.com' }), false)
  const evidence = readSourceObservationEvidence(ledger.attach([]), config.source)
  assert.equal(evidence.observedRecordCount, 2)
  assert.equal(evidence.observedVacancyCount, 2)
  assert.equal(evidence.sourceScopeComplete, false)
  assert.equal(evidence.companyGlobalTotal, null)
})
