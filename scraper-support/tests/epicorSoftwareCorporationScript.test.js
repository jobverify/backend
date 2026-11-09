import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T12:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs | Epicor</title>
    <meta name="description" content="Join 4,500 talented professionals in creating a world of better business through data, AI, and cognitive ERP." />
  </head>
  <body>
    <h1>We're Truly a Team. We Win as One.</h1>
    <a href="https://epicorsoftware.wd5.myworkdayjobs.com/epicorjobs">Search Jobs</a>
    <a href="https://jobs.epicor.com">jobs.epicor.com</a>
    <a href="/en-us/company/contact/">Contact Us</a>
  </body>
</html>
`

const cloudflareChallengeHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=Edge" />
    <meta name="robots" content="noindex,nofollow" />
  </head>
  <body>
    <div id="challenge-running">
      <h1>Please wait while we verify your browser</h1>
    </div>
  </body>
</html>
`

const workdayBoardHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <link rel="canonical" href="https://epicorsoftware.wd5.myworkdayjobs.com/epicorjobs" />
    <meta property="og:url" content="https://epicorsoftware.wd5.myworkdayjobs.com/epicorjobs" />
    <meta property="og:image" content="https://epicorsoftware.wd5.myworkdayjobs.com/epicorjobs/assets/logo" />
  </head>
  <body></body>
</html>
`

const firstPagePayload = {
  total: 3,
  jobPostings: [
    {
      title: 'Technology Consultant',
      externalPath: '/job/India-Bangalore/Technology-Consultant_JR104298',
      locationsText: 'India-Bangalore',
      bulletFields: ['JR104298'],
      timeType: 'Full time',
    },
    {
      title: 'Software Engineer',
      externalPath: '/job/India-Hyderabad/Software-Engineer_JR104299',
      locationsText: 'India-Hyderabad',
      bulletFields: ['JR104299'],
      timeType: 'Full time',
    },
    {
      title: 'Senior Financial Analyst',
      externalPath: '/job/Austin-TX/Senior-Financial-Analyst_JR104300',
      locationsText: 'Austin, TX',
      bulletFields: ['JR104300'],
      timeType: 'Full time',
    },
  ],
}

const secondPagePayload = {
  total: 3,
  jobPostings: [],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/epicorsoftwarecorporation/script.js')
  } catch {
    assert.fail('Expected Epicor Software Corporation scraper module at ../../scraper/epicorsoftwarecorporation/script.js')
  }
}

test('Epicor Software Corporation validates the first-party jobs shell and public Workday board signals', async () => {
  const epicor = await loadModule()

  assert.equal(epicor.SOURCE, 'epicorsoftwarecorporation')
  assert.equal(epicor.COMPANY, 'Epicor Software Corporation')
  assert.equal(epicor.CAREERS_URL, 'https://www.epicor.com/en/jobs/')
  assert.equal(epicor.WORKDAY_BOARD_URL, 'https://epicorsoftware.wd5.myworkdayjobs.com/epicorjobs')
  assert.equal(
    epicor.JOBS_API_URL,
    'https://epicorsoftware.wd5.myworkdayjobs.com/wday/cxs/epicorsoftware/epicorjobs/jobs',
  )
  assert.equal(epicor.VERIFIED_ON, '2026-07-18')
  assert.equal(epicor.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(epicor.hasOfficialWorkdayBoardSignal(workdayBoardHtml), true)
})

test('Epicor Software Corporation run returns only India jobs from the public Workday payload', async () => {
  const epicor = await loadModule()
  const requestedJsonBodies = []

  const jobs = await epicor.createEpicorSoftwareCorporationScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === epicor.CAREERS_URL) return careersHtml
      if (url === epicor.WORKDAY_BOARD_URL) return workdayBoardHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url, body) => {
      assert.equal(url, epicor.JOBS_API_URL)
      requestedJsonBodies.push(JSON.parse(body))
      return requestedJsonBodies.length === 1 ? firstPagePayload : secondPagePayload
    },
  })

  assert.deepEqual(requestedJsonBodies, [
    {
      appliedFacets: {},
      limit: 20,
      offset: 0,
      searchText: '',
    },
    {
      appliedFacets: {},
      limit: 20,
      offset: 2,
      searchText: '',
    },
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobId, 'JR104298')
  assert.equal(jobs[0].location, 'Bangalore, India')
  assert.equal(jobs[1].location, 'Hyderabad, India')
  assert.equal(jobs[1].scrapedAt, FIXED_SCRAPED_AT)
})

test('Epicor Software Corporation run accepts the verified careers URL when Cloudflare blocks the local shell but the board and API still validate', async () => {
  const epicor = await loadModule()
  let requestCount = 0

  const jobs = await epicor.createEpicorSoftwareCorporationScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === epicor.CAREERS_URL) return cloudflareChallengeHtml
      if (url === epicor.WORKDAY_BOARD_URL) return workdayBoardHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async () => {
      requestCount += 1
      return requestCount === 1 ? firstPagePayload : secondPagePayload
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobId, 'JR104298')
  assert.equal(jobs[1].jobId, 'JR104299')
})

test('Epicor Software Corporation fails closed when the shell or board contract changes', async () => {
  const epicor = await loadModule()

  await assert.rejects(
    epicor.createEpicorSoftwareCorporationScraper().run({
      fetchText: async (url) => (url === epicor.CAREERS_URL ? '<html><body><h1>Careers</h1></body></html>' : workdayBoardHtml),
      fetchJson: async () => firstPagePayload,
    }),
    /verified epicor jobs shell/i,
  )

  await assert.rejects(
    epicor.createEpicorSoftwareCorporationScraper().run({
      fetchText: async (url) => (url === epicor.CAREERS_URL ? careersHtml : '<html><body><h1>Board</h1></body></html>'),
      fetchJson: async () => firstPagePayload,
    }),
    /verified epicor workday board/i,
  )
})
