import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Home Page - Adrosonic</title>
  </head>
  <body>
    <nav>
      <a href="https://adrosonic.com/">Home</a>
      <a href="https://adrosonic.com/services/">Services</a>
      <a href="https://adrosonic.com/careers/">Careers</a>
      <a href="https://adrosonic.com/partners/">Partners</a>
    </nav>
    <h1>Adrosonic</h1>
    <p>Your Partner for Your Digital Transformation</p>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Home Page - Adrosonic</title>
  </head>
  <body>
    <nav>
      <a href="https://adrosonic.com/careers/">Careers</a>
    </nav>
    <h1>We Transform Companies That Transform the World</h1>
    <p>Driven by Care, Defined by Innovation</p>
    <p>ADROSONIC helps enterprises unlock business value through data, automation and digital engineering.</p>
  </body>
</html>
`

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Adrosonic</title>
    <meta property="og:url" content="https://adrosonic.com/careers/">
    <meta property="og:site_name" content="Adrosonic">
  </head>
  <body>
    <h1>Careers</h1>
    <p>Join our growing global team and find your next chapter.</p>
    <button onclick="window.location.href='https://adrosonic.zohorecruit.in/jobs/Careers/';">See Job Opening</button>
    <p>Search All Openings</p>
    <p>Stay in the loop about ADROSONIC's future career opportunities or updates.</p>
  </body>
</html>
`

const portalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Careers</title>
    <meta property="og:url" content="https://adrosonic.zohorecruit.in/jobs/Careers/">
    <meta property="og:site_name" content="Careers">
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
      Industry: 'IT Services',
      Job_Type: 'Full time',
      Job_Opening_Name: 'Risk Management & Compliance Manager',
      Posting_Title: 'Risk Management & Compliance Manager',
      Country: 'India',
      City: 'Mumbai',
      id: '70502000004208083',
      $url: 'https://adrosonic.zohorecruit.in/jobs/Careers/70502000004208083/Risk-Management-Compliance-Manager?source=CareerSite',
      Remote_Job: false,
    },
    {
      Industry: 'IT Services',
      Job_Type: 'Full time',
      Job_Opening_Name: 'Senior Data Engineer - Snowflake',
      Posting_Title: 'Senior Data Engineer - Snowflake',
      Country: 'India',
      City: 'Pune',
      id: '70502000004488484',
      $url: 'https://adrosonic.zohorecruit.in/jobs/Careers/70502000004488484/Senior-Data-Engineer---Snowflake?source=CareerSite',
      Remote_Job: false,
    },
    {
      Industry: 'IT Services',
      Job_Type: 'Full time',
      Posting_Title: 'Senior Data Engineer - London',
      Country: 'United Kingdom',
      City: 'London',
      id: '70502000009999999',
      $url: 'https://adrosonic.zohorecruit.in/jobs/Careers/70502000009999999/Senior-Data-Engineer---London?source=CareerSite',
      Remote_Job: false,
    },
  ],
}

const loadAdrosonicModule = async () => {
  try {
    return await import('../../scraper/adrosonic/script.js')
  } catch {
    assert.fail('Expected Adrosonic scraper module at ../../scraper/adrosonic/script.js')
  }
}

