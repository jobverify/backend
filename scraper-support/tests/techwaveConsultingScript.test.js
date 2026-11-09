import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-14T18:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Techwave Careers: Empowering Your Success</title>
  </head>
  <body>
    <h1>Work that moves you.</h1>
    <a href="https://www.techwave.com/join-us/">Explore Opportunities</a>
    <a href="https://www.techwave.com/join-us/">View Open Roles</a>
  </body>
</html>
`

const joinUsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Us - TechWave</title>
  </head>
  <body>
    <h1>Discover What’s Possible. Join Us.</h1>
    <iframe src="https://techwave.wd108.myworkdayjobs.com/TechWave_Careers"></iframe>
  </body>
</html>
`

const workdayBoardHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <link rel="canonical" href="https://techwave.wd108.myworkdayjobs.com/TechWave_Careers" />
  </head>
  <body>
    <img src="https://techwave.wd108.myworkdayjobs.com/TechWave_Careers/assets/logo" />
  </body>
</html>
`

const unfilteredPayload = {
  total: 63,
  jobPostings: [
    {
      title: 'Finance Intern',
      externalPath: '/job/Budapest/Finance-Intern_TW-1280',
      locationsText: 'Budapest',
      postedOn: 'Posted Today',
      bulletFields: ['TW-1280'],
      timeType: 'Part time',
    },
  ],
  facets: [
    {
      facetParameter: 'locationMainGroup',
      values: [
        {
          facetParameter: 'locations',
          descriptor: 'Locations',
          values: [
            { descriptor: 'Bangalore', id: 'bangalore-id', count: 1 },
            { descriptor: 'GDC Financial District', id: 'gdc-financial-id', count: 34 },
            { descriptor: 'GDC HiTech', id: 'gdc-hitech-id', count: 3 },
            { descriptor: 'Khammam', id: 'khammam-id', count: 3 },
            { descriptor: 'Budapest', id: 'budapest-id', count: 19 },
          ],
        },
      ],
    },
  ],
}

// This reduced fixture contains three vacancies, so its total must describe those three.
const filteredIndiaPayload = {
  total: 3,
  jobPostings: [
    {
      title: 'Sr. Data Architect (Databricks)',
      externalPath: '/job/GDC-Financial-District/Sr-Data-Architect--Databricks-_TW-1275',
      locationsText: 'GDC Financial District',
      postedOn: 'Posted Today',
      bulletFields: ['TW-1275'],
      timeType: 'Full time',
    },
    {
      title: 'Telecom-ATT-(ES050)',
      externalPath: '/job/GDC-HiTech/Telecom-ATT--ES050-_',
      locationsText: '2 Locations',
      postedOn: 'Posted Yesterday',
      bulletFields: [],
      timeType: 'Full time',
    },
    {
      title: 'Service Delivery Manager – AI/ML and Data',
      externalPath: '/job/GDC-Financial-District/Service-Delivery-Manager---AI-ML-and-Data_TW-1262',
      locationsText: 'GDC Financial District',
      postedOn: 'Posted 3 Days Ago',
      bulletFields: ['TW-1262'],
      timeType: 'Full time',
    },
  ],
}

const detailPageHtmlByUrl = {
  'https://techwave.wd108.myworkdayjobs.com/TechWave_Careers/job/GDC-Financial-District/Sr-Data-Architect--Databricks-_TW-1275': `
<!doctype html>
<html lang="en">
  <head>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "title": "Sr. Data Architect (Databricks)",
        "datePosted": "2026-08-14",
        "identifier": { "value": "TW-1275" },
        "description": "Job Description Design end-to-end Lakehouse architectures using Databricks. Preferred Experience 10-15+ years of IT experience. 5+ years of hands-on Databricks architecture and implementation experience. Qualifications Bachelor's degree in Computer Science."
      }
    </script>
  </head>
  <body></body>
</html>
`,
  'https://techwave.wd108.myworkdayjobs.com/TechWave_Careers/job/GDC-HiTech/Telecom-ATT--ES050-_': `
