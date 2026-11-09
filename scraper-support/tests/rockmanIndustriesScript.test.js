import assert from 'node:assert/strict'
import test from 'node:test'

const loadRockmanIndustriesModule = async () => {
  try {
    return await import('../../scraper/rockmanindustries/script.js')
  } catch {
    assert.fail('Expected Rockman Industries scraper module at ../../scraper/rockmanindustries/script.js')
  }
}

test('createRockmanIndustriesScraper targets the Rockman Darwinbox host and main company id', async () => {
  const { createRockmanIndustriesScraper } = await loadRockmanIndustriesModule()
  const scraper = createRockmanIndustriesScraper()

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://rockman.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://rockman.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('a6a4dca1a9ca37'),
    'https://rockman.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a4dca1a9ca37',
  )
})

test('run keeps Rockman jobs on the hosted Darwinbox routes and filters non-India jobs', async () => {
  const { createRockmanIndustriesScraper } = await loadRockmanIndustriesModule()
  const scraper = createRockmanIndustriesScraper()
  const requestedPages = []

  const jobs = await scraper.run({
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [
          {
            id: 'a6a4dca1a9ca37',
            title: 'Supervisor LPDC',
            department_name: 'Casting',
            locations: 'Haridwar, Uttarakhand, India (RIL-HARD)',
            country: 'India',
            emp_type_name: 'Staff',
            experience: '3 - 5 Years',
            posted_on: '08-Jul-2026',
            jd: '<p>Lead line-side pressure die casting operations.</p>',
          },
          {
            id: 'rockman-us-001',
            title: 'Plant Controller',
            department_name: 'Finance',
            locations: 'Detroit, Michigan, United States',
            country: 'United States',
            emp_type_name: 'Full-time',
            experience: '7 - 10 Years',
            posted_on: '07-Jul-2026',
            jd: '<p>Support North America operations.</p>',
          },
        ],
        job_counts: 2,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Rockman Industries')
  assert.equal(jobs[0].source, 'rockmanindustries')
  assert.equal(jobs[0].city, 'Haridwar')
  assert.equal(
    jobs[0].applyUrl,
    'https://rockman.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a4dca1a9ca37',
  )
  assert.equal(
    jobs[0].link,
    'https://rockman.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a4dca1a9ca37',
  )
})
