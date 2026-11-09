import assert from 'node:assert/strict'
import test from 'node:test'

const loadMulticorewareModule = async () => {
  try {
    return await import('../../scraper/multicoreware/script.js')
  } catch {
    assert.fail('Expected Multicoreware scraper module at ../../scraper/multicoreware/script.js')
  }
}

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Accelerated Software &amp; Development Company | MulticoreWare</title>
    <meta property="og:url" content="https://multicorewareinc.com/" />
    <meta property="og:site_name" content="MulticoreWare" />
  </head>
  <body>
    <a href="https://multicorewareinc.com/careers/">Careers</a>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at MulticoreWare | Global Technology &amp; IT Jobs</title>
    <meta property="og:url" content="https://multicorewareinc.com/careers/" />
    <meta property="og:site_name" content="MulticoreWare" />
  </head>
  <body>
    <script>
      window.__careerConfig = {
        page_name: "Careers",
        source: "CareerSite",
        site: "https://multicorewareinc.zohorecruit.in"
      };
    </script>
  </body>
</html>
`

const PORTAL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at MulticoreWare Inc Pvt Ltd</title>
    <meta property="og:url" content="https://multicorewareinc.zohorecruit.in/jobs/Careers" />
    <meta property="og:site_name" content="MulticoreWare Pvt Ltd" />
  </head>
  <body>
    <input id="pageJson" type="hidden" />
    <input id="moduleMeta" type="hidden" />
    <input id="jobs" type="hidden" />
  </body>
</html>
`

const JOBS_PAYLOAD = {
  code: 'success',
  data: [
    {
      id: '9001',
      Posting_Title: 'Senior Software Engineer',
      City: 'Chennai',
      State: 'Tamil Nadu',
      Country: 'India',
      $url: 'https://multicorewareinc.zohorecruit.in/jobs/Careers/9001/Senior-Software-Engineer',
      Job_Type: 'Full Time',
      Date_Opened: '2026-08-01',
      Job_Description: 'Build media-processing software and performance tooling.',
      Remote_Job: false,
      Publish: true,
    },
    {
      id: '9002',
      Posting_Title: 'US Sales Lead',
      City: 'San Jose',
      State: 'California',
      Country: 'United States',
      $url: 'https://multicorewareinc.zohorecruit.in/jobs/Careers/9002/US-Sales-Lead',
      Job_Type: 'Full Time',
      Date_Opened: '2026-08-01',
      Job_Description: 'Grow enterprise sales.',
      Remote_Job: false,
      Publish: true,
    },
  ],
  info: {},
}

test('Multicoreware signal helpers accept the verified careers and portal surfaces', async () => {
  const multicoreware = await loadMulticorewareModule()

  assert.equal(multicoreware.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(multicoreware.hasOfficialCareersPageSignal(CAREERS_HTML), true)
  assert.equal(multicoreware.hasOfficialPortalSignal(PORTAL_HTML), true)
})

test('Multicoreware extracts only India jobs from the public Zoho Recruit payload', async () => {
  const multicoreware = await loadMulticorewareModule()
  const jobs = multicoreware.extractIndiaJobs(JOBS_PAYLOAD)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer',
    company: 'MulticoreWare',
    department: null,
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    jobId: '9001',
    requisitionId: '9001',
    sourceUrl: 'https://multicorewareinc.zohorecruit.in/jobs/Careers/9001/Senior-Software-Engineer',
    applyUrl: 'https://multicorewareinc.zohorecruit.in/jobs/Careers/9001/Senior-Software-Engineer',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-08-01',
    closingDate: null,
    jobDescription: 'Build media-processing software and performance tooling.',
    remoteStatus: 'On-site',
  })
})

test('Multicoreware run validates the official pages and returns India jobs from the public API', async () => {
  const multicoreware = await loadMulticorewareModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await multicoreware.createMulticorewareScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === multicoreware.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === multicoreware.CAREERS_PAGE_URL) return CAREERS_HTML
      if (url === multicoreware.CAREERS_PORTAL_URL) return PORTAL_HTML
      throw new Error(`Unexpected Multicoreware text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === multicoreware.CAREERS_API_URL) return JOBS_PAYLOAD
      throw new Error(`Unexpected Multicoreware JSON URL: ${url}`)
    },
    now: () => '2026-08-03T00:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [
    multicoreware.HOMEPAGE_URL,
    multicoreware.CAREERS_PAGE_URL,
    multicoreware.CAREERS_PORTAL_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [multicoreware.CAREERS_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'multicoreware')
  assert.equal(
    jobs[0].link,
    'https://multicorewareinc.zohorecruit.in/jobs/Careers/9001/Senior-Software-Engineer',
  )
  assert.equal(jobs[0].scrapedAt, '2026-08-03T00:00:00.000Z')
})
