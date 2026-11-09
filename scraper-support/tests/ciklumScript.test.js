import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const INDIA_CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>India - Jobs at Ciklum</title>
  </head>
  <body>
    <main>
      <h1>India</h1>
      <p>Step into your next big opportunity with Ciklum!</p>
      <a href="https://explore-jobs.ciklum.com/en/sites/ciklum-career/jobs?lastSelectedFacet=LOCATIONS&selectedLocationsFacet=300000000468243">
        Opportunities list
      </a>
    </main>
  </body>
</html>
`

const ORACLE_JOBS_HTML = `
<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta property="og:title" content="Ciklum Careers" />
    <title>Ciklum</title>
    <base
      href="/en/sites/ciklum-career"
      data-apibaseurl="https://ialmme.fa.ocs.oraclecloud.com:443"
      data-fahosturl="https://ialmme.fa.ocs.oraclecloud.com:443"
      data-vanitybaseurl="https://explore-jobs.ciklum.com/"
      data-sitenumber="CX_1001"
    />
  </head>
  <body>
    <div class="app"></div>
  </body>
</html>
`

const LISTING_PAYLOAD = {
  items: [
    {
      Limit: 24,
      TotalJobsCount: 24,
      SiteNumber: 'CX_1001',
      requisitionList: [
        {
          Id: '3469',
          Title: 'Senior Automation QA Engineer',
          PostedDate: '2026-07-16T08:00:00Z',
          PrimaryLocation: 'India',
          PrimaryLocationCountry: 'IN',
          WorkplaceType: 'Hybrid',
          Department: 'Engineering',
          JobType: 'Regular',
          secondaryLocations: [],
          workLocation: [
            {
              LocationName: 'Pune, Maharashtra, India',
              Country: 'IN',
            },
          ],
          otherWorkLocations: [],
          ShortDescriptionStr: '<p>Automate product quality across the Ciklum platform.</p>',
        },
        {
          Id: '9999',
          Title: 'Non-India Role',
          PostedDate: '2026-07-16T08:00:00Z',
          PrimaryLocation: 'Spain',
          PrimaryLocationCountry: 'ES',
          Department: 'Engineering',
          JobType: 'Regular',
          secondaryLocations: [],
          workLocation: [],
          otherWorkLocations: [],
        },
      ],
    },
  ],
}

const DETAIL_PAYLOAD = {
  items: [
    {
      Id: '3469',
      Title: 'Senior Automation QA Engineer',
      PostedDate: '2026-07-16T08:00:00Z',
      PrimaryLocation: 'India',
      PrimaryLocationCountry: 'IN',
      WorkplaceType: 'Hybrid',
      Department: 'Engineering',
      JobType: 'Regular',
      ExternalDescriptionStr:
        '<p>Build and maintain automation coverage for Ciklum product releases.</p>',
      ExternalQualificationsStr: '<p>Strong automation testing fundamentals.</p>',
      ExternalResponsibilitiesStr: '<ul><li>Own regression coverage</li></ul>',
      skills: [{ Skill: 'Playwright' }, { Skill: 'TypeScript' }],
      secondaryLocations: [],
      workLocation: [
        {
          LocationName: 'Pune, Maharashtra, India',
          Country: 'IN',
        },
      ],
      otherWorkLocations: [],
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/ciklum/script.js')
  } catch {
    assert.fail('Expected Ciklum scraper module at ../../scraper/ciklum/script.js')
  }
}

test('Ciklum helpers stay pinned to the verified first-party India page and Oracle shell', async () => {
  const ciklum = await loadModule()

  assert.equal(ciklum.SOURCE, 'ciklum')
  assert.equal(ciklum.COMPANY, 'Ciklum')
  assert.equal(ciklum.OFFICIAL_BRAND_NAME, 'Ciklum')
  assert.equal(ciklum.VERIFIED_ON, '2026-07-18')
  assert.equal(ciklum.INDIA_CAREERS_URL, 'https://jobs.ciklum.com/offices/india/')
  assert.equal(
    ciklum.JOBS_URL,
    'https://explore-jobs.ciklum.com/en/sites/ciklum-career/jobs?lastSelectedFacet=LOCATIONS&selectedLocationsFacet=300000000468243',
  )
  assert.equal(ciklum.SITE_NUMBER, 'CX_1001')
  assert.equal(ciklum.SELECTED_LOCATIONS_FACET, '300000000468243')
  assert.equal(ciklum.hasOfficialIndiaCareersSignal(INDIA_CAREERS_HTML), true)
  assert.equal(ciklum.hasOfficialIndiaCareersSignal('<html><body>No trusted handoff</body></html>'), false)
  assert.equal(ciklum.hasOfficialOracleShellSignal(ORACLE_JOBS_HTML), true)
  assert.equal(ciklum.hasOfficialOracleShellSignal('<html><head><title>Other</title></head></html>'), false)
  assert.equal(
    ciklum.buildSearchUrl(),
    'https://ialmme.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.workLocation,requisitionList.otherWorkLocations,requisitionList.secondaryLocations,flexFieldsFacet.values,requisitionList.requisitionFlexFields&finder=findReqs;siteNumber=CX_1001,selectedLocationsFacet=300000000468243,limit=24,offset=0',
  )
  assert.equal(
    ciklum.buildSearchUrl({ page: 2, limit: 10 }),
    'https://ialmme.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.workLocation,requisitionList.otherWorkLocations,requisitionList.secondaryLocations,flexFieldsFacet.values,requisitionList.requisitionFlexFields&finder=findReqs;siteNumber=CX_1001,selectedLocationsFacet=300000000468243,limit=10,offset=20',
  )
  assert.equal(
    ciklum.buildJobDetailUrl('3469'),
    'https://explore-jobs.ciklum.com/en/sites/ciklum-career/job/3469',
  )
  assert.equal(
    ciklum.buildJobDetailApiUrl('3469'),
    'https://ialmme.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;siteNumber=CX_1001,Id=%223469%22',
  )

  const listings = ciklum.extractSearchResults(LISTING_PAYLOAD)
  assert.deepEqual(listings, [
    {
      title: 'Senior Automation QA Engineer',
      company: 'Ciklum',
      department: 'Engineering',
      location: 'Pune, Maharashtra, India',
      city: 'Pune',
      country: 'India',
      jobId: '3469',
      requisitionId: '3469',
      sourceUrl: 'https://explore-jobs.ciklum.com/en/sites/ciklum-career/job/3469',
      applyUrl: 'https://explore-jobs.ciklum.com/en/sites/ciklum-career/job/3469',
      employmentType: 'Regular',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-16',
      closingDate: null,
      jobDescription: 'Automate product quality across the Ciklum platform.',
      remoteStatus: 'Hybrid',
    },
  ])

  assert.deepEqual(ciklum.extractPaginationSummary(LISTING_PAYLOAD, { page: 0 }), {
    hasNext: false,
    pageSize: 24,
    nextOffset: 24,
    totalCount: 24,
  })

  assert.deepEqual(ciklum.extractJobDetail(DETAIL_PAYLOAD, listings[0]), {
    title: 'Senior Automation QA Engineer',
    company: 'Ciklum',
    department: 'Engineering',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    country: 'India',
    jobId: '3469',
    requisitionId: '3469',
    sourceUrl: 'https://explore-jobs.ciklum.com/en/sites/ciklum-career/job/3469',
    applyUrl: 'https://explore-jobs.ciklum.com/en/sites/ciklum-career/job/3469',
    employmentType: 'Regular',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Playwright', 'TypeScript'],
    postingDate: '2026-07-16',
    closingDate: null,
    jobDescription:
      'Build and maintain automation coverage for Ciklum product releases. Own regression coverage Strong automation testing fundamentals.',
    remoteStatus: 'Hybrid',
  })
})

test('Ciklum run validates the India handoff page, Oracle shell, listing API, and detail API before returning jobs', async () => {
  const ciklum = await loadModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await ciklum.createCiklumScraper({ maxPages: 1, maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === ciklum.INDIA_CAREERS_URL) return INDIA_CAREERS_HTML
      if (url === ciklum.JOBS_URL) return ORACLE_JOBS_HTML
      throw new Error(`Unexpected Ciklum text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === ciklum.buildSearchUrl()) return LISTING_PAYLOAD
      if (url === ciklum.buildJobDetailApiUrl('3469')) return DETAIL_PAYLOAD
      throw new Error(`Unexpected Ciklum JSON URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedTextUrls, [ciklum.INDIA_CAREERS_URL, ciklum.JOBS_URL])
  assert.deepEqual(requestedJsonUrls, [ciklum.buildSearchUrl(), ciklum.buildJobDetailApiUrl('3469')])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'ciklum')
  assert.equal(jobs[0].company, 'Ciklum')
  assert.equal(jobs[0].link, 'https://explore-jobs.ciklum.com/en/sites/ciklum-career/job/3469')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Ciklum fails closed when the India page, Oracle shell, or detail payload drift materially', async () => {
  const ciklum = await loadModule()

  await assert.rejects(
    ciklum.createCiklumScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
      fetchJson: async () => LISTING_PAYLOAD,
    }),
    /verified India careers page/i,
  )

  await assert.rejects(
    ciklum.createCiklumScraper().run({
      fetchText: async (url) => {
        if (url === ciklum.INDIA_CAREERS_URL) return INDIA_CAREERS_HTML
        return '<html><head><title>Other</title></head><body></body></html>'
      },
      fetchJson: async () => LISTING_PAYLOAD,
    }),
    /verified Oracle shell/i,
  )

  await assert.rejects(
    ciklum.createCiklumScraper({ maxPages: 1, maxJobs: 1 }).run({
      fetchText: async (url) => {
        if (url === ciklum.INDIA_CAREERS_URL) return INDIA_CAREERS_HTML
        return ORACLE_JOBS_HTML
      },
      fetchJson: async (url) => {
        if (url === ciklum.buildSearchUrl()) return LISTING_PAYLOAD
        if (url === ciklum.buildJobDetailApiUrl('3469')) return { items: [{ Id: '3469', Title: null }] }
        throw new Error(`Unexpected Ciklum JSON URL: ${url}`)
      },
    }),
    /verified detail payload/i,
  )
})
