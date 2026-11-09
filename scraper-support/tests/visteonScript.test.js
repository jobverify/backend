import assert from 'node:assert/strict'
import test from 'node:test'

const loadVisteonModule = async () => {
  try {
    return await import('../../scraper/visteon/script.js')
  } catch {
    assert.fail('Expected Visteon scraper module at ../../scraper/scraper/visteon/script.js')
  }
}

test('createVisteonScraper targets the Visteon Darwinbox tenant with the main company id', async () => {
  const { createVisteonScraper } = await loadVisteonModule()
  const scraper = createVisteonScraper()

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://visteon-panorama.darwinbox.com/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://visteon-panorama.darwinbox.com/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('visteon-job-1'),
    'https://visteon-panorama.darwinbox.com/ms/candidatev2/main/careers/jobDetails/visteon-job-1',
  )
})

test('run returns only India jobs with Visteon source metadata', async () => {
  const { createVisteonScraper } = await loadVisteonModule()
  const scraper = createVisteonScraper()

  const jobs = await scraper.run({
    fetchListingPage: async () => ({
      status: 'success',
      data: [
        {
          id: 'visteon-job-1',
          title: 'Software Engineer',
          department_name: 'Engineering',
          locations: 'Chennai, Tamil Nadu, India',
          country: 'India',
          emp_type_name: 'Full-time',
          experience: '3 - 5 Years',
          posted_on: '08-Jul-2026',
          jd: '<p>Build automotive software.</p>',
        },
        {
          id: 'visteon-job-us-1',
          title: 'Software Engineer',
          department_name: 'Engineering',
          locations: 'Belleville, Michigan, United States',
          country: 'United States',
          emp_type_name: 'Full-time',
          experience: '3 - 5 Years',
          posted_on: '08-Jul-2026',
          jd: '<p>Build automotive software.</p>',
        },
      ],
      job_counts: 2,
    }),
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Visteon Corporation')
  assert.equal(jobs[0].source, 'visteon')
  assert.equal(jobs[0].city, 'Chennai')
  assert.equal(
    jobs[0].applyUrl,
    'https://visteon-panorama.darwinbox.com/ms/candidatev2/main/careers/jobDetails/visteon-job-1',
  )
})
