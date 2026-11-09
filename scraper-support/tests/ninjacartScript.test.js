import assert from 'node:assert/strict'
import test from 'node:test'

const loadNinjacartModule = async () => {
  try {
    return await import('../../scraper/ninjacart/script.js')
  } catch {
    assert.fail('Expected Ninjacart scraper module at ../../scraper/ninjacart/script.js')
  }
}

test('createNinjacartScraper targets the Ninjacart Darwinbox host and main company id', async () => {
  const { createNinjacartScraper } = await loadNinjacartModule()
  const scraper = createNinjacartScraper()

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://ninjacart.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://ninjacart.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('dbx-job-1'),
    'https://ninjacart.darwinbox.in/ms/candidatev2/main/careers/jobDetails/dbx-job-1',
  )
})

test('run keeps Ninjacart jobs on the hosted Darwinbox routes, filters non-India jobs, and cleans Bangalore BU city labels', async () => {
  const { createNinjacartScraper } = await loadNinjacartModule()
  const scraper = createNinjacartScraper()
  const requestedPages = []

  const jobs = await scraper.run({
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [
          {
            id: 'dbx-job-1',
            title: 'Senior Software Engineer',
            department_name: 'Engineering',
            locations: 'Bangalore BU, Bangalore, India',
            country: 'India',
            emp_type_name: 'FULL_TIME',
            experience: '4 - 7 Years',
            posted_on: '09-Jul-2026',
            jd: '<p>Build commerce and supply-chain systems.</p>',
          },
          {
            id: 'dbx-job-2',
            title: 'Business Development Manager',
            department_name: 'Sales',
            locations: 'Dubai, United Arab Emirates',
            country: 'United Arab Emirates',
            emp_type_name: 'FULL_TIME',
            experience: '5 - 8 Years',
            posted_on: '08-Jul-2026',
            jd: '<p>Grow the GCC business.</p>',
          },
        ],
        job_counts: 2,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Ninjacart')
  assert.equal(jobs[0].source, 'ninjacart')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(
    jobs[0].applyUrl,
    'https://ninjacart.darwinbox.in/ms/candidatev2/main/careers/jobDetails/dbx-job-1',
  )
  assert.equal(
    jobs[0].link,
    'https://ninjacart.darwinbox.in/ms/candidatev2/main/careers/jobDetails/dbx-job-1',
  )
})
