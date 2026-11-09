import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-05T11:30:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <main>
      <h1>An enGenious career, rooted in India.</h1>
      <h2>Our Employee Value Proposition</h2>
      <h2>CULTURE WE ARE BUILDING TOGETHER</h2>
      <a href="https://tdh.darwinbox.in/ms/candidate/careers">CLICK HERE TO JOIN US</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/thryvedigital/script.js')
  } catch {
    assert.fail('Expected Thryve Digital scraper module at ../../scraper/thryvedigital/script.js')
  }
}

test('Thryve Digital helpers stay pinned to the verified first-party Darwinbox handoff from Wednesday, August 5, 2026', async () => {
  const thryveDigital = await loadModule()

  assert.equal(thryveDigital.SOURCE, 'thryvedigital')
  assert.equal(thryveDigital.COMPANY, 'Thryve Digital')
  assert.equal(thryveDigital.HOMEPAGE_URL, 'https://www.goengen.in/')
  assert.equal(thryveDigital.OFFICIAL_CAREERS_URL, 'https://www.goengen.in/careers')
  assert.equal(
    thryveDigital.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://tdh.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(thryveDigital.DARWINBOX_ORIGIN, 'https://tdh.darwinbox.in')
  assert.equal(
    thryveDigital.PUBLIC_PORTAL_URL,
    'https://tdh.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(thryveDigital.VERIFIED_ON, '2026-08-05')
  assert.match(thryveDigital.VERIFIED_SURFACE_SUMMARY, /goengen\.in\/careers/i)
  assert.equal(
    thryveDigital.extractOfficialDarwinboxUrl(officialCareersHtml),
    thryveDigital.OFFICIAL_CAREERS_HANDOFF_URL,
  )
  assert.equal(thryveDigital.hasOfficialThryveDigitalCareersSignals(officialCareersHtml), true)
})

test('Thryve Digital run validates the first-party careers page before delegating to the Darwinbox India listing contract', async () => {
  const thryveDigital = await loadModule()
  const requestedPages = []
  const requestedTextUrls = []

  const jobs = await thryveDigital.createThryveDigitalScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === thryveDigital.OFFICIAL_CAREERS_URL) {
        return officialCareersHtml
      }

      throw new Error(`Unexpected Thryve Digital text URL: ${url}`)
    },
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [
          {
            id: 'thryve-001',
            title: 'Senior Data Analyst',
            department_name: 'Analytics',
            locations: 'Hyderabad, Telangana, India',
            country: 'India',
            emp_type_name: 'Full Time',
            experience: '4 - 7 Years',
            posted_on: '05-Aug-2026',
            jd: '<p>Analyze healthcare operations data and build actionable insights.</p>',
          },
          {
            id: 'thryve-us-001',
            title: 'US Claims Specialist',
            department_name: 'Claims',
            locations: 'Pittsburgh, Pennsylvania, United States',
            country: 'United States',
            emp_type_name: 'Full Time',
            experience: '3 - 5 Years',
            posted_on: '05-Aug-2026',
            jd: '<p>Support US-only claims operations.</p>',
          },
        ],
        job_counts: 2,
      }
    },
  })

  assert.deepEqual(requestedTextUrls, [thryveDigital.OFFICIAL_CAREERS_URL])
  assert.deepEqual(requestedPages, [1])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Data Analyst',
      company: 'Thryve Digital',
      department: 'Analytics',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      jobId: 'thryve-001',
      requisitionId: null,
      sourceUrl: 'https://tdh.darwinbox.in/ms/candidatev2/main/careers/jobDetails/thryve-001',
      applyUrl: 'https://tdh.darwinbox.in/ms/candidatev2/main/careers/jobDetails/thryve-001',
      employmentType: 'Full Time',
      experienceRequired: '4 - 7 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '05-Aug-2026',
      closingDate: null,
      jobDescription: '<p>Analyze healthcare operations data and build actionable insights.</p>',
      source: 'thryvedigital',
      link: 'https://tdh.darwinbox.in/ms/candidatev2/main/careers/jobDetails/thryve-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Thryve Digital fails closed when the first-party careers handoff drifts', async () => {
  const thryveDigital = await loadModule()

  await assert.rejects(
    thryveDigital.createThryveDigitalScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified official careers page/i,
  )
})