test('Adrosonic constants stay pinned to the verified homepage, careers page, and public Zoho Recruit surfaces', async () => {
  const adrosonic = await loadAdrosonicModule()

  assert.equal(adrosonic.SOURCE, 'adrosonic')
  assert.equal(adrosonic.COMPANY, 'Adrosonic')
  assert.equal(adrosonic.OFFICIAL_BRAND_NAME, 'Adrosonic')
  assert.equal(adrosonic.VERIFIED_ON, '2026-07-14')
  assert.equal(adrosonic.HOMEPAGE_URL, 'https://adrosonic.com/')
  assert.equal(adrosonic.CAREERS_PAGE_URL, 'https://adrosonic.com/careers/')
  assert.equal(adrosonic.CAREERS_PORTAL_URL, 'https://adrosonic.zohorecruit.in/jobs/Careers/')
  assert.equal(
    adrosonic.CAREERS_API_URL,
    'https://adrosonic.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.match(adrosonic.VERIFIED_SURFACE_SUMMARY, /public Zoho Recruit portal/i)
  assert.equal(adrosonic.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(adrosonic.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(adrosonic.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(adrosonic.hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs maps Adrosonic public Zoho Recruit records and excludes non-India roles', async () => {
  const adrosonic = await loadAdrosonicModule()
  const jobs = adrosonic.extractIndiaJobs(apiPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Risk Management & Compliance Manager',
      company: 'Adrosonic',
      department: null,
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: '70502000004208083',
      requisitionId: '70502000004208083',
      sourceUrl: 'https://adrosonic.zohorecruit.in/jobs/Careers/70502000004208083/Risk-Management-Compliance-Manager?source=CareerSite',
      applyUrl: 'https://adrosonic.zohorecruit.in/jobs/Careers/70502000004208083/Risk-Management-Compliance-Manager?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Senior Data Engineer - Snowflake',
      company: 'Adrosonic',
      department: null,
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: '70502000004488484',
      requisitionId: '70502000004488484',
      sourceUrl: 'https://adrosonic.zohorecruit.in/jobs/Careers/70502000004488484/Senior-Data-Engineer---Snowflake?source=CareerSite',
      applyUrl: 'https://adrosonic.zohorecruit.in/jobs/Careers/70502000004488484/Senior-Data-Engineer---Snowflake?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates the verified Adrosonic surface before fetching and decorating India jobs', async () => {
  const adrosonic = await loadAdrosonicModule()
  const requestedUrls = []

  const jobs = await adrosonic.createAdrosonicScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === adrosonic.HOMEPAGE_URL) return homepageHtml
      if (url === adrosonic.CAREERS_PAGE_URL) return careersPageHtml
      if (url === adrosonic.CAREERS_PORTAL_URL) return portalHtml

      assert.fail(`Unexpected HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)

      if (url === adrosonic.CAREERS_API_URL) return apiPayload

      assert.fail(`Unexpected JSON request: ${url}`)
    },
    now: () => '2026-07-14T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    adrosonic.HOMEPAGE_URL,
    adrosonic.CAREERS_PAGE_URL,
    adrosonic.CAREERS_PORTAL_URL,
    adrosonic.CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'adrosonic')
  assert.equal(
    jobs[0].link,
    'https://adrosonic.zohorecruit.in/jobs/Careers/70502000004208083/Risk-Management-Compliance-Manager?source=CareerSite',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-14T00:00:00.000Z')
})

test('run fails closed when the verified Adrosonic surface markers drift', async () => {
  const adrosonic = await loadAdrosonicModule()

  await assert.rejects(
    adrosonic.createAdrosonicScraper().run({
      fetchText: async (url) => {
        if (url === adrosonic.HOMEPAGE_URL) {
          return '<html><body>No careers link here.</body></html>'
        }

        return careersPageHtml
      },
      fetchJson: async () => apiPayload,
    }),
    /official Adrosonic homepage/i,
  )

  await assert.rejects(
    adrosonic.createAdrosonicScraper().run({
      fetchText: async (url) => {
        if (url === adrosonic.HOMEPAGE_URL) return homepageHtml
        if (url === adrosonic.CAREERS_PAGE_URL) return '<html><body>Broken careers page</body></html>'
        return portalHtml
      },
      fetchJson: async () => apiPayload,
    }),
    /official Adrosonic careers page/i,
  )

  await assert.rejects(
    adrosonic.createAdrosonicScraper().run({
      fetchText: async (url) => {
        if (url === adrosonic.HOMEPAGE_URL) return homepageHtml
        if (url === adrosonic.CAREERS_PAGE_URL) return careersPageHtml
        return '<html><body>Broken portal</body></html>'
      },
      fetchJson: async () => apiPayload,
    }),
    /official Adrosonic careers portal/i,
  )
})
