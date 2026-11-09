import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const verifiedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Online Shopping for Women, Men, Kids Fashion & Lifestyle - Myntra</title>
  </head>
  <body>
    <footer>
      <a href="https://careers.myntra.com">Careers</a>
    </footer>
  </body>
</html>
`

const verifiedCareersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Myntra</title>
  </head>
  <body>
    <main>
      <h1>Make work look good</h1>
      <a href="https://jobs.myntra.com/home">Explore Careers</a>
      <a href="https://jobs.myntra.com/home">Join the team</a>
    </main>
  </body>
</html>
`

const verifiedJobsPortalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Portal</title>
  </head>
  <body>
    <script src="flutter.js"></script>
    <script src="main.dart.js"></script>
  </body>
</html>
`

const countPayload = {
  totalCount: 3,
  hotJobCount: 1,
}

const searchPayloadPageOne = {
  entities: [
    {
      id: 'r_eb3221bdc4d635e29f1505a3f66f4f73',
      displayId: '8561214766',
      workspaceId: 'MYNTRA-93as3',
      jobTitle: 'Senior Manager - Category Demand Management',
      requiredExperienceInMonths: { from: 60, to: 120 },
      jobType: 'ONSITE',
      skills: [
        { skill: 'category demand management', isMandatory: true },
        { skill: 'pricing strategies', isMandatory: true },
        { skill: 'data analytics', isMandatory: true },
      ],
      jobLocation: [{ fqLocationName: 'Bangalore, Karnataka, India' }],
      departmentName: 'Category Demand Management (F1369)',
      employmentType: 'FULL_TIME',
      jobPosting: {
        status: 'ACTIVE',
        startDate: '2026-07-10T00:00:00.000Z',
      },
      jobDescription: '<p>Lead category demand planning across fashion businesses.</p>',
      aboutCompany: "<p>Myntra is India's leading fashion destination.</p>",
      jobStatus: { statusCode: 'OPEN' },
    },
    {
      id: 'r_us_job',
      displayId: '1111111111',
      workspaceId: 'MYNTRA-93as3',
      jobTitle: 'Senior Analyst - US Market',
      requiredExperienceInMonths: { from: 24, to: 48 },
      jobType: 'ONSITE',
      skills: [{ skill: 'retail analytics', isMandatory: true }],
      jobLocation: [{ fqLocationName: 'New York, New York, United States' }],
      departmentName: 'International',
      employmentType: 'FULL_TIME',
      jobPosting: {
        status: 'ACTIVE',
        startDate: '2026-07-11T00:00:00.000Z',
      },
      jobDescription: '<p>United States only.</p>',
      aboutCompany: '<p>Outside India role.</p>',
      jobStatus: { statusCode: 'OPEN' },
    },
  ],
}

const searchPayloadPageTwo = {
  entities: [
    {
      id: 'r_596491491',
      displayId: '596491491',
      workspaceId: 'MYNTRA-93as3',
      jobTitle: 'Associate - Controllership & Finance',
      requiredExperienceInMonths: { from: 24, to: 60 },
      jobType: 'ONSITE',
      skills: [
        { skill: 'financial reporting', isMandatory: true },
        { skill: 'accounting controls', isMandatory: true },
      ],
      jobLocation: [{ fqLocationName: 'Bangalore, Karnataka, India' }],
      departmentName: 'Controllership & Finance',
      employmentType: 'FULL_TIME',
      jobPosting: {
        status: 'ACTIVE',
        startDate: '2026-07-09T00:00:00.000Z',
      },
      jobDescription: '<p>Support controllership and finance operations.</p>',
      aboutCompany: '<p>Myntra finance team.</p>',
      jobStatus: { statusCode: 'OPEN' },
    },
  ],
}

const loadMyntraModule = async () => {
  try {
    return await import('../../scraper/myntra/script.js')
  } catch {
    assert.fail('Expected Myntra scraper module at ../../scraper/myntra/script.js')
  }
}

const inventoryOptions = (myntra, { count = 3, pages = [searchPayloadPageOne, searchPayloadPageTwo], countError = false } = {}) => ({
  fetchText: async url => url === myntra.HOMEPAGE_URL ? verifiedHomepageHtml
    : url === myntra.CAREERS_LANDING_URL ? verifiedCareersLandingHtml
      : url === myntra.JOB_PORTAL_URL ? verifiedJobsPortalHtml : 'MYNTRA-93as3',
  fetchJson: async url => {
    if (url === myntra.buildJobsCountUrl()) {
      if (countError) throw new Error('Upstream count unavailable')
      return { totalCount: count }
    }
    return structuredClone(pages[Number(new URL(url).searchParams.get('page')) - 1] || { entities: [] })
  },
  now: () => '2026-07-16T00:00:00.000Z',
})

test('Myntra complete inventory reconciles raw identities separately from the India subset', async () => {
  const m = await loadMyntraModule()
  const jobs = await m.createMyntraScraper({ pageSize: 2 }).run(inventoryOptions(m))
  assert.equal(jobs.length, 2)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 3)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, 2)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
  assert.equal(jobs[0].sourceDetailComplete, true)
})

test('Myntra limits and unavailable counts preserve explicit partial inventory', async () => {
  const m = await loadMyntraModule()
  for (const options of [{ maxPages: 1 }, { maxJobs: 1 }, { ...inventoryOptions(m, { countError: true }) }]) {
    const jobs = await m.createMyntraScraper({ pageSize: 2 }).run({ ...inventoryOptions(m), ...options })
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.ok(jobs.every(job => job.sourceListingComplete === false))
  }
})

test('Myntra rejects duplicate identities, inconsistent page totals and foreign-tenant rows', async () => {
  const m = await loadMyntraModule()
  for (const pages of [
    [searchPayloadPageOne, searchPayloadPageOne],
    [{ ...searchPayloadPageOne, total: 7 }, searchPayloadPageTwo],
    [{ entities: [{ ...searchPayloadPageOne.entities[0], workspaceId: 'OTHER-tenant' }] }],
  ]) await assert.rejects(m.createMyntraScraper({ pageSize: 2 }).run(inventoryOptions(m, { pages })), /identity|total|workspace|tenant/i)
})

test('Myntra verified zero requires an actual empty page and an exact nonnegative native total', async () => {
  const m = await loadMyntraModule()
  const jobs = await m.createMyntraScraper().run(inventoryOptions(m, { count: 0, pages: [{ entities: [] }] }))
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs)?.pagesFetched, 1)
  for (const totalCount of [-1, '3junk', 1.5, [], {}, null]) assert.throws(() => m.extractTotalCount({ totalCount }))
})

test('Myntra company boilerplate cannot replace a missing role description and native dates retain exact times', async () => {
  const m = await loadMyntraModule()
  const row = { ...searchPayloadPageOne.entities[0], jobDescription: '',
    jobPosting: { status: 'ACTIVE', startDate: 1783987200000, endDate: 1784678400000 } }
  const jobs = await m.createMyntraScraper().run(inventoryOptions(m, { count: 1, pages: [{ entities: [row] }] }))
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].postingDate, '2026-07-14T00:00:00.000Z')
  assert.equal(jobs[0].closingDate, '2026-07-22T00:00:00.000Z')
  assert.equal(jobs[0].sourceClosingDateIsExact, true)
})

test('Myntra script, style and comment-only role content stays missing despite company boilerplate', async () => {
  const m = await loadMyntraModule()
  for (const jobDescription of ['<script>window.bootstrap = true;</script>', '<style>.job {color:red}</style>', '<!-- job description unavailable -->']) {
    const row = { ...searchPayloadPageOne.entities[0], jobDescription }
    const jobs = await m.createMyntraScraper().run(inventoryOptions(m, { count: 1, pages: [{ entities: [row] }] }))
    assert.equal(jobs[0].jobDescription, null)
    assert.equal(jobs[0].sourceDetailComplete, false)
  }
})

test('Myntra unknown geography cannot prove zero and secondary explicit India offices remain selectable', async () => {
  const m = await loadMyntraModule()
  const foreign = { fqLocationName: 'Seattle, Washington, United States', country: 'United States', countryCode: 'US' }
  const row = { ...searchPayloadPageOne.entities[0], jobLocation: [foreign, { fqLocationName: 'Bangalore, Karnataka, India', country: 'India' }] }
  const jobs = await m.createMyntraScraper().run(inventoryOptions(m, { count: 1, pages: [{ entities: [row] }] }))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Bangalore, Karnataka, India')
  row.jobLocation = [{ fqLocationName: 'Remote, Unknownland' }]
  const unknown = await m.createMyntraScraper().run(inventoryOptions(m, { count: 1, pages: [{ entities: [row] }] }))
  assert.equal(unknown.length, 0)
  assert.equal(readInventoryEvidence(unknown).listingComplete, false)
  assert.equal(readInventoryEvidence(unknown).indiaFacetCount, null)
  row.jobLocation = [{ fqLocationName: 'Unspecified, Unknown Region' }]
  const unknownRegion = await m.createMyntraScraper().run(inventoryOptions(m, { count: 1, pages: [{ entities: [row] }] }))
  assert.equal(readInventoryEvidence(unknownRegion).listingComplete, false)
  row.jobLocation = [{ fqLocationName: 'India Office, Seattle, United States', country: 'United States', countryCode: 'US' }]
  assert.equal((await m.createMyntraScraper().run(inventoryOptions(m, { count: 1, pages: [{ entities: [row] }] }))).length, 0)
})

test('Myntra HTTP200 error envelopes cannot certify an empty inventory', async () => {
  const m = await loadMyntraModule()
  const options = inventoryOptions(m, { count: 0 })
  await assert.rejects(m.createMyntraScraper().run({ ...options, fetchJson: async url => {
    if (url === m.buildJobsCountUrl()) return { totalCount: 0 }
    return { entities: [], total: 0, status: 500, error: 'Backend unavailable' }
  } }), /native.*(error|status)|upstream/i)
  assert.throws(() => m.extractTotalCount({ totalCount: 0, success: false }), /native.*(error|status)|upstream/i)
})

test('Myntra changed final counts remain partial and failed pages propagate instead of returning a complete subset', async () => {
  const m = await loadMyntraModule()
  const options = inventoryOptions(m)
  let counts = 0
  const jobs = await m.createMyntraScraper({ pageSize: 2 }).run({ ...options, fetchJson: async url => {
    if (url === m.buildJobsCountUrl()) return { totalCount: ++counts === 1 ? 3 : 4 }
    return options.fetchJson(url)
  } })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
  await assert.rejects(m.createMyntraScraper({ pageSize: 2 }).run({ ...options, fetchJson: async url => {
    if (new URL(url).searchParams.get('page') === '2') throw new Error('Native HTTP 503')
    return options.fetchJson(url)
  } }), /503/)
})

test('Myntra ignores inert career URLs and honors pre-aborted source execution', async () => {
  const m = await loadMyntraModule()
  for (const html of [
    '<!-- Myntra <a href="https://careers.myntra.com/">Careers</a> -->',
    '<script>const myntra="https://careers.myntra.com/"</script>',
    '<template>Myntra <a href="https://careers.myntra.com/">Careers</a></template>',
  ]) assert.equal(m.hasOfficialHomepageSignal(html), false)
  const signal = AbortSignal.abort(new Error('Caller stopped'))
  await assert.rejects(m.createMyntraScraper().run({ signal, fetchText: () => assert.fail('No request after abort') }), /Caller stopped/)
})

test('Myntra verifies the first-party hiring pages and extracts India jobs from the public requisition payload', async () => {
  const myntra = await loadMyntraModule()

  assert.equal(
    myntra.buildWorkspaceBootstrapUrl(),
    'https://io.spire2grow.com/ies/v1/p/workspaceId?domain=jobs.myntra.com',
  )
  assert.equal(
    myntra.buildJobsCountUrl(),
    'https://io.spire2grow.com/ies/v1/p/requisition/_count',
  )
  assert.equal(
    myntra.buildJobsSearchUrl({ page: 2, size: 6 }),
    'https://io.spire2grow.com/ies/v1/p/requisition/_search?page=2&size=6&selectedSortOrder=desc&selectedSortField=postedOn',
  )
  assert.equal(
    myntra.buildJobUrl('8561214766', 'MYNTRA-93as3'),
    'https://jobs.myntra.com/jobs/8561214766?tenantId=MYNTRA-93as3&ref=job-share-direct-link',
  )
  assert.equal(myntra.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(myntra.hasVerifiedCareersLandingSignal(verifiedCareersLandingHtml), true)
  assert.equal(myntra.hasVerifiedJobsPortalSignal(verifiedJobsPortalHtml), true)
  assert.equal(myntra.extractWorkspaceId('MYNTRA-93as3'), 'MYNTRA-93as3')
  assert.equal(myntra.extractTotalCount(countPayload), 3)

  const jobs = myntra.extractIndiaJobsFromSearchPayload(searchPayloadPageOne, {
    workspaceId: 'MYNTRA-93as3',
    scrapedAt: '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Senior Manager - Category Demand Management',
      company: 'Myntra',
      department: 'Category Demand Management (F1369)',
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      workplaceType: 'ONSITE',
      jobId: '8561214766',
      requisitionId: 'r_eb3221bdc4d635e29f1505a3f66f4f73',
      sourceUrl: 'https://jobs.myntra.com/jobs/8561214766?tenantId=MYNTRA-93as3&ref=job-share-direct-link',
      applyUrl: 'https://jobs.myntra.com/jobs/8561214766?tenantId=MYNTRA-93as3&ref=job-share-direct-link',
      link: 'https://jobs.myntra.com/jobs/8561214766?tenantId=MYNTRA-93as3&ref=job-share-direct-link',
      employmentType: 'FULL_TIME',
      experienceRequired: '5-10 years',
      requiredSkills: [
        'category demand management',
        'pricing strategies',
        'data analytics',
      ],
      postingDate: '2026-07-10',
      jobDescription: "Lead category demand planning across fashion businesses. Myntra is India's leading fashion destination.",
      source: 'myntra',
      scrapedAt: '2026-07-16T00:00:00.000Z',
    },
  ])
})

test('Myntra run validates the verified first-party pages, bootstraps the public workspace, and paginates the requisition search API', async () => {
  const myntra = await loadMyntraModule()
  const requested = []

  const jobs = await myntra.createMyntraScraper({ pageSize: 2 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === myntra.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === myntra.CAREERS_LANDING_URL) return verifiedCareersLandingHtml
      if (url === myntra.JOB_PORTAL_URL) return verifiedJobsPortalHtml
      if (url === myntra.buildWorkspaceBootstrapUrl()) return 'MYNTRA-93as3'
      throw new Error(`Unexpected Myntra text fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      if (url === myntra.buildJobsCountUrl()) return countPayload
      if (url === myntra.buildJobsSearchUrl({ page: 1, size: 2 })) return searchPayloadPageOne
      if (url === myntra.buildJobsSearchUrl({ page: 2, size: 2 })) return searchPayloadPageTwo
      throw new Error(`Unexpected Myntra JSON fixture URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(
    requested.map((entry) => ({ type: entry.type, url: entry.url })),
    [
      { type: 'text', url: myntra.HOMEPAGE_URL },
      { type: 'text', url: myntra.CAREERS_LANDING_URL },
      { type: 'text', url: myntra.JOB_PORTAL_URL },
      { type: 'text', url: myntra.buildWorkspaceBootstrapUrl() },
      { type: 'json', url: myntra.buildJobsCountUrl() },
      { type: 'json', url: myntra.buildJobsSearchUrl({ page: 1, size: 2 }) },
      { type: 'json', url: myntra.buildJobsSearchUrl({ page: 2, size: 2 }) },
      { type: 'json', url: myntra.buildJobsCountUrl() },
    ],
  )
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobId, '8561214766')
  assert.equal(jobs[1].jobId, '596491491')
})

test('Myntra fails closed when the verified homepage, careers, portal, or workspace bootstrap contract drifts', async () => {
  const myntra = await loadMyntraModule()

  await assert.rejects(
    myntra.createMyntraScraper().run({
      fetchText: async (url) => {
        if (url === myntra.HOMEPAGE_URL) {
          return verifiedHomepageHtml.replace('https://careers.myntra.com', 'https://careers.example.com')
        }
        throw new Error(`Unexpected Myntra text fixture URL: ${url}`)
      },
      fetchJson: async () => countPayload,
    }),
    /verified Myntra homepage/i,
  )

  await assert.rejects(
    myntra.createMyntraScraper().run({
      fetchText: async (url) => {
        if (url === myntra.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === myntra.CAREERS_LANDING_URL) {
          return verifiedCareersLandingHtml
            .replaceAll('https://jobs.myntra.com/home', 'https://jobs.example.com/home')
            .replace('Explore Careers', 'Explore Opportunities')
        }
        throw new Error(`Unexpected Myntra text fixture URL: ${url}`)
      },
      fetchJson: async () => countPayload,
    }),
    /verified Myntra careers landing page/i,
  )

  await assert.rejects(
    myntra.createMyntraScraper().run({
      fetchText: async (url) => {
        if (url === myntra.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === myntra.CAREERS_LANDING_URL) return verifiedCareersLandingHtml
        if (url === myntra.JOB_PORTAL_URL) {
          return verifiedJobsPortalHtml.replace('Career Portal', 'Jobs')
        }
        throw new Error(`Unexpected Myntra text fixture URL: ${url}`)
      },
      fetchJson: async () => countPayload,
    }),
    /verified Myntra jobs portal/i,
  )

  await assert.rejects(
    myntra.createMyntraScraper().run({
      fetchText: async (url) => {
        if (url === myntra.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === myntra.CAREERS_LANDING_URL) return verifiedCareersLandingHtml
        if (url === myntra.JOB_PORTAL_URL) return verifiedJobsPortalHtml
        if (url === myntra.buildWorkspaceBootstrapUrl()) return 'invalid workspace'
        throw new Error(`Unexpected Myntra text fixture URL: ${url}`)
      },
      fetchJson: async () => countPayload,
    }),
    /workspace id/i,
  )
})
