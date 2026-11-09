import assert from 'node:assert/strict'
import test from 'node:test'

const loadClixCapitalModule = async () => {
  try {
    return await import('../../scraper/clixcapital/script.js')
  } catch {
    assert.fail('Expected Clix Capital scraper module at ../../scraper/scraper/clixcapital/script.js')
  }
}

test('createClixCapitalScraper targets the Clix Darwinbox host', async () => {
  const { createClixCapitalScraper } = await loadClixCapitalModule()
  const scraper = createClixCapitalScraper()

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://clixhrconnect.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://clixhrconnect.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('a1234567890abc'),
    'https://clixhrconnect.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a1234567890abc',
  )
})

test('run keeps Clix Capital jobs on the hosted Darwinbox routes and decorates the shared runner fields', async () => {
  const { createClixCapitalScraper } = await loadClixCapitalModule()
  const scraper = createClixCapitalScraper()
  const requestedPages = []

  const jobs = await scraper.run({
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [
          {
            id: 'a1234567890abc',
            title: 'Area Sales Manager',
            department_name: 'Sales',
            locations: 'Delhi, India',
            country: 'India',
            emp_type_name: 'Full Time',
            experience: '4 - 8 Years',
            posted_on: '07-Jul-2026',
            jd: '<p>Drive regional sales growth across lending products.</p>',
          },
        ],
        job_counts: 1,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Clix Capital')
  assert.equal(jobs[0].source, 'clixcapital')
  assert.equal(
    jobs[0].applyUrl,
    'https://clixhrconnect.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a1234567890abc',
  )
  assert.equal(
    jobs[0].link,
    'https://clixhrconnect.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a1234567890abc',
  )
})
