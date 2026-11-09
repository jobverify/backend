import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_ABOUT_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us</title>
  </head>
  <body>
    <main>
      <h1>About Us</h1>
      <p>Shoppers Stop is home to a multitude of leading international and national luxury, prestige and premium brands.</p>
      <section>
        <h2>Join our team</h2>
        <p>Want to be a part of our super creative and highly motivated team?</p>
        <p>
          You can apply here at
          <a class="career">https://ss-people.darwinbox.in/ms/candidate/careers</a>
        </p>
      </section>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/shoppersstop/script.js')
  } catch {
    assert.fail('Expected Shoppers Stop scraper module at ../../scraper/shoppersstop/script.js')
  }
}

test('Shoppers Stop pins the verified first-party about page and Darwinbox tenant contract', async () => {
  const shoppersStop = await loadModule()
  const scraper = shoppersStop.createShoppersStopScraper()

  assert.equal(shoppersStop.SOURCE, 'shoppersstop')
  assert.equal(shoppersStop.COMPANY, 'Shoppers Stop')
  assert.equal(shoppersStop.OFFICIAL_BRAND_NAME, 'Shoppers Stop Limited')
  assert.equal(shoppersStop.VERIFIED_ON, '2026-08-14')
  assert.equal(shoppersStop.HOMEPAGE_URL, 'https://www.shoppersstop.com/')
  assert.equal(shoppersStop.ABOUT_PAGE_URL, 'https://www.shoppersstop.com/miscs/aboutus')
  assert.equal(
    shoppersStop.DARWINBOX_HANDOFF_URL,
    'https://ss-people.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    shoppersStop.extractOfficialDarwinboxUrl(OFFICIAL_ABOUT_PAGE_HTML),
    'https://ss-people.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(shoppersStop.hasOfficialShoppersStopCareersSignals(OFFICIAL_ABOUT_PAGE_HTML), true)
  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://ss-people.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://ss-people.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('a671f4380a50d9'),
    'https://ss-people.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a671f4380a50d9',
  )
})

test('Shoppers Stop run validates the official about page and keeps only India Darwinbox jobs', async () => {
  const shoppersStop = await loadModule()
  const requestedPages = []

  const jobs = await shoppersStop.createShoppersStopScraper().run({
    fetchText: async (url) => {
      assert.equal(url, shoppersStop.ABOUT_PAGE_URL)
      return OFFICIAL_ABOUT_PAGE_HTML
    },
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      if (page !== 1) {
        throw new Error(`Unexpected page: ${page}`)
      }

      return {
        data: [
          {
            id: 'a671f4380a50d9',
            title: 'Customer Care Associate (SSL - Bangalore Airport)',
            department_name: 'Retail Store Operations',
            locations: 'Bangalore, Karnataka, India',
            country: 'India',
            emp_type_name: 'Full-time',
            experience: '0 - 2 Years',
            posted_on: '17-Jul-2026',
            jd: '<p>Deliver premium in-store customer service for Shoppers Stop.</p>',
          },
          {
            id: 'us-only-role',
            title: 'Regional Visual Merchandiser',
            department_name: 'Retail',
            locations: 'Dubai, United Arab Emirates',
            country: 'United Arab Emirates',
            emp_type_name: 'Full-time',
            experience: '5 - 8 Years',
            posted_on: '17-Jul-2026',
            jd: '<p>Non-India role.</p>',
          },
        ],
        job_counts: 2,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.deepEqual(jobs, [
    {
      title: 'Customer Care Associate (SSL - Bangalore Airport)',
      company: 'Shoppers Stop',
      department: 'Retail Store Operations',
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      jobId: 'a671f4380a50d9',
      requisitionId: null,
      sourceUrl: 'https://ss-people.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a671f4380a50d9',
      applyUrl: 'https://ss-people.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a671f4380a50d9',
      employmentType: 'Full-time',
      experienceRequired: '0 - 2 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '17-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Deliver premium in-store customer service for Shoppers Stop.</p>',
      source: 'shoppersstop',
      link: 'https://ss-people.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a671f4380a50d9',
      scrapedAt: jobs[0].scrapedAt,
    },
  ])
})

test('Shoppers Stop fails closed when the verified about-page handoff changes materially', async () => {
  const shoppersStop = await loadModule()

  await assert.rejects(
    shoppersStop.createShoppersStopScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchListingPage: async () => ({
        data: [],
        job_counts: 0,
      }),
    }),
    /shoppers stop verified official about page/i,
  )
})
