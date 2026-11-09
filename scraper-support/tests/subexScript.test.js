import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-10T00:00:00.000Z'

const loadSubexModule = async () => {
  try {
    return await import('../../scraper/subex/script.js')
  } catch {
    assert.fail('Expected Subex scraper module at ../../scraper/subex/script.js')
  }
}

test('Subex scraper keeps the verified official careers handoff and hosted Darwinbox routes explicit', async () => {
  const {
    COMPANY_ID,
    COMPANY_NAME,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_HANDOFF_URL,
    OFFICIAL_CAREERS_URL,
    PUBLIC_PORTAL_URL,
    SOURCE,
    createSubexScraper,
  } = await loadSubexModule()

  assert.equal(COMPANY_NAME, 'Subex')
  assert.equal(SOURCE, 'subex')
  assert.equal(COMPANY_ID, 'main')
  assert.equal(DARWINBOX_ORIGIN, 'https://subex.darwinbox.in')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://www.subex.com/careers/')
  assert.equal(
    OFFICIAL_CAREERS_HANDOFF_URL,
    'https://subex.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    PUBLIC_PORTAL_URL,
    'https://subex.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )

  const scraper = createSubexScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://subex.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://subex.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('subex-001'),
    'https://subex.darwinbox.in/ms/candidatev2/main/careers/jobDetails/subex-001',
  )
})

test('run keeps Subex jobs on the hosted Darwinbox routes and filters to India jobs', async () => {
  const { createSubexScraper } = await loadSubexModule()
  const scraper = createSubexScraper({
    now: () => FIXED_SCRAPED_AT,
  })
  const requestedPages = []

  const jobs = await scraper.run({
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [
          {
            id: 'subex-001',
            title: 'Senior Product Engineer',
            department_name: 'Engineering',
            locations: 'Bangalore, Karnataka, India',
            country: 'India',
            emp_type_name: 'Full Time',
            experience: '4 - 7 Years',
            posted_on: '10-Jul-2026',
            jd: '<p>Build telecom analytics platform capabilities.</p>',
          },
          {
            id: 'subex-us-001',
            title: 'Regional Sales Director',
            department_name: 'Sales',
            locations: 'Dallas, Texas, United States',
            country: 'United States',
            emp_type_name: 'Full Time',
            experience: '10+ Years',
            posted_on: '10-Jul-2026',
            jd: '<p>Drive North America growth.</p>',
          },
        ],
        job_counts: 2,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Product Engineer',
      company: 'Subex',
      department: 'Engineering',
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      jobId: 'subex-001',
      requisitionId: null,
      sourceUrl: 'https://subex.darwinbox.in/ms/candidatev2/main/careers/jobDetails/subex-001',
      applyUrl: 'https://subex.darwinbox.in/ms/candidatev2/main/careers/jobDetails/subex-001',
      employmentType: 'Full Time',
      experienceRequired: '4 - 7 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '10-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Build telecom analytics platform capabilities.</p>',
      source: 'subex',
      link: 'https://subex.darwinbox.in/ms/candidatev2/main/careers/jobDetails/subex-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})
