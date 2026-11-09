import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-19T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Affle Career</title>
  </head>
  <body>
    <main>
      <h1>Why Affle</h1>
      <p>At Affle, we're on a mission to transform the way businesses connect with consumers globally.</p>
      <a href="https://affle.darwinbox.in/ms/candidate/careers">Check Our Current Openings &gt;</a>
    </main>
  </body>
</html>
`

const loadAffleModule = async () => {
  try {
    return await import('../../scraper/affle/script.js')
  } catch {
    assert.fail('Expected Affle scraper module at ../../scraper/affle/script.js')
  }
}

test('Affle pins the live official careers page and Darwinbox handoff', async () => {
  const affle = await loadAffleModule()

  assert.equal(affle.SOURCE, 'affle')
  assert.equal(affle.COMPANY_NAME, 'Affle')
  assert.equal(affle.COMPANY, 'Affle')
  assert.equal(affle.COMPANY_ID, 'main')
  assert.equal(affle.VERIFIED_ON, '2026-07-19')
  assert.equal(affle.OFFICIAL_SITE_URL, 'https://affle.com/')
  assert.equal(affle.CAREERS_PAGE_URL, 'https://affle.com/career')
  assert.equal(affle.DARWINBOX_ORIGIN, 'https://affle.darwinbox.in')
  assert.equal(affle.OFFICIAL_CAREERS_HANDOFF_URL, 'https://affle.darwinbox.in/ms/candidate/careers')
  assert.equal(affle.PUBLIC_ALL_JOBS_URL, 'https://affle.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(affle.hasOfficialCareersHandoffSignal(careersHtml), true)
  assert.equal(
    affle.extractDarwinboxHandoffUrl(careersHtml),
    'https://affle.darwinbox.in/ms/candidate/careers',
  )
})

test('Affle run validates the first-party careers handoff before delegating to Darwinbox', async () => {
  const affle = await loadAffleModule()
  const requestedUrls = []
  const runCalls = []
  const delegatedJobs = [
    {
      title: 'Assistant Manager - Client Success, Newton',
      company: 'Affle',
      location: 'Gurugram, Haryana , India',
      source: 'affle',
      link: 'https://affle.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a68a85142b0737',
    },
  ]

  const scraper = affle.createAffleScraper({
    now: () => FIXED_SCRAPED_AT,
    darwinboxScraper: {
      run: async (options) => {
        runCalls.push(options)
        return delegatedJobs
      },
    },
  })

  const jobs = await scraper.run({
    maxPages: 1,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [affle.CAREERS_PAGE_URL])
  assert.deepEqual(runCalls, [{ maxPages: 1, maxJobs: 1 }])
  assert.deepEqual(jobs, [
    {
      ...delegatedJobs[0],
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Affle fails closed when the first-party careers page no longer hands off to the verified Darwinbox surface', async () => {
  const affle = await loadAffleModule()

  await assert.rejects(
    affle.createAffleScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified affle careers page/i,
  )

  await assert.rejects(
    affle.createAffleScraper().run({
      fetchText: async () => careersHtml.replace(
        'https://affle.darwinbox.in/ms/candidate/careers',
        'https://example.com/jobs',
      ),
    }),
    /darwinbox handoff/i,
  )
})
