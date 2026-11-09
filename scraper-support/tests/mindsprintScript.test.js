import assert from 'node:assert/strict'
import test from 'node:test'

const loadMindsprintModule = async () => {
  try {
    return await import('../../scraper/mindsprint/script.js')
  } catch {
    assert.fail('Expected Mindsprint scraper module at ../../scraper/mindsprint/script.js')
  }
}

test('createMindsprintScraper targets the Mindsprint Darwinbox host and company id', async () => {
  const { createMindsprintScraper } = await loadMindsprintModule()
  const scraper = createMindsprintScraper()

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://mindsprint.darwinbox.in/ms/candidatev2/a671608963ef6d/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://mindsprint.darwinbox.in/ms/candidateapi/job/alljobs?companyId=a671608963ef6d',
  )
  assert.equal(
    scraper.buildJobDetailUrl('mind-001'),
    'https://mindsprint.darwinbox.in/ms/candidatev2/a671608963ef6d/careers/jobDetails/mind-001',
  )
})

test('run keeps Mindsprint jobs on the hosted Darwinbox routes and decorates the shared runner fields', async () => {
  const { createMindsprintScraper } = await loadMindsprintModule()
  const scraper = createMindsprintScraper()
  const requestedPages = []

  const jobs = await scraper.run({
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [
          {
            id: 'mind-001',
            title: 'Senior Data Engineer',
            department_name: 'Engineering',
            locations: 'Chennai, Tamil Nadu, India',
            country: 'India',
            emp_type_name: 'Full-time',
            experience: '5 - 8 Years',
            posted_on: '09-Jul-2026',
            jd: '<p>Build enterprise analytics platforms.</p>',
          },
        ],
        job_counts: 1,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Mindsprint')
  assert.equal(jobs[0].source, 'mindsprint')
  assert.equal(
    jobs[0].applyUrl,
    'https://mindsprint.darwinbox.in/ms/candidatev2/a671608963ef6d/careers/jobDetails/mind-001',
  )
  assert.equal(
    jobs[0].link,
    'https://mindsprint.darwinbox.in/ms/candidatev2/a671608963ef6d/careers/jobDetails/mind-001',
  )
})
