import assert from 'node:assert/strict'
import test from 'node:test'

const loadLatentViewAnalyticsModule = async () => {
  try {
    return await import('../../scraper/latentviewanalytics/script.js')
  } catch {
    assert.fail('Expected LatentView Analytics scraper module at ../../scraper/latentviewanalytics/script.js')
  }
}

test('createLatentViewAnalyticsScraper keeps the official careers handoff and public Darwinbox routes explicit', async () => {
  const {
    COMPANY_ID,
    COMPANY_NAME,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_HANDOFF_URL,
    OFFICIAL_CAREERS_URL,
    PUBLIC_PORTAL_URL,
    SOURCE,
    createLatentViewAnalyticsScraper,
  } = await loadLatentViewAnalyticsModule()

  assert.equal(COMPANY_NAME, 'LatentView Analytics')
  assert.equal(SOURCE, 'latentviewanalytics')
  assert.equal(COMPANY_ID, 'main')
  assert.equal(DARWINBOX_ORIGIN, 'https://latentview.darwinbox.in')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://www.latentview.com/career/')
  assert.equal(
    OFFICIAL_CAREERS_HANDOFF_URL,
    'https://latentview.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    PUBLIC_PORTAL_URL,
    'https://latentview.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )

  const scraper = createLatentViewAnalyticsScraper()

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://latentview.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://latentview.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('latent-001'),
    'https://latentview.darwinbox.in/ms/candidatev2/main/careers/jobDetails/latent-001',
  )
})

test('run keeps LatentView Analytics jobs on hosted Darwinbox routes and filters to India jobs', async () => {
  const { createLatentViewAnalyticsScraper } = await loadLatentViewAnalyticsModule()
  const scraper = createLatentViewAnalyticsScraper()
  const requestedPages = []

  const jobs = await scraper.run({
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [
          {
            id: 'latent-001',
            title: 'Senior Analytics Engineer',
            department_name: 'Data Engineering',
            locations: 'Chennai, Tamil Nadu, India',
            country: 'India',
            emp_type_name: 'Full Time',
            experience: '4 - 7 Years',
            posted_on: '10-Jul-2026',
            jd: '<p>Design data products and analytics workflows for enterprise clients.</p>',
          },
          {
            id: 'latent-us-001',
            title: 'Client Partner',
            department_name: 'Sales',
            locations: 'New York, New York, United States',
            country: 'United States',
            emp_type_name: 'Full Time',
            experience: '8 - 10 Years',
            posted_on: '10-Jul-2026',
            jd: '<p>Grow strategic client accounts.</p>',
          },
        ],
        job_counts: 2,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'LatentView Analytics')
  assert.equal(jobs[0].source, 'latentviewanalytics')
  assert.equal(jobs[0].city, 'Chennai')
  assert.equal(
    jobs[0].applyUrl,
    'https://latentview.darwinbox.in/ms/candidatev2/main/careers/jobDetails/latent-001',
  )
  assert.equal(
    jobs[0].link,
    'https://latentview.darwinbox.in/ms/candidatev2/main/careers/jobDetails/latent-001',
  )
  assert.ok(jobs[0].scrapedAt)
})
