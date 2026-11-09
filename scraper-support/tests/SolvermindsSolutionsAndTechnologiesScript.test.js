import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Solverminds — The Maritime Enterprise System</title>
  </head>
  <body>
    <nav>
      <a href="/about">About</a>
      <a href="/careers">Careers</a>
    </nav>
    <h1>The maritime enterprise system.</h1>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About · Solverminds</title>
  </head>
  <body>
    <h1>Built for maritime.</h1>
    <h2>Careers</h2>
    <p>Build the future of maritime.</p>
    <a href="https://careers.solverminds.com/jobs/Careers">See open roles</a>
  </body>
</html>
`

const portalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Careers</title>
    <meta property="og:url" content="https://careers.solverminds.com/jobs/Careers">
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
      id: '161219000001128066',
      Posting_Title: 'Associate Software Engineer',
      City: 'Chennai Siruseri',
      State: 'Tamil Nadu',
      Country: 'India',
      Job_Type: 'Full time',
      Work_Experience: '<1',
      Required_Skills: 'Java, Spring Boot',
      Date_Opened: '10/22/2025',
      Remote_Job: false,
      Job_Description: 'Develop maritime applications.',
      $url: 'https://careers.solverminds.com/jobs/Careers/161219000001128066/Associate-Software-Engineer?source=CareerSite',
    },
    {
      id: '161219000003510070',
      Posting_Title: 'Alumini - Hiring',
      City: '',
      State: '',
      Country: '',
      Job_Type: 'Full time',
      Work_Experience: '5 to 8 years',
      Required_Skills: '',
      Date_Opened: '07/09/2026',
      Remote_Job: 'Yes',
      Job_Description: 'Multiple Technology Openings Location: Chennai Work Mode: Work From Office (5 Days) Employment Type: Full-Time About Solverminds',
      $url: 'https://careers.solverminds.com/jobs/Careers/161219000003510070/Alumini---Hiring?source=CareerSite',
    },
    {
      id: '161219000009999999',
      Posting_Title: 'US Engineer',
      City: 'Austin',
      State: 'Texas',
      Country: 'United States',
      Job_Type: 'Full time',
      Work_Experience: '4 years',
      Required_Skills: 'Node.js',
      Date_Opened: '07/01/2026',
      Remote_Job: false,
      Job_Description: 'Based in Austin.',
      $url: 'https://careers.solverminds.com/jobs/Careers/161219000009999999/US-Engineer?source=CareerSite',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/solvermindssolutionsandtechnologies/script.js')
  } catch {
    assert.fail('Expected Solverminds Solutions and Technologies scraper module at ../../scraper/solvermindssolutionsandtechnologies/script.js')
  }
}

test('Solverminds Solutions and Technologies validates the verified homepage, about page, and public Zoho careers portal', async () => {
  const solverminds = await loadModule()

  assert.equal(solverminds.HOMEPAGE_URL, 'https://www.solverminds.com/')
  assert.equal(solverminds.ABOUT_URL, 'https://www.solverminds.com/about')
  assert.equal(solverminds.CAREERS_PORTAL_URL, 'https://careers.solverminds.com/jobs/Careers')
  assert.equal(
    solverminds.CAREERS_API_URL,
    'https://careers.solverminds.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(solverminds.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(solverminds.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(solverminds.hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs maps Solverminds India jobs from the live Zoho payload and recovers Chennai-only records', async () => {
  const solverminds = await loadModule()

  assert.deepEqual(solverminds.extractIndiaJobs(apiPayload), [{
    title: 'Associate Software Engineer',
    company: 'Solverminds Solutions and Technologies',
    department: null,
    location: 'Chennai Siruseri, Tamil Nadu, India',
    city: 'Chennai Siruseri',
    state: 'Tamil Nadu',
    country: 'India',
    jobId: '161219000001128066',
    requisitionId: '161219000001128066',
    sourceUrl: 'https://careers.solverminds.com/jobs/Careers/161219000001128066/Associate-Software-Engineer?source=CareerSite',
    applyUrl: 'https://careers.solverminds.com/jobs/Careers/161219000001128066/Associate-Software-Engineer?source=CareerSite',
    employmentType: 'Full-time',
    experienceRequired: '<1',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Java', 'Spring Boot'],
    postingDate: '10/22/2025',
    closingDate: null,
    jobDescription: 'Develop maritime applications.',
    remoteStatus: 'On-site',
  }, {
    title: 'Alumini - Hiring',
    company: 'Solverminds Solutions and Technologies',
    department: null,
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    jobId: '161219000003510070',
    requisitionId: '161219000003510070',
    sourceUrl: 'https://careers.solverminds.com/jobs/Careers/161219000003510070/Alumini---Hiring?source=CareerSite',
    applyUrl: 'https://careers.solverminds.com/jobs/Careers/161219000003510070/Alumini---Hiring?source=CareerSite',
    employmentType: 'Full-time',
    experienceRequired: '5 to 8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '07/09/2026',
    closingDate: null,
    jobDescription: 'Multiple Technology Openings Location: Chennai Work Mode: Work From Office (5 Days) Employment Type: Full-Time About Solverminds',
    remoteStatus: 'On-site',
  }])
})

test('Solverminds Solutions and Technologies run validates the official pages and decorates the public India jobs', async () => {
  const solverminds = await loadModule()
  const requestedUrls = []

  const jobs = await solverminds.createSolvermindsSolutionsAndTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === solverminds.HOMEPAGE_URL) return homepageHtml
      if (url === solverminds.ABOUT_URL) return aboutHtml
      if (url === solverminds.CAREERS_PORTAL_URL) return portalHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, solverminds.CAREERS_API_URL)
      return apiPayload
    },
    now: () => '2026-08-04T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    solverminds.HOMEPAGE_URL,
    solverminds.ABOUT_URL,
    solverminds.CAREERS_PORTAL_URL,
    solverminds.CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'solvermindssolutionsandtechnologies')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-08-04T00:00:00.000Z')
})

test('Solverminds Solutions and Technologies fails closed when the verified public portal disappears', async () => {
  const solverminds = await loadModule()

  await assert.rejects(
    solverminds.createSolvermindsSolutionsAndTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === solverminds.HOMEPAGE_URL) return homepageHtml
        if (url === solverminds.ABOUT_URL) return aboutHtml
        return '<html><body>Unexpected portal</body></html>'
      },
      fetchJson: async () => apiPayload,
    }),
    /official Solverminds careers portal/i,
  )
})
