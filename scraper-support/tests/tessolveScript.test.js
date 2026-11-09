import assert from 'node:assert/strict'
import test from 'node:test'

const loadTessolveModule = async () => {
  try {
    return await import('../../scraper/tessolve/script.js')
  } catch {
    assert.fail('Expected Tessolve scraper module at ../../scraper/scraper/tessolve/script.js')
  }
}

test('createTessolveScraper targets the Tessolve Darwinbox host', async () => {
  const { createTessolveScraper } = await loadTessolveModule()
  const scraper = createTessolveScraper()

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://tessolve.darwinbox.com/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://tessolve.darwinbox.com/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('a6a4f500677b4c'),
    'https://tessolve.darwinbox.com/ms/candidatev2/main/careers/jobDetails/a6a4f500677b4c',
  )
})

test('run keeps Tessolve jobs on the hosted Darwinbox routes and decorates the shared runner fields', async () => {
  const { createTessolveScraper } = await loadTessolveModule()
  const scraper = createTessolveScraper()
  const requestedPages = []

  const jobs = await scraper.run({
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [
          {
            id: 'a6a4f500677b4c',
            title: 'Senior Staff Engineer',
            department_name: 'Semiconductor Engineering',
            locations: 'Bengaluru, Karnataka, India',
            country: 'India',
            emp_type_name: 'Full-time',
            experience: '6 - 10 Years',
            posted_on: '09-Jul-2026',
            jd: '<p>Lead silicon validation and debug programs.</p>',
          },
        ],
        job_counts: 1,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Tessolve')
  assert.equal(jobs[0].source, 'tessolve')
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(
    jobs[0].applyUrl,
    'https://tessolve.darwinbox.com/ms/candidatev2/main/careers/jobDetails/a6a4f500677b4c',
  )
  assert.equal(
    jobs[0].link,
    'https://tessolve.darwinbox.com/ms/candidatev2/main/careers/jobDetails/a6a4f500677b4c',
  )
})
