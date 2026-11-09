import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Rapido</title>
  </head>
  <body>
    <main>
      <h1>Be a part of our team.</h1>
      <p>We are so glad you want to join us in exploring a world of endless opportunities at Rapido.</p>
      <a href="https://rapido.darwinbox.in/ms/candidate/careers">
        <button class="view_jobs">
          <label>View Jobs</label>
        </button>
      </a>
      <div>Why work with us</div>
      <script id="__NEXT_DATA__" type="application/json">
        {"props":{"pageProps":{"languageJson":{"careers":{"jobsLink":"https://rapido.darwinbox.in/ms/candidate/careers"}}}}}
      </script>
    </main>
  </body>
</html>
`

const LISTING_PAYLOAD = {
  job_counts: 2,
  data: [
    {
      id: 'rapido-001',
      title: 'Senior Product Analyst',
      department_name: 'Product',
      locations: 'Bengaluru, Karnataka, India',
      country: 'India',
      emp_type_name: 'Full Time',
      experience: '3 - 5 Years',
      posted_on: '17-Jul-2026',
      jd: '<p>Own analytics for rides growth.</p>',
    },
    {
      id: 'rapido-nonindia-001',
      title: 'Regional Operations Manager',
      department_name: 'Operations',
      locations: 'Dubai, UAE',
      country: 'United Arab Emirates',
      emp_type_name: 'Full Time',
      experience: '5 - 8 Years',
      posted_on: '17-Jul-2026',
      jd: '<p>Ignore non-India role.</p>',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/rapido/script.js')
  } catch {
    assert.fail('Expected Rapido scraper module at ../../scraper/rapido/script.js')
  }
}

test('Rapido pins the verified official careers handoff before Darwinbox scraping begins', async () => {
  const rapido = await loadModule()

  assert.equal(rapido.SOURCE, 'rapido')
  assert.equal(rapido.COMPANY_NAME, 'Rapido')
  assert.equal(rapido.OFFICIAL_BRAND_NAME, 'Rapido')
  assert.equal(rapido.DARWINBOX_COMPANY_ID, 'main')
  assert.equal(rapido.DARWINBOX_ORIGIN, 'https://rapido.darwinbox.in')
  assert.equal(rapido.OFFICIAL_CAREERS_URL, 'https://www.rapido.bike/Careers')
  assert.equal(
    rapido.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://rapido.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    rapido.PUBLIC_PORTAL_URL,
    'https://rapido.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    rapido.extractOfficialDarwinboxUrl(OFFICIAL_CAREERS_HTML),
    rapido.OFFICIAL_CAREERS_HANDOFF_URL,
  )
  assert.equal(rapido.hasOfficialRapidoCareersSignals(OFFICIAL_CAREERS_HTML), true)
  assert.equal(
    rapido.hasOfficialRapidoCareersSignals(
      OFFICIAL_CAREERS_HTML.replace(
        'https://rapido.darwinbox.in/ms/candidate/careers',
        'https://example.com/jobs',
      ),
    ),
    false,
  )
})

test('Rapido run validates the official careers page before mapping India Darwinbox jobs', async () => {
  const { createRapidoScraper } = await loadModule()
  const requestedPages = []
  const scraper = createRapidoScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedPages.push(url)
      return OFFICIAL_CAREERS_HTML
    },
    fetchListingPage: async ({ page }) => {
      assert.equal(page, 1)
      return LISTING_PAYLOAD
    },
  })

  assert.deepEqual(requestedPages, ['https://www.rapido.bike/Careers'])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Product Analyst',
      company: 'Rapido',
      department: 'Product',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      jobId: 'rapido-001',
      requisitionId: null,
      sourceUrl: 'https://rapido.darwinbox.in/ms/candidatev2/main/careers/jobDetails/rapido-001',
      applyUrl: 'https://rapido.darwinbox.in/ms/candidatev2/main/careers/jobDetails/rapido-001',
      employmentType: 'Full Time',
      experienceRequired: '3 - 5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '17-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Own analytics for rides growth.</p>',
      source: 'rapido',
      link: 'https://rapido.darwinbox.in/ms/candidatev2/main/careers/jobDetails/rapido-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Rapido fails closed when the verified official careers handoff drifts', async () => {
  const { createRapidoScraper } = await loadModule()
  const scraper = createRapidoScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async () => OFFICIAL_CAREERS_HTML.replace(
        'https://rapido.darwinbox.in/ms/candidate/careers',
        'https://example.com/jobs',
      ),
      fetchListingPage: async () => LISTING_PAYLOAD,
    }),
    /verified official careers page/i,
  )
})
