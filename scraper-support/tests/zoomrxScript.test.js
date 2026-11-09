import assert from 'node:assert/strict'
import test from 'node:test'

const loadZoomRxModule = async () => {
  try {
    return await import('../../scraper/zoomrx/script.js')
  } catch {
    assert.fail('Expected ZoomRx scraper module at ../../scraper/zoomrx/script.js')
  }
}

test('createZoomRxScraper targets the ZoomRx Darwinbox host and verified company id', async () => {
  const { createZoomRxScraper } = await loadZoomRxModule()
  const scraper = createZoomRxScraper()

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://zoomrx.darwinbox.in/ms/candidatev2/5f62e79639198/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://zoomrx.darwinbox.in/ms/candidateapi/job/alljobs?companyId=5f62e79639198',
  )
  assert.equal(
    scraper.buildJobDetailUrl('a67285c057fab2'),
    'https://zoomrx.darwinbox.in/ms/candidatev2/5f62e79639198/careers/jobDetails/a67285c057fab2',
  )
})

test('run keeps ZoomRx jobs on the hosted Darwinbox routes and filters non-India jobs', async () => {
  const { createZoomRxScraper } = await loadZoomRxModule()
  const scraper = createZoomRxScraper()
  const requestedPages = []

  const jobs = await scraper.run({
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [
          {
            id: 'a67285c057fab2',
            title: 'Staff Software Engineer',
            department_name: 'Engineering',
            locations: 'Bangalore, Karnataka, India',
            country: 'India',
            emp_type_name: 'FULL_TIME',
            experience: '5 - 8 Years',
            posted_on: '09-Jul-2026',
            jd: '<p>Build platform and product capabilities for ZoomRx engineering.</p>',
          },
          {
            id: 'us-zoomrx-1',
            title: 'Commercial Strategy Manager',
            department_name: 'Strategy',
            locations: 'Boston, Massachusetts, United States',
            country: 'United States',
            emp_type_name: 'FULL_TIME',
            experience: '4 - 7 Years',
            posted_on: '08-Jul-2026',
            jd: '<p>Support the US commercial strategy team.</p>',
          },
        ],
        job_counts: 2,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'ZoomRx')
  assert.equal(jobs[0].source, 'zoomrx')
  assert.equal(
    jobs[0].applyUrl,
    'https://zoomrx.darwinbox.in/ms/candidatev2/5f62e79639198/careers/jobDetails/a67285c057fab2',
  )
  assert.equal(
    jobs[0].link,
    'https://zoomrx.darwinbox.in/ms/candidatev2/5f62e79639198/careers/jobDetails/a67285c057fab2',
  )
})
