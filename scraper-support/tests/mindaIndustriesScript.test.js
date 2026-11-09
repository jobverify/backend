import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-19T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Uno Minda Careers</title>
  </head>
  <body>
    <section class="join-community">
      <h2>Join our talent community</h2>
      <p>Drop your resume at <a href="mailto:corphr@unominda.com">corphr@unominda.com</a></p>
      <div class="join-btn">
        <a href="https://inspire-unominda.darwinbox.in/ms/candidatev2/main/careers/home">Join Our Team</a>
      </div>
    </section>
  </body>
</html>
`

const listingPayload = {
  status: 'success',
  job_counts: 2,
  data: [
    {
      id: 'a6a5b3d4ac6bc0',
      title: 'Assistant Manager',
      designation_display_name: '',
      department_name: 'Money',
      locations: 'Manesar, Haryana, India',
      officelocation_show_arr: 'Corporate Office, Manesar, Haryana, India (1001)',
      officelocations_area: ['Corporate Office, Manesar, Haryana, India'],
      country: 'India',
      emp_type_name: 'PERMANENT',
      experience: '1 - 3 Years',
      posted_on: '18-Jul-2026',
      created_on: '2026-07-18T08:46:02.000Z',
      jd: '&lt;p&gt;&lt;b&gt;Group Company:&lt;/b&gt; Uno Minda Ltd.&lt;/p&gt;',
    },
    {
      id: 'uno-us-001',
      title: 'US Finance Role',
      designation_display_name: '',
      department_name: 'Money',
      locations: 'Chicago, Illinois, United States',
      country: 'United States',
      emp_type_name: 'PERMANENT',
      experience: '1 - 3 Years',
      posted_on: '18-Jul-2026',
      created_on: '2026-07-18T08:46:02.000Z',
      jd: '&lt;p&gt;Ignore non-India role.&lt;/p&gt;',
    },
  ],
}

const loadMindaIndustriesModule = async () => {
  try {
    return await import('../../scraper/mindaindustries/script.js')
  } catch {
    assert.fail('Expected Minda Industries scraper module at ../../scraper/mindaindustries/script.js')
  }
}

test('Minda Industries targets the verified Uno Minda Darwinbox tenant and POST listing contract', async () => {
  const mindaIndustries = await loadMindaIndustriesModule()
  const scraper = mindaIndustries.createMindaIndustriesScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  assert.equal(mindaIndustries.SOURCE, 'mindaindustries')
  assert.equal(mindaIndustries.COMPANY_NAME, 'Minda Industries')
  assert.equal(
    mindaIndustries.OFFICIAL_BRAND_NAME,
    'Uno Minda Limited (formerly Minda Industries Limited)',
  )
  assert.equal(mindaIndustries.CAREERS_URL, 'https://www.unominda.com/career')
  assert.equal(
    mindaIndustries.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://inspire-unominda.darwinbox.in/ms/candidatev2/main/careers/home',
  )
  assert.equal(mindaIndustries.DARWINBOX_ORIGIN, 'https://inspire-unominda.darwinbox.in')
  assert.equal(mindaIndustries.DARWINBOX_COMPANY_ID, 'main')
  assert.equal(
    mindaIndustries.PUBLIC_ALL_JOBS_URL,
    'https://inspire-unominda.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    mindaIndustries.PUBLIC_LISTING_API_URL,
    'https://inspire-unominda.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(mindaIndustries.VERIFIED_ON, '2026-07-19')
  assert.equal(mindaIndustries.hasVerifiedCareersPageSignal(officialCareersHtml), true)
  assert.equal(mindaIndustries.extractApplicationContact(officialCareersHtml), 'corphr@unominda.com')
  assert.equal(scraper.buildCareersPageUrl(), mindaIndustries.PUBLIC_ALL_JOBS_URL)
  assert.equal(scraper.buildListingApiUrl(), mindaIndustries.PUBLIC_LISTING_API_URL)
  assert.equal(
    scraper.buildJobDetailUrl('a6a5b3d4ac6bc0'),
    'https://inspire-unominda.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a5b3d4ac6bc0',
  )
})

test('Minda Industries listing fetcher posts the Darwinbox request body instead of using the failing GET sentinel', async () => {
  const mindaIndustries = await loadMindaIndustriesModule()
  const requests = []

  const payload = await mindaIndustries.fetchMindaIndustriesListingPage({
    page: 2,
    pageSize: 20,
    fetchJson: async (url, options) => {
      requests.push({ url, options })
      return listingPayload
    },
  })

  assert.equal(payload, listingPayload)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, mindaIndustries.PUBLIC_LISTING_API_URL)
  assert.equal(requests[0].options.method, 'POST')
  assert.equal(requests[0].options.headers.Origin, mindaIndustries.DARWINBOX_ORIGIN)
  assert.equal(requests[0].options.headers.Referer, mindaIndustries.PUBLIC_ALL_JOBS_URL)
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    companyId: 'main',
    sort_option: 'new',
    limit: 20,
    page: 2,
  })
})

test('Minda Industries verifies the official Uno Minda page then maps Darwinbox India listings', async () => {
  const mindaIndustries = await loadMindaIndustriesModule()
  const scraper = mindaIndustries.createMindaIndustriesScraper({
    now: () => FIXED_SCRAPED_AT,
  })
  const requestedTexts = []
  const requestedPages = []

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === mindaIndustries.CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected Minda Industries text URL: ${url}`)
    },
    fetchJson: async () => {
      throw new Error('Minda Industries should use the Darwinbox POST listing fetcher, not a GET JSON sentinel')
    },
    fetchListingPage: async ({ page, pageSize, companyId }) => {
      requestedPages.push({ page, pageSize, companyId })
      return listingPayload
    },
  })

  assert.deepEqual(requestedTexts, [mindaIndustries.CAREERS_URL])
  assert.deepEqual(requestedPages, [{ page: 1, pageSize: 10, companyId: 'main' }])
  assert.deepEqual(jobs, [
    {
      title: 'Assistant Manager',
      company: 'Minda Industries',
      department: 'Money',
      location: 'Manesar, Haryana, India',
      city: 'Manesar',
      jobId: 'a6a5b3d4ac6bc0',
      requisitionId: null,
      sourceUrl: 'https://inspire-unominda.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a5b3d4ac6bc0',
      applyUrl: 'https://inspire-unominda.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a5b3d4ac6bc0',
      employmentType: 'PERMANENT',
      experienceRequired: '1 - 3 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '18-Jul-2026',
      closingDate: null,
      jobDescription: '<p><b>Group Company:</b> Uno Minda Ltd.</p>',
      source: 'mindaindustries',
      link: 'https://inspire-unominda.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a5b3d4ac6bc0',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Minda Industries fails closed before the listing API when the official page drifts', async () => {
  const mindaIndustries = await loadMindaIndustriesModule()
  const scraper = mindaIndustries.createMindaIndustriesScraper()
  const requestedPages = []

  await assert.rejects(
    scraper.run({
      fetchText: async () => officialCareersHtml.replace(
        'https://inspire-unominda.darwinbox.in/ms/candidatev2/main/careers/home',
        'https://example.com/jobs',
      ),
      fetchListingPage: async ({ page }) => {
        requestedPages.push(page)
        return listingPayload
      },
    }),
    /verified careers page/i,
  )

  assert.deepEqual(requestedPages, [])
})
