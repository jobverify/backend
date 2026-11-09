import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>HealthifyMe - Tech, Nutritionists & Fitness Trainer Jobs</title>
  </head>
  <body>
    <section>
      <h1>Work at HealthifyMe</h1>
      <p>Interested in working with us? Check out the openings and see if you've got what it takes.</p>
      <a href="https://healthify.darwinbox.in/ms/candidate/careers">VIEW OPENINGS</a>
    </section>
  </body>
</html>
`

const listingPayload = {
  job_counts: 2,
  data: [
    {
      id: 'hm-001',
      title: 'Backend Engineer',
      department_name: 'Technology',
      locations: 'Bengaluru, Karnataka, India',
      country: 'India',
      emp_type_name: 'Full Time',
      experience: '3 - 5 Years',
      posted_on: '16-Jul-2026',
      jd: '<p>Build consumer health products.</p>',
    },
    {
      id: 'hm-usa-001',
      title: 'US Growth Lead',
      department_name: 'Growth',
      locations: 'New York, New York, United States',
      country: 'United States',
      emp_type_name: 'Full Time',
      experience: '5 - 8 Years',
      posted_on: '16-Jul-2026',
      jd: '<p>Ignore non-India role.</p>',
    },
  ],
}

const loadHealthifyMeModule = async () => {
  try {
    return await import('../../scraper/healthifyme/script.js')
  } catch {
    assert.fail('Expected HealthifyMe scraper module at ../../scraper/healthifyme/script.js')
  }
}

test('HealthifyMe pins the verified official careers handoff before Darwinbox scraping begins', async () => {
  const healthifyMe = await loadHealthifyMeModule()

  assert.equal(healthifyMe.SOURCE, 'healthifyme')
  assert.equal(healthifyMe.COMPANY_NAME, 'HealthifyMe')
  assert.equal(healthifyMe.DARWINBOX_COMPANY_ID, 'main')
  assert.equal(healthifyMe.DARWINBOX_ORIGIN, 'https://healthify.darwinbox.in')
  assert.equal(healthifyMe.OFFICIAL_CAREERS_URL, 'https://www.healthifyme.com/careers/')
  assert.equal(
    healthifyMe.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://healthify.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    healthifyMe.PUBLIC_PORTAL_URL,
    'https://healthify.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    healthifyMe.extractOfficialDarwinboxUrl(officialCareersHtml),
    healthifyMe.OFFICIAL_CAREERS_HANDOFF_URL,
  )
  assert.equal(healthifyMe.hasOfficialHealthifyMeCareersSignals(officialCareersHtml), true)
  assert.equal(
    healthifyMe.hasOfficialHealthifyMeCareersSignals(
      officialCareersHtml.replace(
        'https://healthify.darwinbox.in/ms/candidate/careers',
        'https://example.com/jobs',
      ),
    ),
    false,
  )
})

test('HealthifyMe run validates the official careers page before mapping India Darwinbox jobs', async () => {
  const { createHealthifyMeScraper } = await loadHealthifyMeModule()
  const requestedPages = []
  const scraper = createHealthifyMeScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  const jobs = await scraper.run({
    fetchText: async () => officialCareersHtml,
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)
      return listingPayload
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.deepEqual(jobs, [
    {
      title: 'Backend Engineer',
      company: 'HealthifyMe',
      department: 'Technology',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      jobId: 'hm-001',
      requisitionId: null,
      sourceUrl: 'https://healthify.darwinbox.in/ms/candidatev2/main/careers/jobDetails/hm-001',
      applyUrl: 'https://healthify.darwinbox.in/ms/candidatev2/main/careers/jobDetails/hm-001',
      employmentType: 'Full Time',
      experienceRequired: '3 - 5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '16-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Build consumer health products.</p>',
      source: 'healthifyme',
      link: 'https://healthify.darwinbox.in/ms/candidatev2/main/careers/jobDetails/hm-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('HealthifyMe fails closed when the verified official careers handoff drifts', async () => {
  const { createHealthifyMeScraper } = await loadHealthifyMeModule()
  const scraper = createHealthifyMeScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async () => officialCareersHtml.replace(
        'https://healthify.darwinbox.in/ms/candidate/careers',
        'https://example.com/jobs',
      ),
      fetchListingPage: async () => listingPayload,
    }),
    /verified official careers page/i,
  )
})
