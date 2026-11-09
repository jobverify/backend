import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head><title>Career Opportunities at LENDINGKART – Join Us Now</title></head>
  <body>
    <main>
      <h1>Build the Future of Small Business Finance.</h1>
      <a href="https://www.lendingkart.com/job/">View Open Positions</a>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head><title>Jobs - Lendingkart</title></head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Explore Job Openings</h2>
      <article>
      <h3>Manager – Loan Account Management</h3>
        <a href="https://hrlendingkart.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a7318ee583fe?from=all">Apply Now</a>
      </article>
    </main>
  </body>
</html>
`

const loadLendingkartModule = async () => {
  try {
    return await import('../../scraper/lendingkart/script.js')
  } catch {
    assert.fail('Expected Lendingkart scraper module at ../../scraper/lendingkart/script.js')
  }
}

test('Lendingkart pins the verified first-party pages and Darwinbox handoff', async () => {
  const lendingkart = await loadLendingkartModule()

  assert.equal(lendingkart.SOURCE, 'lendingkart')
  assert.equal(lendingkart.COMPANY_NAME, 'Lendingkart')
  assert.equal(lendingkart.COMPANY_ID, 'main')
  assert.equal(lendingkart.VERIFIED_ON, '2026-08-07')
  assert.equal(lendingkart.OFFICIAL_SITE_URL, 'https://www.lendingkart.com/')
  assert.equal(lendingkart.OFFICIAL_CAREERS_URL, 'https://www.lendingkart.com/careers/')
  assert.equal(lendingkart.PUBLIC_JOBS_URL, 'https://www.lendingkart.com/job/')
  assert.equal(lendingkart.DARWINBOX_ORIGIN, 'https://hrlendingkart.darwinbox.in')
  assert.equal(
    lendingkart.VERIFIED_JOB_DETAIL_EXAMPLE_URL,
    'https://hrlendingkart.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a7318ee583fe?from=all',
  )
  assert.equal(
    lendingkart.PUBLIC_ALL_JOBS_URL,
    'https://hrlendingkart.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(lendingkart.hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.equal(lendingkart.hasPublicJobsPageSignal(publicJobsHtml), true)
  assert.equal(
    lendingkart.extractDarwinboxJobUrl(publicJobsHtml),
    lendingkart.VERIFIED_JOB_DETAIL_EXAMPLE_URL,
  )
})

test('Lendingkart validates the first-party pages before delegating to Darwinbox', async () => {
  const lendingkart = await loadLendingkartModule()
  const requestedUrls = []
  const runCalls = []
  const delegatedJobs = [{
    title: 'Relationship Manager',
    company: 'Lendingkart',
    location: 'Hyderabad, Telangana, India',
    source: 'lendingkart',
    link: 'https://hrlendingkart.darwinbox.in/ms/candidatev2/main/careers/jobDetails/123',
  }]

  const scraper = lendingkart.createLendingkartScraper({
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

      if (url === lendingkart.OFFICIAL_CAREERS_URL) return officialCareersHtml
      if (url === lendingkart.PUBLIC_JOBS_URL) return publicJobsHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    lendingkart.OFFICIAL_CAREERS_URL,
    lendingkart.PUBLIC_JOBS_URL,
  ])
  assert.deepEqual(runCalls, [{ maxPages: 1, maxJobs: 1 }])
  assert.deepEqual(jobs, [{ ...delegatedJobs[0], scrapedAt: FIXED_SCRAPED_AT }])
})

test('Lendingkart fails closed when either verified first-party page changes materially', async () => {
  const lendingkart = await loadLendingkartModule()

  await assert.rejects(
    lendingkart.createLendingkartScraper().run({
      fetchText: async (url) => (url === lendingkart.OFFICIAL_CAREERS_URL ? '<h1>Unexpected</h1>' : publicJobsHtml),
    }),
    /verified lendingkart careers page/i,
  )

  assert.equal(
    lendingkart.hasPublicJobsPageSignal(
      publicJobsHtml.replace(
        'https://hrlendingkart.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a7318ee583fe?from=all',
        'https://hrlendingkart.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a32a82d586fd?from=all',
      ),
    ),
    true,
  )

  await assert.rejects(
    lendingkart.createLendingkartScraper().run({
      fetchText: async (url) => {
        if (url === lendingkart.OFFICIAL_CAREERS_URL) return officialCareersHtml
        return publicJobsHtml.replace(
          'https://hrlendingkart.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a7318ee583fe?from=all',
          'https://example.com/jobs',
        )
      },
    }),
    /darwinbox job detail links/i,
  )
})