<!doctype html>
<html lang="en">
  <head>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "title": "Telecom-ATT-(ES050)",
        "datePosted": "2026-08-13",
        "identifier": { "value": "Telecom-ATT--ES050" },
        "description": "Job Description Own telecom application support and release governance. Qualifications Bachelor's degree."
      }
    </script>
  </head>
  <body></body>
</html>
`,
  'https://techwave.wd108.myworkdayjobs.com/TechWave_Careers/job/GDC-Financial-District/Service-Delivery-Manager---AI-ML-and-Data_TW-1262': `
<!doctype html>
<html lang="en">
  <head>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "title": "Service Delivery Manager – AI/ML and Data",
        "datePosted": "2026-08-11",
        "identifier": { "value": "TW-1262" },
        "description": "Job Description Lead AI, data, and analytics service delivery. Preferred Experience 10-15 years of IT experience with 5+ years in Service Delivery or Delivery Management. Qualifications Bachelor's degree in Computer Science."
      }
    </script>
  </head>
  <body></body>
</html>
`,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/techwaveconsulting/script.js')
  } catch {
    assert.fail('Expected Techwave Consulting scraper module at ../../scraper/techwaveconsulting/script.js')
  }
}

test('Techwave Consulting helpers stay pinned to the verified careers shell, join-us Workday embed, and India location facets', async () => {
  const techwave = await loadModule()

  assert.equal(techwave.SOURCE, 'techwaveconsulting')
  assert.equal(techwave.COMPANY, 'Techwave Consulting')
  assert.equal(techwave.CAREERS_URL, 'https://www.techwave.com/career/')
  assert.equal(techwave.JOIN_US_URL, 'https://www.techwave.com/join-us/')
  assert.equal(techwave.WORKDAY_BOARD_URL, 'https://techwave.wd108.myworkdayjobs.com/TechWave_Careers')
  assert.equal(
    techwave.JOBS_API_URL,
    'https://techwave.wd108.myworkdayjobs.com/wday/cxs/techwave/TechWave_Careers/jobs',
  )
  assert.equal(techwave.VERIFIED_ON, '2026-08-14')
  assert.equal(techwave.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(techwave.hasJoinUsWorkdayEmbedSignal(joinUsHtml), true)
  assert.equal(techwave.hasOfficialWorkdayBoardSignal(workdayBoardHtml), true)
  assert.deepEqual(techwave.extractIndiaLocationFacetIds(unfilteredPayload), [
    'bangalore-id',
    'gdc-financial-id',
    'gdc-hitech-id',
    'khammam-id',
  ])
})

test('Techwave Consulting run validates the careers shell, join-us handoff, and enriches India jobs from public Workday detail pages', async () => {
  const techwave = await loadModule()
  const requestedTexts = []
  const requestedJsonBodies = []

  const jobs = await techwave.createTechwaveConsultingScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === techwave.CAREERS_URL) return careersHtml
      if (url === techwave.JOIN_US_URL) return joinUsHtml
      if (url === techwave.WORKDAY_BOARD_URL) return workdayBoardHtml
      if (detailPageHtmlByUrl[url]) return detailPageHtmlByUrl[url]
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url, body) => {
      assert.equal(url, techwave.JOBS_API_URL)
      requestedJsonBodies.push(JSON.parse(body))
      if (requestedJsonBodies.length === 1) return unfilteredPayload
      if (requestedJsonBodies.length === 2) return filteredIndiaPayload
      throw new Error(`Unexpected Techwave API call #${requestedJsonBodies.length}`)
    },
  })

  assert.deepEqual(requestedTexts.slice(0, 3), [
    techwave.CAREERS_URL,
    techwave.JOIN_US_URL,
    techwave.WORKDAY_BOARD_URL,
  ])
  assert.deepEqual(
    requestedTexts.slice(3).sort(),
    Object.keys(detailPageHtmlByUrl).sort(),
  )
  assert.deepEqual(requestedJsonBodies, [
    {
      appliedFacets: {},
      limit: 20,
      offset: 0,
      searchText: '',
    },
    {
      appliedFacets: {
        locations: ['bangalore-id', 'gdc-financial-id', 'gdc-hitech-id', 'khammam-id'],
      },
      limit: 20,
      offset: 0,
      searchText: '',
    },
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'techwaveconsulting')
  assert.equal(jobs[0].companyCareerPage, 'https://www.techwave.com/career/')
  assert.equal(jobs[0].companyDomain, 'techwave.com')
  assert.equal(jobs[0].atsPlatform, 'workday-jobs-api')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].jobId, 'TW-1275')
  assert.equal(jobs[0].experienceRequired, '10-15 years')
  assert.equal(jobs[0].postingDate, '2026-08-14')
  assert.match(jobs[0].jobDescription || '', /Lakehouse architectures/i)
  assert.equal(jobs[1].location, '2 Locations, India')
  assert.equal(jobs[1].experienceRequired, null)
  assert.match(jobs[2].jobDescription || '', /service delivery/i)
  assert.equal(jobs[2].experienceRequired, '10-15 years')
})

