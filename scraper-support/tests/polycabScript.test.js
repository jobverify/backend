import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-10T00:00:00.000Z'

const loadPolycabModule = async () => {
  try {
    return await import('../../scraper/polycab/script.js')
  } catch {
    assert.fail('Expected Polycab scraper module at ../../scraper/polycab/script.js')
  }
}

test('Polycab scraper keeps the verified official careers handoff and hosted Darwinbox routes explicit', async () => {
  const {
    COMPANY_ID,
    COMPANY_NAME,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_HANDOFF_URL,
    OFFICIAL_CAREERS_URL,
    PUBLIC_PORTAL_URL,
    SOURCE,
    createPolycabScraper,
  } = await loadPolycabModule()

  assert.equal(COMPANY_NAME, 'Polycab')
  assert.equal(SOURCE, 'polycab')
  assert.equal(COMPANY_ID, 'main')
  assert.equal(DARWINBOX_ORIGIN, 'https://polycab.darwinbox.in')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://polycab.com/life-at-polycab/careers')
  assert.equal(
    OFFICIAL_CAREERS_HANDOFF_URL,
    'https://polycab.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    PUBLIC_PORTAL_URL,
    'https://polycab.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )

  const scraper = createPolycabScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://polycab.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://polycab.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('polycab-001'),
    'https://polycab.darwinbox.in/ms/candidatev2/main/careers/jobDetails/polycab-001',
  )
})

test('run keeps Polycab jobs on the hosted Darwinbox routes and filters to India jobs', async () => {
  const { createPolycabScraper } = await loadPolycabModule()
  const scraper = createPolycabScraper({
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
            id: 'polycab-001',
            title: 'Engineer - Manufacturing Excellence',
            department_name: 'Manufacturing',
            locations: 'Halol, Gujarat, India',
            country: 'India',
            emp_type_name: 'Full Time',
            experience: '3 - 6 Years',
            posted_on: '10-Jul-2026',
            jd: '<p>Drive process improvement and line productivity.</p>',
          },
          {
            id: 'polycab-us-001',
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
      title: 'Engineer - Manufacturing Excellence',
      company: 'Polycab',
      department: 'Manufacturing',
      location: 'Halol, Gujarat, India',
      city: 'Halol',
      jobId: 'polycab-001',
      requisitionId: null,
      sourceUrl: 'https://polycab.darwinbox.in/ms/candidatev2/main/careers/jobDetails/polycab-001',
      applyUrl: 'https://polycab.darwinbox.in/ms/candidatev2/main/careers/jobDetails/polycab-001',
      employmentType: 'Full Time',
      experienceRequired: '3 - 6 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '10-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Drive process improvement and line productivity.</p>',
      source: 'polycab',
      link: 'https://polycab.darwinbox.in/ms/candidatev2/main/careers/jobDetails/polycab-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})
