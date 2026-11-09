import assert from 'node:assert/strict'
import test from 'node:test'

const loadSakarRoboticsModule = async () => {
  try {
    return await import('../../scraper/sakarrobotics/script.js')
  } catch {
    assert.fail('Expected Sakar Robotics scraper module at ../../scraper/sakarrobotics/script.js')
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Sakar Robotics: Intelligent Automation</title>
    </head>
    <body>
      <a href="/careers">Careers</a>
      <a href="https://sakarrobotics.zohorecruit.in/jobs/Careers">Apply Now</a>
      <section>Unified Autonomous Robotics Platform</section>
      <section>Build the Future with Us</section>
    </body>
  </html>
`

const careersPageHtml = `
  <html>
    <head>
      <title>Sakar Robotics: Intelligent Automation</title>
    </head>
    <body>
      <h1>Careers</h1>
      <p>Join a multidisciplinary team engineering autonomous systems that amplify human capability across industries.</p>
      <a href="https://sakarrobotics.zohorecruit.in/jobs/Careers">View Open Roles</a>
      <a href="https://sakarrobotics.zohorecruit.in/jobs/Careers">Apply Now</a>
    </body>
  </html>
`

const currentAppShellHtml = `
  <html>
    <head>
      <title>Sakar Robotics</title>
      <meta name="description" content="Sakar builds general-purpose robots that perceive, decide, and act." />
      <meta property="og:title" content="Sakar Robotics" />
      <meta property="og:url" content="https://www.sakarrobotics.com/" />
    </head>
    <body>
      <script src="/build/seo.js?v=206"></script>
      <script src="/build/data.js?v=206"></script>
      <script src="/build/pages/company.js?v=206"></script>
      <script src="/build/app.js?v=206"></script>
    </body>
  </html>
`

const portalHtml = `
  <html>
    <head>
      <title>Careers at Sakar Robotics</title>
      <meta property="og:url" content="https://sakarrobotics.zohorecruit.in/jobs/Careers">
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
      id: '92525000002411134',
      Job_Opening_Name: 'Robotics Engineer',
      Posting_Title: 'Robotics Engineer',
      Industry: 'Engineering',
      Job_Type: 'Full time',
      City: 'Pune City',
      Country: 'India',
      Work_Experience: '2-5 Years',
      Job_Description: 'JD – Robotics Engineer Location: Pune Experience: 2-5 Years',
      Date_Opened: '01/24/2026',
      Publish: true,
      $url: 'https://sakarrobotics.zohorecruit.in/jobs/Careers/92525000002411134/Robotics-Engineer?source=CareerSite',
    },
    {
      id: '92525000002325103',
      Job_Opening_Name: 'Global Growth Partner',
      Posting_Title: 'Global Growth Partner',
      Industry: 'Business Management',
      Job_Type: 'Full time',
      City: 'Pune City',
      Country: 'India',
      Work_Experience: '5-8 Years',
      Job_Description: 'JD – Global Growth Partner Location: Pune Experience: 5-8 Years',
      Date_Opened: '02/11/2026',
      Publish: true,
      $url: 'https://sakarrobotics.zohorecruit.in/jobs/Careers/92525000002325103/Global-Growth-Partner?source=CareerSite',
    },
    {
      id: '92525000002155101',
      Job_Opening_Name: 'Accountant',
      Posting_Title: 'Accountant',
      Industry: 'Accounting',
      Job_Type: 'Full time',
      City: 'Pune City',
      Country: 'India',
      Publish: false,
      $url: 'https://sakarrobotics.zohorecruit.in/jobs/Careers/92525000002155101/Accountant?source=CareerSite',
    },
    {
      id: '92525000009999999',
      Job_Opening_Name: 'US Robotics Counsel',
      Posting_Title: 'US Robotics Counsel',
      Industry: 'Legal',
      Job_Type: 'Full time',
      City: 'Austin',
      Country: 'United States',
      Publish: true,
      $url: 'https://sakarrobotics.zohorecruit.in/jobs/Careers/92525000009999999/US-Robotics-Counsel?source=CareerSite',
    },
  ],
}

