import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedRecruitmentScraper, recruitmentBoard, recruitmentIndiaFacet, RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { decorateJobsWithProviderMetadata } from '../scraper-support/providers/index.js'

const provider = { source: 'example', companyName: 'Example Corporation', companyDomain: 'employer.test',
  companyCareerPage: 'https://employer.test/careers' }
const description = '<p>Design and maintain production software services, review API contracts, investigate distributed system failures, and collaborate with the product engineering team.</p>'
const posting = { '@type': 'JobPosting', identifier: { value: 'role-1' }, title: 'Software Engineer',
  url: 'https://employer.test/careers/engineer', hiringOrganization: { name: provider.companyName }, description,
  jobLocation: { address: { addressLocality: 'Bengaluru', addressCountry: 'IN' } }, datePosted: '2026-10-30' }
const roleHTML = (record = posting, options = {}) => `<html><h1>${options.title || record.title}</h1>${options.description ?? record.description}
  <script type="application/ld+json">${JSON.stringify(record)}</script></html>`
const pages = overrides => async url => ({ status: 200, url, html: ({
  [provider.companyCareerPage]: '<h1>Careers</h1><a href="/careers/engineer">Software Engineer</a>',
  [posting.url]: roleHTML(), 'https://employer.test/': '<h1>Example Corporation</h1>', ...overrides,
})[url] || '<h1>Careers</h1>' })
const run = options => createVerifiedRecruitmentScraper(provider).run({ now: () => '2026-11-03T10:00:00Z', fetchPage: pages(), ...options })

test('follows current first-party role links and extracts native India JobPosting content and dates', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Unit tests forbid live HTTP'))
  const jobs = await run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, provider.source)
  assert.equal(jobs[0].company, provider.companyName)
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].jobDescription, description)
  assert.equal(jobs[0].postingDate, posting.datePosted)
  assert.equal(jobs[0].applyUrl, posting.url)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 1)
  const decorated = decorateJobsWithProviderMetadata(jobs, provider)
  assert.equal(decorated[RECRUITMENT_OBSERVATIONS], jobs[RECRUITMENT_OBSERVATIONS])
})

