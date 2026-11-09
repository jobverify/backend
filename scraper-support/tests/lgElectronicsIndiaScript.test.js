import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-02T12:00:00.000Z'

const locationPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at LG India | LG Global Careers</title>
  </head>
  <body>
    <main>
      <h1>India</h1>
      <button>Explore Jobs</button>
      <section aria-label="LG Electronics India">
        <h2>Overview</h2>
        <p>LG Electronics India has been certified as a Great Place To Work.</p>
      </section>
      <section aria-label="Equal Opportunity">
        <h2>Equal Opportunity</h2>
        <p>Dedicated to creating an inclusive workplace that values diversity and reflects the communities we serve.</p>
      </section>
    </main>
  </body>
</html>
`

const jobsSearchHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>LG Job Search &amp; Openings | LG Global Careers</title>
  </head>
  <body>
    <main>
      <h1>Job Search</h1>
      <label>Filter Region</label>
      <label>Search</label>
    </main>
  </body>
</html>
`

const pageOnePayload = {
  data: {
    total: 101,
    list: [
      {
        id: 'a6a69987e72d70',
        title: 'Thermal Design Engineer - Refrigeration Cycle Module Development',
        content: '<p>Thermal role for LG Electronics [LG Soft India Private Limited], [Noida], [India]</p>',
        corpCd: 'LGSI',
        corpType: 'R&D',
        cntryCd: 'IN',
        cntryNm: 'India',
        jobFamily: 'DES_9462',
        location: 'Noida',
        empType: 'Permanent',
        status: 'OPEN',
        postCreateDtm: [2026, 7, 29, 11, 36, 54],
      },
      {
        id: 'non-india-1',
        title: 'Quality NVH Engineer - Electric Motors',
        content: '<p>US role</p>',
        corpCd: 'LGEUS',
        corpType: 'Vehicle Solution',
        cntryCd: 'US',
        cntryNm: 'United States',
        jobFamily: 'VS',
        location: 'Troy',
        empType: 'Permanent',
        status: 'OPEN',
        postCreateDtm: [2026, 7, 10, 9, 0, 0],
      },
    ],
  },
}

const pageTwoPayload = {
  data: {
    total: 101,
    list: [
      {
        id: 'a697b45e952d2b',
        title: 'Talent Acquisition_Manager',
        content: '<p>Recruitment role for Bengaluru, India</p>',
        corpCd: 'LGSI',
        corpType: 'R&D',
        cntryCd: 'IN',
        cntryNm: 'India',
        jobFamily: 'HR',
        location: 'Bengaluru',
        empType: 'Permanent',
        status: 'OPEN',
        postCreateDtm: [2026, 1, 29, 17, 5, 5],
      },
      {
        id: 'closed-india',
        title: 'Closed India Role',
        content: '<p>Closed</p>',
        corpCd: 'LGSI',
        corpType: 'R&D',
        cntryCd: 'IN',
        cntryNm: 'India',
        jobFamily: 'HR',
        location: 'Noida',
        empType: 'Permanent',
        status: 'CLOSED',
        postCreateDtm: [2026, 1, 29, 17, 5, 5],
      },
    ],
  },
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/lgelectronicsindia/script.js')
  } catch {
    assert.fail('Expected LG Electronics India scraper module at ../../scraper/lgelectronicsindia/script.js')
  }
}

test('LG Electronics India scraper pins the verified browser-rendered India page and first-party jobs API surface', async () => {
  const lgElectronicsIndia = await loadScriptModule()

  assert.equal(lgElectronicsIndia.SOURCE, 'lgelectronicsindia')
  assert.equal(lgElectronicsIndia.COMPANY, 'LG Electronics India')
  assert.equal(lgElectronicsIndia.OFFICIAL_BRAND_NAME, 'LG Electronics India')
  assert.equal(lgElectronicsIndia.VERIFIED_ON, '2026-08-14')
  assert.equal(
    lgElectronicsIndia.LOCATIONS_PAGE_URL,
    'https://globalcareers.lge.com/locations/IN',
  )
  assert.equal(
    lgElectronicsIndia.JOBS_SEARCH_URL,
    'https://globalcareers.lge.com/jobs',
  )
  assert.equal(
    lgElectronicsIndia.buildJobsApiUrl(2),
    'https://globalcareers.lge.com/api/job/v1/jobs/?page=2&size=100',
  )
  assert.equal(
    lgElectronicsIndia.buildJobDetailUrl('a6a69987e72d70'),
    'https://globalcareers.lge.com/jobs/a6a69987e72d70',
  )
  assert.equal(lgElectronicsIndia.hasOfficialIndiaLocationSignal(locationPageHtml), true)
  assert.equal(lgElectronicsIndia.hasOfficialJobsSearchSignal(jobsSearchHtml), true)
  assert.deepEqual(lgElectronicsIndia.extractIndiaJobs(pageOnePayload), [
    {
      title: 'Thermal Design Engineer - Refrigeration Cycle Module Development',
      company: 'LG Electronics India',
      department: 'R&D',
      location: 'Noida, India',
      city: 'Noida',
      country: 'India',
      jobId: 'a6a69987e72d70',
      requisitionId: 'LGSI-a6a69987e72d70',
      sourceUrl: 'https://globalcareers.lge.com/jobs/a6a69987e72d70',
      applyUrl: 'https://globalcareers.lge.com/jobs/a6a69987e72d70',
      employmentType: 'Permanent',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-29',
      closingDate: null,
      jobDescription: 'Thermal role for LG Electronics [LG Soft India Private Limited], [Noida], [India]',
    },
  ])
})

