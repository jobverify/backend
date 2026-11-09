import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-14T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Brigade Group</title>
    <link rel="canonical" href="https://www.brigadegroup.com/careers" />
  </head>
  <body>
    <main>
      <h1>Join Our Team</h1>
      <section>
        <h2>Current Openings</h2>
        <a href="https://brigadegroup.darwinbox.in/ms/candidate/careers" target="_blank">Join Our Team</a>
      </section>
    </main>
  </body>
</html>
`

const listingPayload = {
  job_counts: '2',
  data: [
    {
      id: 'brigadegroup-001',
      title: 'Manager - Interior Design',
      department_name: 'Design',
      locations: 'Bengaluru, Karnataka, India',
      country: 'India',
      emp_type_name: 'Full Time',
      experience: '8 - 12 Years',
      posted_on: '14-Jul-2026',
      jd: '<p>Lead interior design execution for residential projects.</p>',
    },
    {
      id: 'brigadegroup-002',
      title: 'Associate Manager - Leasing',
      department_name: 'Commercial',
      locations: 'Remote, India',
      country: 'India',
      emp_type_name: 'Full Time',
      experience: '5 - 8 Years',
      posted_on: '13-Jul-2026',
      jd: '<p>Drive leasing operations and portfolio reporting.</p>',
    },
  ],
}

const loadBrigadeGroupModule = async () => {
  try {
    return await import('../../scraper/brigadegroup/script.js')
  } catch {
    assert.fail('Expected Brigade Group scraper module at ../../scraper/brigadegroup/script.js')
  }
}

test('Brigade Group scraper keeps the verified official careers handoff explicit and fails closed on drift', async () => {
  const {
    COMPANY_NAME,
    DARWINBOX_COMPANY_ID,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_HANDOFF_URL,
    OFFICIAL_CAREERS_URL,
    PUBLIC_PORTAL_URL,
    SOURCE,
    createBrigadeGroupScraper,
    extractOfficialDarwinboxUrl,
    hasOfficialBrigadeGroupCareersSignals,
  } = await loadBrigadeGroupModule()

  assert.equal(COMPANY_NAME, 'Brigade Group')
  assert.equal(SOURCE, 'brigadegroup')
  assert.equal(DARWINBOX_COMPANY_ID, 'main')
  assert.equal(DARWINBOX_ORIGIN, 'https://brigadegroup.darwinbox.in')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://www.brigadegroup.com/careers')
  assert.equal(
    OFFICIAL_CAREERS_HANDOFF_URL,
    'https://brigadegroup.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    PUBLIC_PORTAL_URL,
    'https://brigadegroup.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    extractOfficialDarwinboxUrl(officialCareersHtml),
    OFFICIAL_CAREERS_HANDOFF_URL,
  )
  assert.equal(hasOfficialBrigadeGroupCareersSignals(officialCareersHtml), true)
  assert.equal(
    hasOfficialBrigadeGroupCareersSignals(
      officialCareersHtml.replace(
        'https://brigadegroup.darwinbox.in/ms/candidate/careers',
        'https://example.com/jobs',
      ),
    ),
    false,
  )

  const scraper = createBrigadeGroupScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async () =>
        officialCareersHtml.replace(
          'https://brigadegroup.darwinbox.in/ms/candidate/careers',
          'https://example.com/jobs',
        ),
      fetchListingPage: async () => listingPayload,
    }),
    /verified official careers page no longer matches the verified public surface/i,
  )
})

test('run maps verified Brigade Group Darwinbox listings into Jobverify jobs and keeps only India roles', async () => {
  const { createBrigadeGroupScraper } = await loadBrigadeGroupModule()
  const scraper = createBrigadeGroupScraper({
    now: () => FIXED_SCRAPED_AT,
  })
  const requestedPages = []

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
      title: 'Manager - Interior Design',
      company: 'Brigade Group',
      department: 'Design',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      jobId: 'brigadegroup-001',
      requisitionId: null,
      sourceUrl: 'https://brigadegroup.darwinbox.in/ms/candidatev2/main/careers/jobDetails/brigadegroup-001',
      applyUrl: 'https://brigadegroup.darwinbox.in/ms/candidatev2/main/careers/jobDetails/brigadegroup-001',
      employmentType: 'Full Time',
      experienceRequired: '8 - 12 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '14-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Lead interior design execution for residential projects.</p>',
      source: 'brigadegroup',
      link: 'https://brigadegroup.darwinbox.in/ms/candidatev2/main/careers/jobDetails/brigadegroup-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Associate Manager - Leasing',
      company: 'Brigade Group',
      department: 'Commercial',
      location: 'Remote, India',
      city: 'Remote',
      jobId: 'brigadegroup-002',
      requisitionId: null,
      sourceUrl: 'https://brigadegroup.darwinbox.in/ms/candidatev2/main/careers/jobDetails/brigadegroup-002',
      applyUrl: 'https://brigadegroup.darwinbox.in/ms/candidatev2/main/careers/jobDetails/brigadegroup-002',
      employmentType: 'Full Time',
      experienceRequired: '5 - 8 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '13-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Drive leasing operations and portfolio reporting.</p>',
      source: 'brigadegroup',
      link: 'https://brigadegroup.darwinbox.in/ms/candidatev2/main/careers/jobDetails/brigadegroup-002',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})