test('Techwave Consulting fails closed when the careers shell, join-us handoff, board, or India location facets change', async () => {
  const techwave = await loadModule()

  await assert.rejects(
    techwave.createTechwaveConsultingScraper().run({
      fetchText: async (url) => {
        if (url === techwave.CAREERS_URL) return '<html><body><h1>Careers</h1></body></html>'
        if (url === techwave.JOIN_US_URL) return joinUsHtml
        return workdayBoardHtml
      },
      fetchJson: async () => unfilteredPayload,
    }),
    /verified Techwave careers shell/i,
  )

  await assert.rejects(
    techwave.createTechwaveConsultingScraper().run({
      fetchText: async (url) => {
        if (url === techwave.CAREERS_URL) return careersHtml
        if (url === techwave.JOIN_US_URL) return '<html><body><h1>Join Us</h1></body></html>'
        return workdayBoardHtml
      },
      fetchJson: async () => unfilteredPayload,
    }),
    /verified Techwave join-us page/i,
  )

  await assert.rejects(
    techwave.createTechwaveConsultingScraper().run({
      fetchText: async (url) => {
        if (url === techwave.CAREERS_URL) return careersHtml
        if (url === techwave.JOIN_US_URL) return joinUsHtml
        return '<html><body><h1>Board</h1></body></html>'
      },
      fetchJson: async () => unfilteredPayload,
    }),
    /verified Techwave Workday board/i,
  )

  await assert.rejects(
    techwave.createTechwaveConsultingScraper().run({
      fetchText: async (url) => {
        if (url === techwave.CAREERS_URL) return careersHtml
        if (url === techwave.JOIN_US_URL) return joinUsHtml
        return workdayBoardHtml
      },
      fetchJson: async () => ({
        total: 63,
        jobPostings: [],
        facets: [],
      }),
    }),
    /verified Techwave India Workday facet/i,
  )
})


test('Techwave Consulting follows a short filtered page while the advertised total still has jobs', async () => {
  const techwave = await loadModule()
  const offsets = []
  const jobs = await techwave.createTechwaveConsultingScraper().run({
    fetchText: async (url) => {
      if (url === techwave.CAREERS_URL) return careersHtml
      if (url === techwave.JOIN_US_URL) return joinUsHtml
      if (url === techwave.WORKDAY_BOARD_URL) return workdayBoardHtml
      if (detailPageHtmlByUrl[url]) return detailPageHtmlByUrl[url]
      throw new Error('Unexpected text URL: ' + url)
    },
    fetchJson: async (_url, body) => {
      const request = JSON.parse(body)
      if (!request.appliedFacets.locations) return unfilteredPayload
      offsets.push(request.offset)
      if (request.offset === 0) return { total: 3, jobPostings: filteredIndiaPayload.jobPostings.slice(0, 1) }
      if (request.offset === 1) return { total: 3, jobPostings: filteredIndiaPayload.jobPostings.slice(1) }
      throw new Error('Unexpected filtered offset: ' + request.offset)
    },
  })
  assert.equal(jobs.length, 3)
  assert.deepEqual(offsets, [0, 1])
})
