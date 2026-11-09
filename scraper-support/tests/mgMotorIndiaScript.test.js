import assert from 'node:assert/strict'
import test from 'node:test'

const loadMgMotorIndiaModule = async () => {
  try {
    return await import('../../scraper/mgmotorindia/script.js')
  } catch {
    assert.fail('Expected MG Motor India scraper module at ../../scraper/mgmotorindia/script.js')
  }
}

test('createMgMotorIndiaScraper targets the MG Motor India Darwinbox host and company id', async () => {
  const { createMgMotorIndiaScraper } = await loadMgMotorIndiaModule()
  const scraper = createMgMotorIndiaScraper()

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://mgmhr.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://mgmhr.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('mg-001'),
    'https://mgmhr.darwinbox.in/ms/candidatev2/main/careers/jobDetails/mg-001',
  )
})

test('run keeps MG Motor India jobs on the hosted Darwinbox routes and decorates the shared runner fields', async () => {
  const { createMgMotorIndiaScraper } = await loadMgMotorIndiaModule()
  const scraper = createMgMotorIndiaScraper()
  const requestedPages = []

  const jobs = await scraper.run({
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [
          {
            id: 'mg-001',
            title: 'Senior Manager - Administration',
            department_name: 'Administration',
            locations: 'Gurugram, Haryana, India',
            country: 'India',
            emp_type_name: 'Full-time',
            experience: '10 - 14 Years',
            posted_on: '09-Jul-2026',
            jd: '<p>Lead workplace and administration operations.</p>',
          },
        ],
        job_counts: 1,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'MG Motor India')
  assert.equal(jobs[0].source, 'mgmotorindia')
  assert.equal(
    jobs[0].applyUrl,
    'https://mgmhr.darwinbox.in/ms/candidatev2/main/careers/jobDetails/mg-001',
  )
  assert.equal(
    jobs[0].link,
    'https://mgmhr.darwinbox.in/ms/candidatev2/main/careers/jobDetails/mg-001',
  )
})