for (const [name, change] of [
  ['foreign country', { jobLocation: { address: { addressCountry: 'US', addressLocality: 'Bengaluru' } } }],
  ['unscoped remote work', { jobLocation: null, jobLocationType: 'TELECOMMUTE' }],
  ['a city without a native country', { jobLocation: { address: { addressLocality: 'Bengaluru' } } }],
  ['a different employer', { hiringOrganization: { name: 'Parent Company' } }],
  ['missing employer', { hiringOrganization: null }],
  ['an expired role', { validThrough: '2026-10-31' }],
  ['a teaser description', { description: '<p>Apply now</p>' }],
]) test(`does not turn ${name} into an India vacancy or verified zero`, async () => {
  const jobs = await run({ fetchPage: pages({ [posting.url]: roleHTML({ ...posting, ...change }) }) })
  assert.equal(jobs.length, 0)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('remote work qualifies only with a native explicit India applicant restriction', async () => {
  const native = { ...posting, jobLocation: null, jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: { name: 'India' } }
  assert.equal((await run({ fetchPage: pages({ [posting.url]: roleHTML(native) }) })).length, 1)
})

test('schema content must agree with the visible title and full description', async () => {
  for (const html of [roleHTML(posting, { title: 'Different Job' }), roleHTML(posting, { description: '<p>Apply now</p>' }),
    '<h1>Software Engineer</h1>' + description + '<template><script type="application/ld+json">' + JSON.stringify(posting) + '</script></template>']) {
    try {
      const jobs = await run({ fetchPage: pages({ [posting.url]: html }) })
      assert.equal(jobs.length, 0)
    } catch (error) { assert.equal(error.failureKind, 'coverage_gap') }
  }
})

test('ignores blocked pages, unsafe URLs, inert links, assets and unbound foreign redirects', async () => {
  let nativeCalls = 0
  const cases = [
    ['blocked_or_access_denied', async url => ({ status: 403, url, html: roleHTML() })],
    ['coverage_gap', async () => ({ status: 200, url: 'https://foreign.test/careers', html: roleHTML() })],
    ['coverage_gap', pages({ [provider.companyCareerPage]: '<template><a href="/careers/engineer">Jobs</a></template><a href="https://127.0.0.1/jobs">Jobs</a>' })],
    ['coverage_gap', pages({ [provider.companyCareerPage]: '<a href="https://someone.test/jobs">Jobs</a><a href="/careers/image.jpg">Jobs</a>' })],
  ]
  for (const [failureKind, fetchPage] of cases) await assert.rejects(run({ fetchPage, fetchJson: async () => { nativeCalls++; assert.fail('No board is bound') } }), error => error.failureKind === failureKind)
  assert.equal(nativeCalls, 0)
})

test('schema advertisements of another page cannot bypass a failed detail read', async () => {
  await assert.rejects(run({ fetchPage: async url => url === provider.companyCareerPage
    ? { status: 200, url, html: roleHTML() } : { status: 404, url, html: '' } }), error => error.failureKind === 'coverage_gap')
})

const ashbyRole = { id: 'aa97cb32-cafa-4ea2-993e-f3dba73aabb7', title: posting.title,
  location: 'Bengaluru, India', address: { postalAddress: { addressCountry: 'IN', addressLocality: 'Bengaluru' } },
  jobUrl: 'https://jobs.ashbyhq.com/Example%20Corporation/aa97cb32-cafa-4ea2-993e-f3dba73aabb7',
  applyUrl: 'https://jobs.ashbyhq.com/Example%20Corporation/aa97cb32-cafa-4ea2-993e-f3dba73aabb7/application',
  descriptionHtml: description, isListed: true }
test('current public ATS links delegate only to their exact native account', async () => {
  const requests = []
  const jobs = await run({ fetchPage: pages({ [provider.companyCareerPage]: '<a href="https://jobs.ashbyhq.com/Example%20Corporation">Open roles</a>' }),
    fetchJson: async url => { requests.push(url); return { apiVersion: '1', jobs: [ashbyRole] } } })
  assert.deepEqual(requests, ['https://api.ashbyhq.com/posting-api/job-board/Example%20Corporation'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, ashbyRole.applyUrl)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('an explicitly delegated public job page can provide native employer-scoped JobPosting content', async () => {
  const url = 'https://example.breezy.hr/p/role-1'
  const native = { ...posting, url }
  const jobs = await run({ fetchPage: async requested => requested === url
    ? { status: 200, url, html: roleHTML(native) }
    : { status: 200, url: requested, html: requested === provider.companyCareerPage ? `<a href="${url}">Open role</a>` : '<p>Example Corporation</p>' } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, url)
})

test('a current company may explicitly delegate a scoped public careers page on another recruiting host', async () => {
  const config = { ...provider, allowDeclaredExternalCareersPages: true }
  const nativeURL = 'https://jobs.recruiting-host.test/example/role-1'
  const record = { ...posting, url: nativeURL }
  const jobs = await createVerifiedRecruitmentScraper(config).run({ fetchPage: async url => ({ status: 200, url,
    html: url === nativeURL ? roleHTML(record) : `<h1>Example Corporation</h1><a href="${nativeURL}">Current openings</a>` }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, nativeURL)
  await assert.rejects(createVerifiedRecruitmentScraper(config).run({ fetchPage: async url => ({ status: 200, url,
    html: `<h1>Careers</h1><template><a href="${nativeURL}">Jobs</a></template>` }) }), error => error.failureKind === 'coverage_gap')
})

test('Workday reads an advertised tenant/site and validates native role identity, employer and country', async () => {
  const board = 'https://example.wd1.myworkdayjobs.com/External', api = 'https://example.wd1.myworkdayjobs.com/wday/cxs/example/External'
  const externalPath = '/job/Bengaluru/Software-Engineer_R123'
  const requests = []
  const jobs = await run({ fetchPage: pages({ [provider.companyCareerPage]: `<a href="${board}">Open jobs</a>` }),
    fetchJson: async (url, init) => {
      requests.push({ url, method: init.method })
      if (url === api + '/jobs') {
        assert.equal(init.method, 'POST'); assert.deepEqual(JSON.parse(init.body).appliedFacets, {})
        return { total: 1, jobPostings: [{ externalPath, title: posting.title, locationsText: 'Bengaluru, India' }] }
      }
      assert.equal(url, api + externalPath)
      return { hiringOrganization: { name: provider.companyName }, jobPostingInfo: { jobReqId: 'R123', title: posting.title,
        externalUrl: board + externalPath, country: { descriptor: 'India' }, location: 'Bengaluru', jobDescription: description, startDate: '2026-10-30' } }
    } })
  assert.equal(requests.length, 2)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, board + externalPath)
  assert.equal(jobs[0].postingDate, '2026-10-30')
})

test('Workday recruiting URLs on myworkdaysite retain their advertised tenant and site path', async () => {
  const board = 'https://wd3.myworkdaysite.com/recruiting/example/External', path = '/job/Bengaluru/Software-Engineer_R123'
  const api = 'https://wd3.myworkdaysite.com/wday/cxs/example/External'
  const jobs = await run({ fetchPage: pages({ [provider.companyCareerPage]: `<a href="${board}">Open jobs</a>` }),
    fetchJson: async url => {
      if (url === api + '/jobs') return { total: 1, jobPostings: [{ title: posting.title, externalPath: path, locationsText: 'Bengaluru, India' }] }
      assert.equal(url, api + path)
      return { hiringOrganization: { name: provider.companyName }, jobPostingInfo: { jobReqId: 'R123', title: posting.title,
        externalUrl: board + path, country: { descriptor: 'India' }, jobDescription: description } }
    } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, board + path)
  assert.equal(recruitmentBoard('https://wd3.myworkdaysite.com/en-US/recruiting/example/External').tenant, 'example')
})

test('SmartRecruiters keeps native public application URLs and refuses an API URL as an application link', async () => {
  for (const applyUrl of ['https://jobs.smartrecruiters.com/Example/role-1', undefined]) {
    const jobs = await run({ fetchPage: pages({ [provider.companyCareerPage]: '<a href="https://careers.smartrecruiters.com/Example">Careers</a>' }),
      fetchJson: async url => url.includes('?') ? { totalFound: 1, content: [{ id: 'role-1', name: posting.title, location: { country: 'IN' } }] }
        : { id: 'role-1', name: posting.title, applyUrl, company: { name: provider.companyName }, location: { country: 'IN', city: 'Bengaluru' },
          releasedDate: '2026-10-30', jobAd: { sections: { jobDescription: { text: description } } } } })
    assert.equal(jobs.length, applyUrl ? 1 : 0)
    if (applyUrl) assert.equal(jobs[0].applyUrl, applyUrl)
  }
})

test('Workday retains the first total when later native pages suppress it to zero', async () => {
  const board = 'https://example.wd1.myworkdayjobs.com/External'
  const offsets = []
  const jobs = await run({ fetchPage: pages({ [provider.companyCareerPage]: `<a href="${board}">Jobs</a>` }),
    fetchJson: async (_url, init) => {
      const { offset } = JSON.parse(init.body); offsets.push(offset)
      return { total: offset === 0 ? 21 : 0, jobPostings: Array.from({ length: offset === 0 ? 20 : 1 }, (_, index) => ({
        externalPath: '/job/London/Role_' + (offset + index), title: 'Software Engineer', locationsText: 'London, United Kingdom',
      })) }
    } })
  assert.deepEqual(offsets, [0, 20])
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 21)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].failures.length, 0)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('Workday selects only the actual native India country facet and still qualifies each detail country', async () => {
  const board = 'https://example.wd1.myworkdayjobs.com/External'
  const path = '/job/Bengaluru/Software-Engineer_R123', filters = []
  const jobs = await run({ preferIndiaInventory: true,
    fetchPage: pages({ [provider.companyCareerPage]: `<a href="${board}">Jobs</a>` }),
    fetchJson: async (url, init) => {
      if (url.endsWith('/jobs')) {
        const body = JSON.parse(init.body); filters.push(body.appliedFacets)
        if (!body.appliedFacets.locationCountry) return { total: 5000, jobPostings: [], facets: [{ facetParameter: 'locationMainGroup',
          values: [{ facetParameter: 'locationCountry', values: [{ descriptor: 'India', id: 'actual-native-country-id', count: 1 }] }] }] }
        return { total: 1, jobPostings: [{ externalPath: path, title: posting.title, locationsText: 'Bengaluru, India' }] }
      }
      return { hiringOrganization: { name: provider.companyName }, jobPostingInfo: { jobReqId: 'R123', title: posting.title,
        externalUrl: board + path, country: { descriptor: 'India' }, jobDescription: description, startDate: '2026-10-30' } }
    },
  })
  assert.deepEqual(filters, [{}, { locationCountry: ['actual-native-country-id'] }])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeCountryFacet.id, 'actual-native-country-id')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('an arbitrary India location label cannot invent a Workday country filter', () => {
  assert.equal(recruitmentIndiaFacet({ facets: [{ facetParameter: 'locations', values: [{ descriptor: 'India', id: 'office-id', count: 5 }] }] }), null)
  assert.equal(recruitmentIndiaFacet({ facets: [] }), null)
  assert.throws(() => recruitmentIndiaFacet({ facets: [{ facetParameter: 'locationCountry', values: [
    { descriptor: 'India', id: 'one', count: 2 }, { descriptor: 'India', id: 'another', count: 2 },
  ] }] }), /Ambiguous/)
})

const workableAccount = { id: 12345, uid: 'native-account-uid', subdomain: 'example', name: provider.companyName, url: 'https://employer.test/' }
const workableLocation = { country: 'India', countryCode: 'IN', city: 'Bengaluru', region: 'Karnataka', hidden: false }
const workableListing = { shortcode: 'ABC123DEF4', title: posting.title, url: 'https://apply.workable.com/j/ABC123DEF4', locations: [workableLocation] }
const workableDetail = { id: 98765, accountUid: workableAccount.uid, shortcode: workableListing.shortcode, title: posting.title,
  state: 'published', isInternal: false, approvalStatus: 'approved', locations: [workableLocation],
  description, requirements: '<p>Experience building reliable services.</p>', benefits: '<p>Flexible working hours.</p>', published: '2026-10-30T12:00:00Z', type: 'full' }
const runWorkable = (account = workableAccount, detail = workableDetail) => run({
  fetchPage: pages({ [provider.companyCareerPage]: '<a href="https://apply.workable.com/example/">Open positions</a>' }),
  fetchJson: async url => url === 'https://apply.workable.com/api/v1/accounts/example' ? account
    : url === 'https://apply.workable.com/api/v1/widget/accounts/example' ? { name: workableAccount.name, jobs: [workableListing] }
      : url === 'https://apply.workable.com/api/v2/accounts/example/jobs/ABC123DEF4' ? detail
        : assert.fail('Unexpected native request: ' + url),
})

test('Workable binds a reciprocal native account and retains full published India role content', async () => {
  const jobs = await runWorkable()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, String(workableDetail.id))
  assert.equal(jobs[0].applyUrl, workableListing.url)
  assert.equal(jobs[0].postingDate, workableDetail.published)
  assert.equal(jobs[0].sourceDescription, [description, workableDetail.requirements, workableDetail.benefits].join('\n'))
  assert.equal(jobs[0].nativeSourceRecord.accountUid, workableAccount.uid)
  assert.equal(jobs[0].nativeHiringOrganization.name, workableAccount.name)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [name, change] of [['different employer', { name: 'Another Company' }], ['unrelated corporate owner', { url: 'https://other.test/' }],
  ['different tenant', { subdomain: 'other' }], ['error envelope', { error: 'unavailable' }]]) {
  test(`Workable rejects an account with ${name}`, async () => {
    await assert.rejects(runWorkable({ ...workableAccount, ...change }), error => error.failureKind === 'coverage_gap'
      && error.recruitmentObservations.failures.some(row => /account\/employer/.test(row.message)))
  })
}

for (const [name, change] of [['foreign country', { locations: [{ ...workableLocation, country: 'United States', countryCode: 'US' }] }],
  ['hidden country', { locations: [{ ...workableLocation, hidden: true }] }], ['contradictory country', { locations: [{ ...workableLocation, country: 'United States' }] }],
  ['unpublished job', { state: 'draft' }], ['internal job', { isInternal: true }], ['wrong native account', { accountUid: 'other-account' }]]) {
  test(`Workable refuses a ${name} as a public India job`, async () => {
    const jobs = await runWorkable(workableAccount, { ...workableDetail, ...change })
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
  })
}

test('a historical public ATS URL cannot substitute for a current corporate handoff', async () => {
  const config = { ...provider, companyCareerPage: 'https://jobs.ashbyhq.com/Example', officialHomepageUrl: 'https://employer.test/' }
  await assert.rejects(createVerifiedRecruitmentScraper(config).run({
    fetchPage: async url => ({ status: 200, url, html: '<h1>Example Corporation</h1>' }),
    fetchJson: () => assert.fail('No current corporate link authorized an ATS feed'),
  }), error => error.failureKind === 'coverage_gap')
})

test('an explicitly unqualified acquired-brand account cannot relabel native parent-company jobs', async () => {
  const config = { ...provider, requireNativeEmployerName: true }
  await assert.rejects(createVerifiedRecruitmentScraper(config).run({
    fetchPage: pages({ [provider.companyCareerPage]: '<a href="https://jobs.ashbyhq.com/Example%20Corporation">Open roles</a>' }),
    fetchJson: async () => ({ apiVersion: '1', jobs: [ashbyRole] }),
  }), error => error.failureKind === 'coverage_gap')
})

test('a newly researched company surface must expose its publisher identity before delegating to an ATS', async () => {
  const config = { ...provider, officialHomepageUrl: 'https://employer.test/', requireCorporateIdentityMatch: true }
  const jobs = await createVerifiedRecruitmentScraper(config).run({ fetchPage: pages(), now: () => '2026-11-03T10:00:00Z' })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].corporateIdentityEvidence[0].url, config.officialHomepageUrl)
  await assert.rejects(createVerifiedRecruitmentScraper(config).run({
    fetchPage: async url => ({ status: 200, url, html: '<title>Another Employer</title><h1>Careers</h1><a href="https://jobs.ashbyhq.com/Example">Jobs</a>' }),
    fetchJson: () => assert.fail('An unidentified publisher cannot delegate to a feed'),
  }), error => error.failureKind === 'coverage_gap')
})

test('publisher identity uses the actual title text when the visible heading is marketing copy', async () => {
  const config = { ...provider, requireCorporateIdentityMatch: true, officialHomepageUrl: 'https://employer.test/' }
  const jobs = await createVerifiedRecruitmentScraper(config).run({
    fetchPage: async url => ({ status: 200, url, html: '<title>Careers at Example Corporation</title><h1>Build the future</h1><a href="https://jobs.ashbyhq.com/Example%20Corporation">Open jobs</a>' }),
    fetchJson: async () => ({ apiVersion: '1', jobs: [ashbyRole] }),
  })
  assert.equal(jobs.length, 1)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].corporateIdentityEvidence[0].publisherNames.includes('Careers at Example Corporation'))
})

test('a verified company can declare a role on its other registered origin without granting that page ATS authority', async () => {
  const config = { ...provider, officialHomepageUrl: 'https://company.test/', requireCorporateIdentityMatch: true }
  const jobs = await createVerifiedRecruitmentScraper(config).run({
    fetchPage: async url => ({ status: 200, url, html: url === posting.url
      ? roleHTML() + '<a href="https://jobs.ashbyhq.com/OtherCompany">Jobs</a>'
      : '<title>Example Corporation</title><a href="' + posting.url + '">Open job</a>' }),
    fetchJson: () => assert.fail('A role with no publisher identity cannot delegate to another ATS account'),
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, posting.url)
})

test('follows declared company language and recruitment links without guessing an ATS tenant', async () => {
  const calls = [], config = { ...provider, companyCareerPage: 'https://employer.test/', officialHomepageUrl: 'https://employer.test/',
    requireCorporateIdentityMatch: true, discoverRecruitmentLinks: true }
  const jobs = await createVerifiedRecruitmentScraper(config).run({
    fetchPage: async url => {
      calls.push(url)
      return { status: 200, url, html: url.endsWith('/en/') ? '<title>Example Corporation</title><a href="/recruit/">採用</a>'
        : url.endsWith('/recruit/') ? '<title>Example Corporation Recruitment</title><a href="https://jobs.ashbyhq.com/Example%20Corporation">Open roles</a>'
          : '<title>企業情報</title><a href="/en/">English</a>' }
    },
    fetchJson: async url => { assert.equal(url, 'https://api.ashbyhq.com/posting-api/job-board/Example%20Corporation'); return { apiVersion: '1', jobs: [ashbyRole] } },
  })
  assert.equal(jobs.length, 1)
  assert.deepEqual(calls, ['https://employer.test/', 'https://employer.test/en/', 'https://employer.test/recruit/'])
})

test('bounds and cancellation fail before uncontrolled work', async () => {
  for (const options of [{ maxRequests: 0 }, { maxDetails: 1000 }, { maxPages: Infinity }, { sourceTimeoutMs: -1 }]) {
    await assert.rejects(run({ ...options, fetchPage: () => assert.fail('Invalid limits cannot fetch') }), /Invalid recruitment limit/)
  }
  const controller = new AbortController(); controller.abort(new Error('cancelled'))
  await assert.rejects(run({ signal: controller.signal, fetchPage: () => assert.fail('Cancelled source cannot fetch') }), /cancelled/)
})

test('board identity parsing uses advertised native paths and rejects credentials and lookalikes', () => {
  assert.equal(recruitmentBoard('https://example.wd1.myworkdayjobs.com/en-US/External/job/India/role').site, 'External')
  assert.equal(recruitmentBoard('https://jobs.smartrecruiters.com/Example/123-role').token, 'Example')
  assert.equal(recruitmentBoard('https://jobs.ashbyhq.com/Example%20Corporation').token, provider.companyName)
  for (const url of ['https://user:pass@jobs.ashbyhq.com/employer', 'https://fake.myworkdayjobs.com.evil.test/External', 'http://employer.test/careers']) assert.equal(recruitmentBoard(url), null)
})
