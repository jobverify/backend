import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head><title>Careers at Cerence AI | Help Shape the Future of Voice AI Experiences</title></head>
  <body>
    <h1>Building <pint-text-gradient>AI-Powered Experiences</pint-text-gradient></h1>
    <p>Join Our Movement</p>
    <p>We have 16 offices around the globe.</p>
    <p>Pune</p>
    <a href="https://cerence.wd5.myworkdayjobs.com/Cerence">View All Open Positions</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/cerence.workday/script.js')
  } catch {
    assert.fail('Expected Cerence scraper module at ../../scraper/cerence.workday/script.js')
  }
}

test('Cerence exposes the verified first-party careers handoff and Workday runner options', async () => {
  const cerence = await loadModule()

  assert.equal(cerence.SOURCE, 'cerence')
  assert.equal(cerence.COMPANY_NAME, 'Cerence')
  assert.equal(cerence.OFFICIAL_BRAND_NAME, 'Cerence AI')
  assert.equal(cerence.VERIFIED_ON, '2026-07-18')
  assert.equal(cerence.CAREERS_URL, 'https://www.cerence.com/about/careers')
  assert.equal(cerence.WORKDAY_BASE_URL, 'https://cerence.wd5.myworkdayjobs.com/Cerence')
  assert.equal(cerence.INDIA_LOCATION_COUNTRY, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(cerence.hasOfficialCareersSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(
    cerence.extractVerifiedWorkdayHandoffUrl(VERIFIED_CAREERS_HTML),
    cerence.WORKDAY_BASE_URL,
  )
  assert.deepEqual(cerence.buildScraperOptions(), {
    company: 'Cerence',
    baseUrl: 'https://cerence.wd5.myworkdayjobs.com/Cerence',
    locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
    source: 'cerence',
    scraperDir: cerence.SCRAPER_DIR,
  })
})

test('Cerence run delegates to the shared Workday runner after the official careers handoff is verified', async () => {
  const cerence = await loadModule()
  const requestedUrls = []

  const jobs = await cerence.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === cerence.CAREERS_URL) return VERIFIED_CAREERS_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
    workdayRunner: async (options) => [
      {
        title: 'Research Scientist',
        company: 'Cerence',
        location: 'Hinjewadi, Pune',
        city: 'Pune',
        country: 'India',
        source: 'cerence',
        runnerOptions: options,
      },
      {
        title: 'Sr High Performance Compute Engineer',
        company: 'Cerence',
        location: 'Hinjewadi, Pune',
        city: 'Pune',
        country: 'India',
        source: 'cerence',
        runnerOptions: options,
      },
    ],
  })

  assert.deepEqual(requestedUrls, [cerence.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Research Scientist',
    'Sr High Performance Compute Engineer',
  ])
  assert.deepEqual(jobs[0].runnerOptions, cerence.buildScraperOptions())
  assert.deepEqual(jobs[1].runnerOptions, cerence.buildScraperOptions())
})

test('Cerence fails closed when the first-party careers page or verified Workday handoff drifts', async () => {
  const cerence = await loadModule()

  await assert.rejects(
    cerence.run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      workdayRunner: async () => [],
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    cerence.run({
      fetchText: async () => VERIFIED_CAREERS_HTML.replace(
        'https://cerence.wd5.myworkdayjobs.com/Cerence',
        'https://example.com/jobs',
      ),
      workdayRunner: async () => [],
    }),
    /verified workday handoff/i,
  )
})
