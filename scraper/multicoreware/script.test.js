import assert from 'node:assert/strict'
import test from 'node:test'

const loadMulticorewareModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Multicoreware scraper module at ./script.js')
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Accelerated Software &amp; Development Company | MulticoreWare</title>
      <meta property="og:url" content="https://multicorewareinc.com/">
      <meta property="og:site_name" content="MulticoreWare">
    </head>
    <body>
      <a href="https://multicorewareinc.com/careers/">Careers</a>
    </body>
  </html>
`

const careersPageHtml = `
  <html>
    <head>
      <title>Careers at MulticoreWare | Global Technology &amp; IT Jobs</title>
      <meta property="og:url" content="https://multicorewareinc.com/careers/">
      <meta property="og:site_name" content="MulticoreWare">
    </head>
    <body>
      <script>
        rec_embed_js.load({
          widget_id:"rec_job_listing_div",
          page_name:"Careers",
          source:"CareerSite",
          site:"https://multicorewareinc.zohorecruit.in",
          empty_job_msg:"No current Openings"
        });
      </script>
    </body>
  </html>
`

const portalHtml = `
  <html>
    <head>
      <title>Careers at MulticoreWare Inc Pvt Ltd</title>
      <meta property="og:url" content="https://multicorewareinc.zohorecruit.in/jobs/Careers">
      <meta property="og:site_name" content="MulticoreWare Pvt Ltd">
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
      id: '61825000012054388',
      Job_Opening_Name: 'Embedded Software Engineer',
      Posting_Title: 'Embedded Software Engineer',
      Job_Type: 'Full time',
      Job_Description: 'Develop high-quality embedded software.',
      City: 'Ramapuram',
      Country: 'India',
      Publish: true,
      Date_Opened: '24/06/2026',
      $url: 'https://multicorewareinc.zohorecruit.in/jobs/Careers/61825000012054388/Embedded-Software-Engineer?source=CareerSite',
    },
    {
      id: '61825000011702230',
      Job_Opening_Name: 'Algorithms & Optimization Engineer',
      Posting_Title: 'Algorithms & Optimization Engineer',
      Job_Type: 'Full time',
      Job_Description: 'Optimize machine learning and numeric libraries.',
      City: 'Chennai',
      Country: 'India',
      Publish: true,
      Date_Opened: '29/04/2026',
      $url: 'https://multicorewareinc.zohorecruit.in/jobs/Careers/61825000011702230/Algorithms-Optimization-Engineer?source=CareerSite',
    },
    {
      id: '61825000011990007',
      Job_Opening_Name: 'Graphic Designer',
      Posting_Title: 'Graphic Designer',
      Job_Type: 'Full time',
      Job_Description: 'This unpublished job should be excluded.',
      City: 'Chennai',
      Country: 'India',
      Publish: false,
      Date_Opened: '12/06/2026',
      $url: 'https://multicorewareinc.zohorecruit.in/jobs/Careers/61825000011990007/Graphic-Designer?source=CareerSite',
    },
    {
      id: '61825000019999999',
      Job_Opening_Name: 'US Platform Architect',
      Posting_Title: 'US Platform Architect',
      Job_Type: 'Full time',
      Job_Description: 'Out-of-scope non-India role.',
      City: 'San Jose',
      Country: 'United States',
      Publish: true,
      Date_Opened: '24/06/2026',
      $url: 'https://multicorewareinc.zohorecruit.in/jobs/Careers/61825000019999999/US-Platform-Architect?source=CareerSite',
    },
  ],
}

test('Multicoreware constants stay pinned to the verified homepage, careers page, portal, and public jobs API', async () => {
  const multicoreware = await loadMulticorewareModule()

  assert.equal(multicoreware.HOMEPAGE_URL, 'https://multicorewareinc.com/')
  assert.equal(multicoreware.CAREERS_PAGE_URL, 'https://multicorewareinc.com/careers/')
  assert.equal(multicoreware.CAREERS_PORTAL_URL, 'https://multicorewareinc.zohorecruit.in/jobs/Careers')
  assert.equal(
    multicoreware.CAREERS_API_URL,
    'https://multicorewareinc.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(multicoreware.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(multicoreware.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(multicoreware.hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs keeps only published India jobs from the verified Multicoreware public feed', async () => {
  const multicoreware = await loadMulticorewareModule()

  assert.deepEqual(multicoreware.extractIndiaJobs(apiPayload), [
    {
      title: 'Embedded Software Engineer',
      company: 'MulticoreWare',
      department: null,
      location: 'Ramapuram, India',
      city: 'Ramapuram',
      state: null,
      country: 'India',
      jobId: '61825000012054388',
      requisitionId: '61825000012054388',
      sourceUrl: 'https://multicorewareinc.zohorecruit.in/jobs/Careers/61825000012054388/Embedded-Software-Engineer?source=CareerSite',
      applyUrl: 'https://multicorewareinc.zohorecruit.in/jobs/Careers/61825000012054388/Embedded-Software-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '24/06/2026',
      closingDate: null,
      jobDescription: 'Develop high-quality embedded software.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Algorithms & Optimization Engineer',
      company: 'MulticoreWare',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      state: null,
      country: 'India',
      jobId: '61825000011702230',
      requisitionId: '61825000011702230',
      sourceUrl: 'https://multicorewareinc.zohorecruit.in/jobs/Careers/61825000011702230/Algorithms-Optimization-Engineer?source=CareerSite',
      applyUrl: 'https://multicorewareinc.zohorecruit.in/jobs/Careers/61825000011702230/Algorithms-Optimization-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '29/04/2026',
      closingDate: null,
      jobDescription: 'Optimize machine learning and numeric libraries.',
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates the official Multicoreware handoff chain before decorating public India jobs', async () => {
  const multicoreware = await loadMulticorewareModule()
  const requestedUrls = []

  const jobs = await multicoreware.createMulticorewareScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === multicoreware.HOMEPAGE_URL) return homepageHtml
      if (url === multicoreware.CAREERS_PAGE_URL) return careersPageHtml
      if (url === multicoreware.CAREERS_PORTAL_URL) return portalHtml

      assert.fail(`Unexpected HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return apiPayload
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    multicoreware.HOMEPAGE_URL,
    multicoreware.CAREERS_PAGE_URL,
    multicoreware.CAREERS_PORTAL_URL,
    multicoreware.CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'multicoreware')
  assert.equal(
    jobs[0].link,
    'https://multicorewareinc.zohorecruit.in/jobs/Careers/61825000012054388/Embedded-Software-Engineer?source=CareerSite',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
})

test('run fails closed when the verified Multicoreware portal signal disappears', async () => {
  const multicoreware = await loadMulticorewareModule()

  await assert.rejects(
    multicoreware.createMulticorewareScraper().run({
      fetchText: async (url) => {
        if (url === multicoreware.HOMEPAGE_URL) return homepageHtml
        if (url === multicoreware.CAREERS_PAGE_URL) return careersPageHtml
        return '<html><body>Unexpected page</body></html>'
      },
      fetchJson: async () => apiPayload,
    }),
    /official Multicoreware careers portal/i,
  )
})
