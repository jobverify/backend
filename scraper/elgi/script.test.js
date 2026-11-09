import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const officialCareersHtml = `
  <!doctype html>
  <html lang="en-IN">
    <head>
      <title>Careers in ELGi</title>
    </head>
    <body>
      <section class="hero">
        <div class="deming-title">WE'RE ALWAYS BETTER. <br /> AND THAT'S A PROMISE</div>
      </section>
      <section>
        <div class="main-title text-center">ARE YOU RIGHT FOR US?</div>
        <a href="https://elgi.darwinbox.in/ms/candidate/a61e65404e890b/careers" class="explore-jobs-btn" target="_blank">EXPLORE OUR JOBS</a>
      </section>
    </body>
  </html>
`

test('ELGi scraper pins the verified official careers page and Darwinbox public handoff', async () => {
  const elgi = await loadModule()
  assert.ok(elgi, 'ELGi scraper module should load')

  const {
    DARWINBOX_COMPANY_ID,
    DARWINBOX_CAREERS_URL,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_URL,
    OFFICIAL_PAGE_TITLE,
    extractDarwinboxCareersUrl,
    hasOfficialElgiCareersSignals,
  } = elgi

  assert.equal(OFFICIAL_CAREERS_URL, 'https://www.elgi.com/careers/')
  assert.equal(OFFICIAL_PAGE_TITLE, 'Careers in ELGi')
  assert.equal(DARWINBOX_ORIGIN, 'https://elgi.darwinbox.in')
  assert.equal(DARWINBOX_COMPANY_ID, 'a61e65404e890b')
  assert.equal(
    DARWINBOX_CAREERS_URL,
    'https://elgi.darwinbox.in/ms/candidate/a61e65404e890b/careers',
  )
  assert.equal(hasOfficialElgiCareersSignals(officialCareersHtml), true)
  assert.equal(
    extractDarwinboxCareersUrl(officialCareersHtml),
    'https://elgi.darwinbox.in/ms/candidate/a61e65404e890b/careers',
  )
})

test('ELGi scraper validates the official page then decorates Darwinbox India jobs', async () => {
  const elgi = await loadModule()
  assert.ok(elgi, 'ELGi scraper module should load')

  const { DARWINBOX_CAREERS_URL, OFFICIAL_CAREERS_URL, createElgiScraper } = elgi

  const requestedUrls = []
  const requestedPages = []

  const jobs = await createElgiScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, OFFICIAL_CAREERS_URL)
      return officialCareersHtml
    },
    fetchListingPage: async ({ page, pageSize, companyId }) => {
      requestedPages.push({ page, pageSize, companyId })

      return {
        data: [
          {
            id: 'job-001',
            title: 'Senior Engineer',
            department_name: 'Engineering',
            locations: 'Coimbatore, Tamil Nadu, India',
            country: 'India',
            emp_type_name: 'Full Time',
            experience: '5 - 8 Years',
            posted_on: '08-Jul-2026',
            jd: '<p>Build compressor systems</p>',
          },
          {
            id: 'job-us-001',
            title: 'Sales Manager',
            department_name: 'Sales',
            locations: 'Houston, Texas, United States',
            country: 'United States',
            emp_type_name: 'Full Time',
            experience: '8 - 10 Years',
            posted_on: '07-Jul-2026',
            jd: '<p>Drive US growth</p>',
          },
        ],
        job_counts: 2,
      }
    },
  })

  assert.deepEqual(requestedUrls, [OFFICIAL_CAREERS_URL])
  assert.deepEqual(requestedPages, [{
    page: 1,
    pageSize: 10,
    companyId: 'a61e65404e890b',
  }])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Engineer')
  assert.equal(jobs[0].company, 'ELGi')
  assert.equal(jobs[0].location, 'Coimbatore, Tamil Nadu, India')
  assert.equal(jobs[0].city, 'Coimbatore')
  assert.equal(
    jobs[0].sourceUrl,
    'https://elgi.darwinbox.in/ms/candidatev2/a61e65404e890b/careers/jobDetails/job-001',
  )
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.equal(jobs[0].source, 'elgi')
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
  assert.equal(DARWINBOX_CAREERS_URL, 'https://elgi.darwinbox.in/ms/candidate/a61e65404e890b/careers')
})

test('ELGi scraper seeds the public Darwinbox shell before posting to the verified listing API', async () => {
  const elgi = await loadModule()
  assert.ok(elgi, 'ELGi scraper module should load')

  const requests = []
  const jobs = await elgi.createElgiScraper({
    maxJobs: 1,
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options })

      if ((options.method || 'GET') === 'GET') {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/html' : null),
            getSetCookie: () => [],
          },
          text: async () => '<!doctype html><html><body>ELGI Group - </body></html>',
        }
      }

      return {
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json',
          getSetCookie: () => [],
        },
        json: async () => ({
          status: 'success',
          job_counts: 1,
          data: [{
            id: 'job-api-001',
            title: 'Engineer - Electrical',
            department_name: 'Engineering',
            locations: 'Coimbatore, Tamil Nadu, India',
            country: 'India',
            emp_type_name: 'Full Time',
            experience: '2 - 5 Years',
            posted_on: '18-Jul-2026',
            jd: '<p>Build electrical systems</p>',
          }],
        }),
      }
    },
  }).run({
    maxPages: 1,
    fetchText: async () => officialCareersHtml,
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'job-api-001')
  assert.equal(requests.length, 2)
  assert.equal(requests[0].url, elgi.DARWINBOX_PUBLIC_ALL_JOBS_URL)
  assert.equal(requests[0].options.method, 'GET')
  assert.equal(requests[1].url, elgi.DARWINBOX_LISTING_API_URL)
  assert.equal(requests[1].options.method, 'POST')
  assert.equal(requests[1].options.headers.Origin, elgi.DARWINBOX_ORIGIN)
  assert.equal(requests[1].options.headers.Referer, elgi.DARWINBOX_PUBLIC_ALL_JOBS_URL)
})

test('ELGi scraper rejects an official careers page that no longer matches the verified public surface', async () => {
  const elgi = await loadModule()
  assert.ok(elgi, 'ELGi scraper module should load')

  await assert.rejects(
    elgi.createElgiScraper().run({
      fetchText: async () => '<html><head><title>Careers</title></head><body>Open roles</body></html>',
      fetchListingPage: async () => ({ data: [], job_counts: 0 }),
    }),
    /verified official careers page/i,
  )
})
