import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Telstra India Careers</title>
    <meta
      name="description"
      content="Discover rewarding career opportunities at Telstra. Help us push the boundaries of what’s possible today and shape tomorrow through technology. Join now."
    />
  </head>
  <body>
    <main>
      <h1>Telstra India Careers</h1>
      <p>Discover rewarding career opportunities at Telstra.</p>
      <p>Help us push the boundaries of what’s possible today and shape tomorrow through technology.</p>
      <a
        class="tcom-npageheader-content-cta--primary"
        href="https://telstra.wd3.myworkdayjobs.com/Telstra_Careers"
      >
        Find a career
      </a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/telstra.workday/script.js')
  } catch {
    assert.fail('Expected Telstra scraper module at ../../scraper/telstra.workday/script.js')
  }
}

test('Telstra exposes the verified first-party careers handoff and Workday runner options', async () => {
  const telstra = await loadModule()

  assert.equal(telstra.SOURCE, 'telstra')
  assert.equal(telstra.COMPANY_NAME, 'Telstra')
  assert.equal(telstra.OFFICIAL_BRAND_NAME, 'Telstra')
  assert.equal(telstra.VERIFIED_ON, '2026-08-01')
  assert.equal(telstra.CAREERS_URL, 'https://www.telstra.com.au/careers')
  assert.equal(telstra.WORKDAY_BASE_URL, 'https://telstra.wd3.myworkdayjobs.com/Telstra_Careers')
  assert.equal(telstra.INDIA_LOCATION_COUNTRY, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(telstra.hasOfficialCareersSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(
    telstra.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'),
    false,
  )
  assert.equal(
    telstra.extractVerifiedWorkdayHandoffUrl(VERIFIED_CAREERS_HTML),
    telstra.WORKDAY_BASE_URL,
  )
  assert.deepEqual(telstra.buildScraperOptions(), {
    company: 'Telstra',
    baseUrl: 'https://telstra.wd3.myworkdayjobs.com/Telstra_Careers',
    locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
    source: 'telstra',
    scraperDir: telstra.SCRAPER_DIR,
  })
})

test('Telstra run delegates to the shared Workday runner after the official careers handoff is verified', async () => {
  const telstra = await loadModule()
  const requestedUrls = []

  const jobs = await telstra.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === telstra.CAREERS_URL) return VERIFIED_CAREERS_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
    workdayRunner: async (options) => [
      {
        title: 'WFM Specialist',
        company: 'Telstra',
        location: 'Bengaluru, Karnataka',
        city: 'Bengaluru',
        country: 'India',
        jobId: 'JR-10171259',
        requisitionId: 'JR-10171259',
        sourceUrl: 'https://telstra.wd3.myworkdayjobs.com/en-US/Telstra_Careers/job/Bengaluru-Karnataka/Process-Support_JR-10171259-1',
        applyUrl: 'https://telstra.wd3.myworkdayjobs.com/en-US/Telstra_Careers/job/Bengaluru-Karnataka/Process-Support_JR-10171259-1',
        source: 'telstra',
        scrapedAt: '2026-07-17T00:00:00.000Z',
        runnerOptions: options,
      },
      {
        title: 'Customer Service Consultant - International Voice Process',
        company: 'Telstra',
        location: 'Bengaluru, Karnataka',
        city: 'Bengaluru',
        country: 'India',
        jobId: 'JR-10169610',
        requisitionId: 'JR-10169610',
        sourceUrl: 'https://telstra.wd3.myworkdayjobs.com/en-US/Telstra_Careers/job/Bengaluru-Karnataka/Customer-Service-Consultant---International-Voice-Process_JR-10169610',
        applyUrl: 'https://telstra.wd3.myworkdayjobs.com/en-US/Telstra_Careers/job/Bengaluru-Karnataka/Customer-Service-Consultant---International-Voice-Process_JR-10169610',
        source: 'telstra',
        scrapedAt: '2026-07-17T00:00:00.000Z',
        runnerOptions: options,
      },
    ],
  })

  assert.deepEqual(requestedUrls, [telstra.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => job.title), [
    'WFM Specialist',
    'Customer Service Consultant - International Voice Process',
  ])
  assert.deepEqual(jobs[0].runnerOptions, telstra.buildScraperOptions())
  assert.deepEqual(jobs[1].runnerOptions, telstra.buildScraperOptions())
})

test('Telstra fails closed when the first-party careers page or verified Workday handoff drifts', async () => {
  const telstra = await loadModule()

  await assert.rejects(
    telstra.run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      workdayRunner: async () => [],
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    telstra.run({
      fetchText: async () => VERIFIED_CAREERS_HTML.replace(
        'https://telstra.wd3.myworkdayjobs.com/Telstra_Careers',
        'https://example.com/jobs',
      ),
      workdayRunner: async () => [],
    }),
    /verified workday handoff/i,
  )
})
