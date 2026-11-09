import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T09:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Spinny Careers | Spinny.com</title>
    <link rel="canonical" href="https://www.spinny.com/careers/" />
  </head>
  <body>
    <main>
      <h2>Put your career in next gear</h2>
      <a href="https://spinzone.darwinbox.in/ms/candidate/careers">See Job Openings</a>
      <h2>Why Become a Part of Spinny</h2>
      <p>
        Every individual at Spinny is focused on countering the deeply rooted negative perceptions
        of the used car market.
      </p>
      <h2>Put your career in next gear with Spinny</h2>
      <a href="https://spinzone.darwinbox.in/ms/candidate/careers">See Job Openings</a>
      <p>or write to us at <a href="mailto:talent@spinny.com">talent@spinny.com</a></p>
    </main>
  </body>
</html>
`

const loadSpinnyModule = async () => {
  try {
    return await import('../../scraper/spinny/script.js')
  } catch {
    assert.fail('Expected Spinny scraper module at ../../scraper/spinny/script.js')
  }
}

test('Spinny helpers stay pinned to the verified first-party careers handoff from July 17, 2026', async () => {
  const spinny = await loadSpinnyModule()

  assert.equal(spinny.SOURCE, 'spinny')
  assert.equal(spinny.COMPANY, 'Spinny')
  assert.equal(spinny.OFFICIAL_CAREERS_URL, 'https://www.spinny.com/careers/')
  assert.equal(
    spinny.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://spinzone.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(spinny.DARWINBOX_ORIGIN, 'https://spinzone.darwinbox.in')
  assert.equal(spinny.PUBLIC_PORTAL_URL, 'https://spinzone.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(spinny.VERIFIED_ON, '2026-07-17')
  assert.match(spinny.VERIFIED_SURFACE_SUMMARY, /Spinny/i)
  assert.equal(
    spinny.extractOfficialDarwinboxUrl(officialCareersHtml),
    spinny.OFFICIAL_CAREERS_HANDOFF_URL,
  )
  assert.equal(spinny.hasOfficialSpinnyCareersSignals(officialCareersHtml), true)
})

test('Spinny run validates the official careers page before delegating to the Darwinbox India listing contract', async () => {
  const spinny = await loadSpinnyModule()
  const requestedPages = []
  const requestedTextUrls = []

  const jobs = await spinny.createSpinnyScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === spinny.OFFICIAL_CAREERS_URL) {
        return officialCareersHtml
      }

      throw new Error(`Unexpected Spinny text URL: ${url}`)
    },
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [
          {
            id: 'spinny-001',
            title: 'Vehicle Evaluator / Inspector',
            department_name: 'Supply',
            locations: 'Gurgaon, Haryana, India',
            country: 'India',
            emp_type_name: 'Full Time',
            experience: '1 - 3 Years',
            posted_on: '17-Jul-2026',
            jd: '<p>Inspect and evaluate used vehicles before listing.</p>',
          },
          {
            id: 'spinny-us-001',
            title: 'US Market Analyst',
            department_name: 'Strategy',
            locations: 'Austin, Texas, United States',
            country: 'United States',
            emp_type_name: 'Full Time',
            experience: '4 - 6 Years',
            posted_on: '17-Jul-2026',
            jd: '<p>Support market analysis for the United States.</p>',
          },
        ],
        job_counts: 2,
      }
    },
  })

  assert.deepEqual(requestedTextUrls, [spinny.OFFICIAL_CAREERS_URL])
  assert.deepEqual(requestedPages, [1])
  assert.deepEqual(jobs, [
    {
      title: 'Vehicle Evaluator / Inspector',
      company: 'Spinny',
      department: 'Supply',
      location: 'Gurgaon, Haryana, India',
      city: 'Gurgaon',
      jobId: 'spinny-001',
      requisitionId: null,
      sourceUrl: 'https://spinzone.darwinbox.in/ms/candidatev2/main/careers/jobDetails/spinny-001',
      applyUrl: 'https://spinzone.darwinbox.in/ms/candidatev2/main/careers/jobDetails/spinny-001',
      employmentType: 'Full Time',
      experienceRequired: '1 - 3 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '17-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Inspect and evaluate used vehicles before listing.</p>',
      source: 'spinny',
      link: 'https://spinzone.darwinbox.in/ms/candidatev2/main/careers/jobDetails/spinny-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Spinny fails closed when the first-party careers handoff drifts', async () => {
  const spinny = await loadSpinnyModule()

  await assert.rejects(
    spinny.createSpinnyScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified official careers page/i,
  )
})
