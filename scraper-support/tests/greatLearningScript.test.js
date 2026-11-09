import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-09-13T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Great Learning Careers: Apply for Current Job Openings</title>
    <link rel="canonical" href="https://www.mygreatlearning.com/careers" />
  </head>
  <body>
    <section>
      <h2>Current openings at Great Learning</h2>
      <p>Become part of our team of impact-makers!</p>
      <ul class="career-openings__list">
        <li class="career-openings__item" data-job-link="https://greatlearning.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6273b25f4d533?from=all">
          <p class="job-position">Learning Consultant - Domestic Sales</p>
        </li>
        <li class="career-openings__item" data-job-link="https://greatlearning.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a662b99601bf64?from=all">
          <p class="job-position">Assistant Manager - Finance</p>
        </li>
        <li class="career-openings__item" data-job-link="https://greatlearning.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a694b931a6b6a9?from=all">
          <p class="job-position">Content Strategist</p>
        </li>
      </ul>
    </section>
  </body>
</html>
`

const loadGreatLearningModule = async () => {
  try {
    return await import('../../scraper/greatlearning/script.js')
  } catch {
    assert.fail('Expected Great Learning scraper module at ../../scraper/greatlearning/script.js')
  }
}

test('Great Learning pins the live first-party careers page and Darwinbox detail links', async () => {
  const greatLearning = await loadGreatLearningModule()

  assert.equal(greatLearning.SOURCE, 'greatlearning')
  assert.equal(greatLearning.COMPANY_NAME, 'Great Learning')
  assert.equal(greatLearning.COMPANY, 'Great Learning')
  assert.equal(greatLearning.COMPANY_ID, 'main')
  assert.equal(greatLearning.VERIFIED_ON, '2026-09-13')
  assert.equal(greatLearning.OFFICIAL_SITE_URL, 'https://www.mygreatlearning.com/')
  assert.equal(greatLearning.CAREERS_PAGE_URL, 'https://www.mygreatlearning.com/careers')
  assert.equal(greatLearning.DARWINBOX_ORIGIN, 'https://greatlearning.darwinbox.in')
  assert.equal(
    greatLearning.PUBLIC_ALL_JOBS_URL,
    'https://greatlearning.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(greatLearning.hasOfficialCareersPageSignal(careersHtml), true)
  assert.deepEqual(greatLearning.extractDarwinboxJobDetailUrls(careersHtml), [
    'https://greatlearning.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6273b25f4d533?from=all',
    'https://greatlearning.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a662b99601bf64?from=all',
    'https://greatlearning.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a694b931a6b6a9?from=all',
  ])
})

test('Great Learning run validates the first-party careers page before delegating to Darwinbox', async () => {
  const greatLearning = await loadGreatLearningModule()
  const requestedUrls = []
  const runCalls = []
  const delegatedJobs = [
    {
      title: 'Learning Consultant - Domestic Sales',
      company: 'Great Learning',
      location: 'Bangalore, India',
      source: 'greatlearning',
      link: 'https://greatlearning.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6273b25f4d533',
    },
  ]

  const scraper = greatLearning.createGreatLearningScraper({
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

  assert.deepEqual(requestedUrls, [greatLearning.CAREERS_PAGE_URL])
  assert.deepEqual(runCalls, [{ maxPages: 1, maxJobs: 1 }])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, delegatedJobs[0].title)
  assert.equal(jobs[0].nativeLocation, delegatedJobs[0].location)
  assert.equal(jobs[0].link, delegatedJobs[0].link)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].country, null)
  assert.equal(jobs[0].jobId, null)
  assert.equal(jobs[0].requisitionId, null)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceCountryScopeUnresolved, true)
})

test('Great Learning fails closed when the first-party careers page changes materially', async () => {
  const greatLearning = await loadGreatLearningModule()

  await assert.rejects(
    greatLearning.createGreatLearningScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified great learning careers page/i,
  )
})
