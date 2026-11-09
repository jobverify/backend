import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | upGrad – Transforming Online Higher Education</title>
    <meta name="description" content="Shape the future of education with upGrad! Join our dynamic team and be part of a global learning revolution.">
    <link rel="canonical" href="https://www.upgrad.com/careers/" />
  </head>
  <body>
    <script type="application/json">
      {"ctaText":"Explore open positions","ctaButtonURL":"https:\\/\\/upgrad.darwinbox.in\\/ms\\/candidate\\/main\\/careers"}
    </script>
  </body>
</html>
`

const loadUpgradModule = async () => {
  try {
    return await import('../../scraper/upgrad/script.js')
  } catch {
    assert.fail('Expected upGrad scraper module at ../../scraper/upgrad/script.js')
  }
}

test('upGrad pins the live first-party careers page and Darwinbox handoff', async () => {
  const upgrad = await loadUpgradModule()

  assert.equal(upgrad.SOURCE, 'upgrad')
  assert.equal(upgrad.COMPANY_NAME, 'upGrad')
  assert.equal(upgrad.COMPANY, 'upGrad')
  assert.equal(upgrad.COMPANY_ID, 'main')
  assert.equal(upgrad.VERIFIED_ON, '2026-07-25')
  assert.equal(upgrad.OFFICIAL_SITE_URL, 'https://www.upgrad.com/')
  assert.equal(upgrad.CAREERS_PAGE_URL, 'https://www.upgrad.com/careers/')
  assert.equal(upgrad.DARWINBOX_ORIGIN, 'https://upgrad.darwinbox.in')
  assert.equal(upgrad.OFFICIAL_CAREERS_HANDOFF_URL, 'https://upgrad.darwinbox.in/ms/candidate/main/careers')
  assert.equal(
    upgrad.PUBLIC_ALL_JOBS_URL,
    'https://upgrad.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(upgrad.hasOfficialCareersPageSignal(careersHtml), true)
  assert.deepEqual(upgrad.extractDarwinboxHandoffUrls(careersHtml), [
    'https://upgrad.darwinbox.in/ms/candidate/main/careers',
  ])
})

test('upGrad run validates the first-party careers page before delegating to Darwinbox', async () => {
  const upgrad = await loadUpgradModule()
  const requestedUrls = []
  const runCalls = []
  const delegatedJobs = [
    {
      title: 'Senior Product Manager',
      company: 'upGrad',
      location: 'Bangalore, India',
      source: 'upgrad',
      link: 'https://upgrad.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6upgrad1',
    },
  ]

  const scraper = upgrad.createUpgradScraper({
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

  assert.deepEqual(requestedUrls, [upgrad.CAREERS_PAGE_URL])
  assert.deepEqual(runCalls, [{ maxPages: 1, maxJobs: 1 }])
  assert.deepEqual(jobs, [
    {
      ...delegatedJobs[0],
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('upGrad fails closed when the first-party careers page changes materially', async () => {
  const upgrad = await loadUpgradModule()

  await assert.rejects(
    upgrad.createUpgradScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified upgrad careers page/i,
  )
})
