import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Lloyds Technology Centre | Careers</title>
  </head>
  <body>
    <h1>Careers at Lloyds Technology Centre</h1>
    <p>We're Lloyds Technology Centre*, a tech and data company located in Hyderabad, India.</p>
    <a href="https://lbg.wd3.myworkdayjobs.com/Lloyds_Technology_Centre">Search and apply</a>
    <a href="https://lbg.wd3.myworkdayjobs.com/Lloyds_Technology_Centre">Search and apply for jobs</a>
  </body>
</html>
`

const WORKDAY_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://lbg.wd3.myworkdayjobs.com/Lloyds_Technology_Centre" />
    <meta property="og:url" content="https://lbg.wd3.myworkdayjobs.com/Lloyds_Technology_Centre">
  </head>
  <script>tenant: "lbg", siteId: "Lloyds_Technology_Centre"</script>
</html>
`

const FIRST_PAGE = {
  total: 3,
  jobPostings: [{
    title: 'Lead Data & AI Scientist',
    externalPath: '/job/Hyderabad-Knowledge-Park-Tower-2/Lead-Data---AI-Scientist_160582',
    locationsText: 'Hyderabad Knowledge Park Tower 2',
    postedOn: 'Posted 2 Days Ago',
    bulletFields: ['160582', '2026-08-07'],
  }],
}

const SECOND_PAGE = {
  // The live Workday API only reports its total on the first page.
  total: 0,
  jobPostings: [{
    title: 'Finance Manager',
    externalPath: '/job/Hyderabad-Knowledge-Park-Tower-2/Finance-Manager_161552',
    locationsText: 'Hyderabad Knowledge Park Tower 2',
    postedOn: 'Posted 2 Days Ago',
    bulletFields: ['161552', '2026-08-10'],
  }],
}

const THIRD_PAGE = {
  total: 0,
  jobPostings: [{
    title: 'Senior Quality Engineer',
    externalPath: '/job/Hyderabad-Knowledge-Park-Tower-2/Senior-Quality-Engineer_160489',
    locationsText: 'Hyderabad Knowledge Park Tower 2',
    postedOn: 'Posted 2 Days Ago',
    bulletFields: ['160489', '2026-09-30'],
  }],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/lloydstechnologycentre/script.js')
  } catch {
    assert.fail('Expected Lloyds Technology Centre scraper module at ../../scraper/lloydstechnologycentre/script.js')
  }
}

test('Lloyds Technology Centre helpers stay pinned to the verified careers page, recovered Workday shell, and jobs API', async () => {
  const lloyds = await loadModule()

  assert.equal(lloyds.SOURCE, 'lloydstechnologycentre')
  assert.equal(lloyds.COMPANY, 'Lloyds Technology Centre')
  assert.equal(lloyds.CAREERS_URL, 'https://lloydstechnologycentre.com/')
  assert.equal(
    lloyds.WORKDAY_BOARD_URL,
    'https://lbg.wd3.myworkdayjobs.com/Lloyds_Technology_Centre',
  )
  assert.equal(
    lloyds.JOBS_API_URL,
    'https://lbg.wd3.myworkdayjobs.com/wday/cxs/lbg/Lloyds_Technology_Centre/jobs',
  )
  assert.equal(lloyds.hasOfficialCareersSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(
    lloyds.extractVerifiedWorkdayBoardUrl(VERIFIED_CAREERS_HTML),
    lloyds.WORKDAY_BOARD_URL,
  )
  assert.equal(lloyds.hasOfficialWorkdayBoardSignal(WORKDAY_BOARD_HTML), true)
  assert.deepEqual(lloyds.buildJobsApiRequest(20, 10), {
    appliedFacets: {},
    limit: 10,
    offset: 20,
    searchText: '',
  })
})

test('Lloyds Technology Centre enumerates and normalizes every opening from the verified Workday jobs API', async () => {
  const lloyds = await loadModule()
  const requestedUrls = []
  const requestedBodies = []

  const jobs = await lloyds.createLloydsTechnologyCentreScraper({
    now: () => '2026-08-03T00:00:00.000Z',
    pageSize: 1,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === lloyds.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === lloyds.WORKDAY_BOARD_URL) return WORKDAY_BOARD_HTML
      throw new Error(`Unexpected Lloyds Technology Centre URL: ${url}`)
    },
    fetchJson: async (url, options) => {
      assert.equal(url, lloyds.JOBS_API_URL)
      requestedBodies.push(JSON.parse(options.body))
      return [FIRST_PAGE, SECOND_PAGE, THIRD_PAGE][requestedBodies.length - 1]
    },
  })

  assert.deepEqual(requestedUrls, [
    lloyds.CAREERS_URL,
    lloyds.WORKDAY_BOARD_URL,
  ])
  assert.deepEqual(requestedBodies, [
    lloyds.buildJobsApiRequest(0, 1),
    lloyds.buildJobsApiRequest(1, 1),
    lloyds.buildJobsApiRequest(2, 1),
  ])
  assert.deepEqual(jobs.map(({ title, jobId, location, city, link, source, scrapedAt }) => ({
    title,
    jobId,
    location,
    city,
    link,
    source,
    scrapedAt,
  })), [
    {
      title: 'Lead Data & AI Scientist',
      jobId: '160582',
      location: 'Hyderabad Knowledge Park Tower 2, India',
      city: 'Hyderabad',
      link: 'https://lbg.wd3.myworkdayjobs.com/Lloyds_Technology_Centre/job/Hyderabad-Knowledge-Park-Tower-2/Lead-Data---AI-Scientist_160582/apply',
      source: 'lloydstechnologycentre',
      scrapedAt: '2026-08-03T00:00:00.000Z',
    },
    {
      title: 'Finance Manager',
      jobId: '161552',
      location: 'Hyderabad Knowledge Park Tower 2, India',
      city: 'Hyderabad',
      link: 'https://lbg.wd3.myworkdayjobs.com/Lloyds_Technology_Centre/job/Hyderabad-Knowledge-Park-Tower-2/Finance-Manager_161552/apply',
      source: 'lloydstechnologycentre',
      scrapedAt: '2026-08-03T00:00:00.000Z',
    },
    {
      title: 'Senior Quality Engineer',
      jobId: '160489',
      location: 'Hyderabad Knowledge Park Tower 2, India',
      city: 'Hyderabad',
      link: 'https://lbg.wd3.myworkdayjobs.com/Lloyds_Technology_Centre/job/Hyderabad-Knowledge-Park-Tower-2/Senior-Quality-Engineer_160489/apply',
      source: 'lloydstechnologycentre',
      scrapedAt: '2026-08-03T00:00:00.000Z',
    },
  ])
})

test('Lloyds Technology Centre fails closed when its careers handoff or Workday board identity drifts', async () => {
  const lloyds = await loadModule()

  await assert.rejects(
    lloyds.createLloydsTechnologyCentreScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified Lloyds Technology Centre careers page/i,
  )

  await assert.rejects(
    lloyds.createLloydsTechnologyCentreScraper().run({
      fetchText: async (url) => {
        if (url === lloyds.CAREERS_URL) return VERIFIED_CAREERS_HTML
        return '<html><body>Unexpected board</body></html>'
      },
    }),
    /verified Workday board/i,
  )
})
