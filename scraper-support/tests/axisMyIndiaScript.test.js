import assert from 'node:assert/strict'
import test from 'node:test'

const loadAxisMyIndiaModule = async () => {
  try {
    return await import('../../scraper/axismyindia/script.js')
  } catch {
    assert.fail('Expected Axis My India scraper module at ../../scraper/axismyindia/script.js')
  }
}

const careersPageHtml = `
  <html>
    <body>
      <h1>Current Openings</h1>
      <a href="https://axismyindia.zohorecruit.in/jobs/Careers">Apply Now</a>
    </body>
  </html>
`

const portalHtml = `
  <html>
    <head>
      <meta property="og:url" content="https://axismyindia.zohorecruit.in/jobs/Careers">
    </head>
    <body>
      <input type="hidden" id="pageJson" value="{}">
      <input type="hidden" id="moduleMeta" value="[]">
      <input type="hidden" id="jobs" value="[]">
    </body>
  </html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      id: '600001',
      Posting_Title: 'Data Analyst',
      Job_Type: 'Full time',
      City: 'Noida',
      Country: 'India',
      Skill_Set: 'SQL, Power BI',
      Date_Opened: '2026-07-14',
      Job_Description: 'Analyze public-policy data.',
      $url: 'https://axismyindia.zohorecruit.in/jobs/Careers/600001/Data-Analyst?source=CareerSite',
    },
    {
      id: '700001',
      Posting_Title: 'US Analyst',
      Job_Type: 'Full time',
      City: 'Austin',
      Country: 'United States',
      $url: 'https://axismyindia.zohorecruit.in/jobs/Careers/700001/US-Analyst?source=CareerSite',
    },
  ],
}

test('Axis My India constants stay pinned to the verified official careers, portal, and public jobs API surfaces', async () => {
  const axisMyIndia = await loadAxisMyIndiaModule()

  assert.equal(axisMyIndia.CAREERS_PAGE_URL, 'https://www.axismyindia.org/career')
  assert.equal(axisMyIndia.CAREERS_PORTAL_URL, 'https://axismyindia.zohorecruit.in/jobs/Careers')
  assert.equal(
    axisMyIndia.CAREERS_API_URL,
    'https://axismyindia.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(axisMyIndia.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(axisMyIndia.hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs keeps only India listings from the Axis My India public jobs feed and derives apply URLs', async () => {
  const axisMyIndia = await loadAxisMyIndiaModule()
  const jobs = axisMyIndia.extractIndiaJobs(apiPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Data Analyst',
      company: 'Axis My India',
      department: null,
      location: 'Noida, India',
      city: 'Noida',
      state: null,
      country: 'India',
      jobId: '600001',
      requisitionId: '600001',
      sourceUrl: 'https://axismyindia.zohorecruit.in/jobs/Careers/600001/Data-Analyst?source=CareerSite',
      applyUrl: 'https://axismyindia.zohorecruit.in/jobs/Careers/600001/Data-Analyst?source=CareerSite&$apply=true',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['SQL', 'Power BI'],
      postingDate: '2026-07-14',
      closingDate: null,
      jobDescription: 'Analyze public-policy data.',
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates the Axis My India careers handoff and official portal before fetching India jobs', async () => {
  const axisMyIndia = await loadAxisMyIndiaModule()
  const requestedUrls = []

  const jobs = await axisMyIndia.createAxisMyIndiaScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === axisMyIndia.CAREERS_PAGE_URL) return careersPageHtml
      if (url === axisMyIndia.CAREERS_PORTAL_URL) return portalHtml

      assert.fail(`Unexpected HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return apiPayload
    },
    now: () => '2026-07-14T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    axisMyIndia.CAREERS_PAGE_URL,
    axisMyIndia.CAREERS_PORTAL_URL,
    axisMyIndia.CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'axismyindia')
  assert.equal(
    jobs[0].link,
    'https://axismyindia.zohorecruit.in/jobs/Careers/600001/Data-Analyst?source=CareerSite&$apply=true',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-14T00:00:00.000Z')
})

test('run fails closed when the Axis My India official portal signal disappears', async () => {
  const axisMyIndia = await loadAxisMyIndiaModule()

  await assert.rejects(
    axisMyIndia.createAxisMyIndiaScraper().run({
      fetchText: async (url) => {
        if (url === axisMyIndia.CAREERS_PAGE_URL) return careersPageHtml
        return '<html><body>Unexpected page</body></html>'
      },
      fetchJson: async () => apiPayload,
    }),
    /official Axis My India careers portal/i,
  )
})
