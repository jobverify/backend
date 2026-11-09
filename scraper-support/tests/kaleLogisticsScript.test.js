import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T12:30:00.000Z'

const officialCareersHtml = `
  <html lang="en">
    <head>
      <title>Careers | Kale Logistics</title>
    </head>
    <body>
      <section>
        <h1>Careers at Kalé</h1>
        <h2>Build technology that moves global trade forward</h2>
        <a href="https://kale.darwinbox.in/ms/candidatev2/main/careers/home" target="_blank" rel="noreferrer noopener">View Opportunities</a>
      </section>
      <section>
        <p>Explore opportunities to join the team and help shape the future of digital trade infrastructure.</p>
      </section>
    </body>
  </html>
`

const listingPayload = {
  job_counts: 2,
  data: [
    {
      id: 'a69fad2026d610',
      title: 'Product Manager',
      department_name: 'Product Management',
      locations: 'Multiple Locations',
      country: 'India',
      emp_type_name: 'Full Time',
      experience: '3 - 5 Years',
      posted_on: '06-May-2026',
      jd: '<p>Lead product strategy for global logistics workflows.</p>',
    },
    {
      id: 'us-001',
      title: 'US Program Manager',
      department_name: 'Program Management',
      locations: 'Dallas, Texas, United States',
      country: 'United States',
      emp_type_name: 'Full Time',
      experience: '5 - 7 Years',
      posted_on: '15-Jul-2026',
      jd: '<p>Ignore this non-India role.</p>',
    },
  ],
}

const loadKaleLogisticsModule = async () => {
  try {
    return await import('../../scraper/kalelogistics/script.js')
  } catch {
    assert.fail('Expected Kale Logistics scraper module at ../../scraper/kalelogistics/script.js')
  }
}

const replaceOfficialHandoffUrl = (html, replacement) =>
  html.replace(/https:\/\/kale\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/home/g, replacement)

test('Kale Logistics keeps the verified first-party Darwinbox handoff explicit and fails closed on drift', async () => {
  const kaleLogistics = await loadKaleLogisticsModule()

  assert.equal(kaleLogistics.COMPANY_NAME, 'Kale Logistics')
  assert.equal(kaleLogistics.SOURCE, 'kalelogistics')
  assert.equal(kaleLogistics.DARWINBOX_COMPANY_ID, 'main')
  assert.equal(kaleLogistics.DARWINBOX_ORIGIN, 'https://kale.darwinbox.in')
  assert.equal(kaleLogistics.OFFICIAL_CAREERS_URL, 'https://www.kalelogistics.com/careers')
  assert.equal(
    kaleLogistics.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://kale.darwinbox.in/ms/candidatev2/main/careers/home',
  )
  assert.equal(
    kaleLogistics.PUBLIC_PORTAL_URL,
    'https://kale.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(kaleLogistics.extractOfficialDarwinboxUrl(officialCareersHtml), kaleLogistics.OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(kaleLogistics.hasOfficialKaleLogisticsCareersSignals(officialCareersHtml), true)
  assert.equal(
    kaleLogistics.hasOfficialKaleLogisticsCareersSignals(
      replaceOfficialHandoffUrl(officialCareersHtml, 'https://example.com/ms/candidatev2/main/careers/home'),
    ),
    false,
  )

  await assert.rejects(
    kaleLogistics.createKaleLogisticsScraper({
      now: () => FIXED_SCRAPED_AT,
    }).run({
      fetchText: async () => replaceOfficialHandoffUrl(
        officialCareersHtml,
        'https://example.com/ms/candidatev2/main/careers/home',
      ),
      fetchListingPage: async () => listingPayload,
    }),
    /verified official careers page no longer matches the verified public surface/i,
  )
})

test('run maps verified Kale Logistics Darwinbox listings into Jobverify jobs and keeps only India roles', async () => {
  const kaleLogistics = await loadKaleLogisticsModule()
  const scraper = kaleLogistics.createKaleLogisticsScraper({
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
      title: 'Product Manager',
      company: 'Kale Logistics',
      department: 'Product Management',
      location: 'Multiple Locations',
      city: 'Multiple Locations',
      jobId: 'a69fad2026d610',
      requisitionId: null,
      sourceUrl: 'https://kale.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69fad2026d610',
      applyUrl: 'https://kale.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69fad2026d610',
      employmentType: 'Full Time',
      experienceRequired: '3 - 5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '06-May-2026',
      closingDate: null,
      jobDescription: '<p>Lead product strategy for global logistics workflows.</p>',
      source: 'kalelogistics',
      link: 'https://kale.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69fad2026d610',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})