test('LG Electronics India run validates the rendered India surface and returns public India jobs from the first-party API', async () => {
  const lgElectronicsIndia = await loadScriptModule()
  const requestedTextUrls = []
  const requestedApiUrls = []

  const jobs = await lgElectronicsIndia.createLgElectronicsIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchBrowserText: async (url) => {
      requestedTextUrls.push(`browser:${url}`)
      return locationPageHtml
    },
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === lgElectronicsIndia.JOBS_SEARCH_URL) return jobsSearchHtml
      throw new Error(`Unexpected LG Electronics India text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedApiUrls.push(url)
      if (url === lgElectronicsIndia.buildJobsApiUrl(1)) return pageOnePayload
      if (url === lgElectronicsIndia.buildJobsApiUrl(2)) return pageTwoPayload
      throw new Error(`Unexpected LG Electronics India JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [
    `browser:${lgElectronicsIndia.LOCATIONS_PAGE_URL}`,
    lgElectronicsIndia.JOBS_SEARCH_URL,
  ])
  assert.deepEqual(requestedApiUrls, [
    lgElectronicsIndia.buildJobsApiUrl(1),
    lgElectronicsIndia.buildJobsApiUrl(2),
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      jobId: job.jobId,
      sourceUrl: job.sourceUrl,
      postingDate: job.postingDate,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Thermal Design Engineer - Refrigeration Cycle Module Development',
        location: 'Noida, India',
        jobId: 'a6a69987e72d70',
        sourceUrl: 'https://globalcareers.lge.com/jobs/a6a69987e72d70',
        postingDate: '2026-07-29',
        source: 'lgelectronicsindia',
        link: 'https://globalcareers.lge.com/jobs/a6a69987e72d70',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Talent Acquisition_Manager',
        location: 'Bengaluru, India',
        jobId: 'a697b45e952d2b',
        sourceUrl: 'https://globalcareers.lge.com/jobs/a697b45e952d2b',
        postingDate: '2026-01-29',
        source: 'lgelectronicsindia',
        link: 'https://globalcareers.lge.com/jobs/a697b45e952d2b',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('LG Electronics India fails closed when the rendered location page, jobs search page, or API surface drifts', async () => {
  const lgElectronicsIndia = await loadScriptModule()

  await assert.rejects(
    lgElectronicsIndia.createLgElectronicsIndiaScraper().run({
      fetchBrowserText: async () => `
        <html>
          <head><title>Jobs at LG India | LG Global Careers</title></head>
          <body>
            <h1>India</h1>
            <button>Explore Jobs</button>
            <section>LG Electronics India</section>
          </body>
        </html>
      `,
      fetchText: async () => jobsSearchHtml,
      fetchJson: async () => pageOnePayload,
    }),
    /verified india location page no longer matches/i,
  )

  await assert.rejects(
    lgElectronicsIndia.createLgElectronicsIndiaScraper().run({
      fetchBrowserText: async () => locationPageHtml,
      fetchText: async () => '<html><head><title>Unexpected</title></head><body>Placeholder</body></html>',
      fetchJson: async () => pageOnePayload,
    }),
    /verified jobs search page no longer matches/i,
  )

  await assert.rejects(
    lgElectronicsIndia.createLgElectronicsIndiaScraper().run({
      fetchBrowserText: async () => locationPageHtml,
      fetchText: async () => jobsSearchHtml,
      fetchJson: async () => ({ data: { total: 0, list: [] } }),
    }),
    /verified jobs api no longer exposes public india roles/i,
  )
})
