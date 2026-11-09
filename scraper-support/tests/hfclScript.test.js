import assert from 'node:assert/strict'
import test from 'node:test'

const loadHFCLModule = async () => {
  try {
    return await import('../../scraper/hfcl/script.js')
  } catch {
    assert.fail('Expected HFCL scraper module at ../../scraper/hfcl/script.js')
  }
}

const officialCareersHtml = `
<html>
  <head>
    <title>HFCL Careers</title>
  </head>
  <body>
    <h1>Careers at HFCL</h1>
    <a href="https://hifi.darwinbox.in/ms/candidatev2/604761d854807/careers/home">Browse jobs</a>
  </body>
</html>
`

test('createHFCLScraper targets the verified HFCL Darwinbox tenant', async () => {
  const hfcl = await loadHFCLModule()
  const scraper = hfcl.createHFCLScraper()

  assert.equal(hfcl.HFCL_OFFICIAL_CAREERS_URL, 'https://www.hfcl.com/company/careers')
  assert.equal(
    hfcl.HFCL_DARWINBOX_HOME_URL,
    'https://hifi.darwinbox.in/ms/candidatev2/604761d854807/careers/home',
  )
  assert.equal(
    hfcl.extractOfficialDarwinboxUrl(officialCareersHtml),
    'https://hifi.darwinbox.in/ms/candidatev2/604761d854807/careers/home',
  )
  assert.equal(hfcl.hasOfficialHfclCareersSignals(officialCareersHtml), true)
  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://hifi.darwinbox.in/ms/candidatev2/604761d854807/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://hifi.darwinbox.in/ms/candidateapi/job/alljobs?companyId=604761d854807',
  )
  assert.equal(
    scraper.buildJobDetailUrl('a67e64cbedc7db'),
    'https://hifi.darwinbox.in/ms/candidatev2/604761d854807/careers/jobDetails/a67e64cbedc7db',
  )
})

test('run keeps HFCL jobs on the public Darwinbox candidate routes and filters non-India results', async () => {
  const hfcl = await loadHFCLModule()
  const scraper = hfcl.createHFCLScraper()
  const requestedPages = []

  const jobs = await scraper.run({
    fetchText: async (url) => {
      assert.equal(url, 'https://www.hfcl.com/company/careers')
      return officialCareersHtml
    },
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      if (page !== 1) {
        throw new Error(`Unexpected page: ${page}`)
      }

      return {
        status: 'success',
        data: [
          {
            id: 'a67e64cbedc7db',
            title: 'Software Engineer',
            department_name: 'Technology',
            locations: 'Bengaluru, Karnataka, India',
            country: 'India',
            emp_type_name: 'Full-time',
            experience: '2 - 5 Years',
            posted_on: '15-Jul-2026',
            jd: '<p>Build carrier-grade networking software for HFCL products.</p>',
          },
          {
            id: 'darwinbox-us-role',
            title: 'Regional Sales Director',
            department_name: 'Sales',
            locations: 'Dallas, Texas, United States',
            country: 'United States',
            emp_type_name: 'Full-time',
            experience: '10 - 12 Years',
            posted_on: '15-Jul-2026',
            jd: '<p>Lead the North America sales team.</p>',
          },
        ],
        job_counts: 2,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.deepEqual(jobs, [
    {
      title: 'Software Engineer',
      company: 'HFCL',
      department: 'Technology',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      jobId: 'a67e64cbedc7db',
      requisitionId: null,
      sourceUrl: 'https://hifi.darwinbox.in/ms/candidatev2/604761d854807/careers/jobDetails/a67e64cbedc7db',
      applyUrl: 'https://hifi.darwinbox.in/ms/candidatev2/604761d854807/careers/jobDetails/a67e64cbedc7db',
      employmentType: 'Full-time',
      experienceRequired: '2 - 5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '15-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Build carrier-grade networking software for HFCL products.</p>',
      source: 'hfcl',
      link: 'https://hifi.darwinbox.in/ms/candidatev2/604761d854807/careers/jobDetails/a67e64cbedc7db',
      scrapedAt: jobs[0].scrapedAt,
    },
  ])
})

test('run fails closed when the verified HFCL careers page no longer points to the public Darwinbox tenant', async () => {
  const hfcl = await loadHFCLModule()
  const scraper = hfcl.createHFCLScraper()

  await assert.rejects(
    scraper.run({
      fetchText: async () => '<html><body><h1>HFCL Careers</h1><a href="/jobs">Jobs</a></body></html>',
      fetchListingPage: async () => ({
        status: 'success',
        data: [],
        job_counts: 0,
      }),
    }),
    /hfcl verified official careers page no longer matches/i,
  )
})
