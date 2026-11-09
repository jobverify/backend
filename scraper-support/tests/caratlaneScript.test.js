import assert from 'node:assert/strict'
import test from 'node:test'

const loadCaratLaneModule = async () => {
  try {
    return await import('../../scraper/caratlane/script.js')
  } catch {
    assert.fail('Expected CaratLane scraper module at ../../scraper/scraper/caratlane/script.js')
  }
}

test('createCaratLaneScraper targets the CaratLane Darwinbox host and company id', async () => {
  const { createCaratLaneScraper } = await loadCaratLaneModule()
  const scraper = createCaratLaneScraper()

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://caratlane.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://caratlane.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('a1234567890abc'),
    'https://caratlane.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a1234567890abc',
  )
})

test('run keeps CaratLane jobs on the hosted Darwinbox routes and decorates the shared runner fields', async () => {
  const { createCaratLaneScraper } = await loadCaratLaneModule()
  const scraper = createCaratLaneScraper()
  const requestedPages = []

  const jobs = await scraper.run({
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [
          {
            id: 'a1234567890abc',
            title: 'Retail Operations Analyst',
            department_name: 'Retail Excellence',
            locations: 'Bengaluru, Karnataka, India',
            country: 'India',
            emp_type_name: 'FULL_TIME',
            experience: '2 - 4 Years',
            posted_on: '06-Jul-2026',
            jd: '<p>Support store operations, reporting, and process improvements.</p>',
          },
        ],
        job_counts: 1,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'CaratLane')
  assert.equal(jobs[0].source, 'caratlane')
  assert.equal(
    jobs[0].applyUrl,
    'https://caratlane.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a1234567890abc',
  )
  assert.equal(
    jobs[0].link,
    'https://caratlane.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a1234567890abc',
  )
})