test('Sakar Robotics constants stay pinned to the verified homepage, careers handoff, official portal, and public jobs API surfaces', async () => {
  const sakarRobotics = await loadSakarRoboticsModule()

  assert.equal(sakarRobotics.HOMEPAGE_URL, 'https://www.sakarrobotics.com/')
  assert.equal(sakarRobotics.CAREERS_PAGE_URL, 'https://www.sakarrobotics.com/careers')
  assert.equal(sakarRobotics.CAREERS_PORTAL_URL, 'https://sakarrobotics.zohorecruit.in/jobs/Careers')
  assert.equal(
    sakarRobotics.CAREERS_API_URL,
    'https://sakarrobotics.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite&extra_fields=%5B%22Work_Experience%22,%22Job_Description%22,%22Date_Opened%22%5D',
  )
  assert.equal(sakarRobotics.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(sakarRobotics.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(sakarRobotics.hasOfficialHomepageSignal(currentAppShellHtml), true)
  assert.equal(sakarRobotics.hasOfficialCareersPageSignal(currentAppShellHtml), true)
  assert.equal(sakarRobotics.hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs keeps only published India listings from the Sakar Robotics public jobs feed', async () => {
  const sakarRobotics = await loadSakarRoboticsModule()
  const jobs = sakarRobotics.extractIndiaJobs(apiPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Robotics Engineer',
      company: 'Sakar Robotics',
      department: 'Engineering',
      location: 'Pune City, India',
      city: 'Pune City',
      state: null,
      country: 'India',
      jobId: '92525000002411134',
      requisitionId: '92525000002411134',
      sourceUrl: 'https://sakarrobotics.zohorecruit.in/jobs/Careers/92525000002411134/Robotics-Engineer?source=CareerSite',
      applyUrl: 'https://sakarrobotics.zohorecruit.in/jobs/Careers/92525000002411134/Robotics-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '2-5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '01/24/2026',
      closingDate: null,
      jobDescription: 'JD – Robotics Engineer Location: Pune Experience: 2-5 Years',
      publicExperienceChecked: true,
      remoteStatus: null,
    },
    {
      title: 'Global Growth Partner',
      company: 'Sakar Robotics',
      department: 'Business Management',
      location: 'Pune City, India',
      city: 'Pune City',
      state: null,
      country: 'India',
      jobId: '92525000002325103',
      requisitionId: '92525000002325103',
      sourceUrl: 'https://sakarrobotics.zohorecruit.in/jobs/Careers/92525000002325103/Global-Growth-Partner?source=CareerSite',
      applyUrl: 'https://sakarrobotics.zohorecruit.in/jobs/Careers/92525000002325103/Global-Growth-Partner?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '5-8 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '02/11/2026',
      closingDate: null,
      jobDescription: 'JD – Global Growth Partner Location: Pune Experience: 5-8 Years',
      publicExperienceChecked: true,
      remoteStatus: null,
    },
  ])
})

test('run validates the official Sakar Robotics homepage, careers handoff, and portal before fetching jobs', async () => {
  const sakarRobotics = await loadSakarRoboticsModule()
  const requestedUrls = []

  const jobs = await sakarRobotics.createSakarRoboticsScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === sakarRobotics.HOMEPAGE_URL) return homepageHtml
      if (url === sakarRobotics.CAREERS_PAGE_URL) return careersPageHtml
      if (url === sakarRobotics.CAREERS_PORTAL_URL) return portalHtml

      assert.fail(`Unexpected HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return apiPayload
    },
    now: () => '2026-07-11T06:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    sakarRobotics.HOMEPAGE_URL,
    sakarRobotics.CAREERS_PAGE_URL,
    sakarRobotics.CAREERS_PORTAL_URL,
    sakarRobotics.CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'sakarrobotics')
  assert.equal(
    jobs[0].link,
    'https://sakarrobotics.zohorecruit.in/jobs/Careers/92525000002411134/Robotics-Engineer?source=CareerSite',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-11T06:30:00.000Z')
  assert.equal(jobs[0].experienceRequired, '2-5 Years')
  assert.equal(jobs[0].publicExperienceChecked, true)
})

test('run fails closed when the Sakar Robotics official portal signal disappears', async () => {
  const sakarRobotics = await loadSakarRoboticsModule()

  await assert.rejects(
    sakarRobotics.createSakarRoboticsScraper().run({
      fetchText: async (url) => {
        if (url === sakarRobotics.HOMEPAGE_URL) return homepageHtml
        if (url === sakarRobotics.CAREERS_PAGE_URL) return careersPageHtml
        return '<html><body>Unexpected page</body></html>'
      },
      fetchJson: async () => apiPayload,
    }),
    /official Sakar Robotics careers portal/i,
  )
})
