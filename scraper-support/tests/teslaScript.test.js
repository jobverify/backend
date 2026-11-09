import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Tesla</title>
  </head>
  <body>
    <main>
      <h1>Build a World of Amazing Abundance</h1>
      <label>Search by Role or Department</label>
      <a href="https://www.tesla.com/careers/search/">Explore Jobs</a>
      <p>Tesla participates in the E-Verify Program.</p>
    </main>
  </body>
</html>
`

const indiaLocaleCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Tesla</title>
  </head>
  <body>
    <main>
      <h1>Build a World of Amazing Abundance</h1>
      <h2>Become Part of Our Mission</h2>
      <p>Our mission is to build a world of amazing abundance.</p>
      <a href="https://www.tesla.com/careers/search/">Explore Jobs</a>
    </main>
  </body>
</html>
`

const searchPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Tesla Careers</title>
  </head>
  <body>
    <main>
      <h1>Build your Career at Tesla</h1>
      <p>Search by role or keyword</p>
      <p>Job Category</p>
      <p>Job Type</p>
      <p>Region</p>
      <p>Location</p>
      <p>India</p>
      <button>Learn More</button>
    </main>
  </body>
</html>
`

const indiaListingsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Tesla Careers</title>
  </head>
  <body>
    <main>
      <h1>Build your Career at Tesla</h1>
      <p>Consumer Engagement Manager</p>
      <p>Sales & Customer Support ・ Full-Time</p>
      <p>Mumbai Suburban, Maharashtra</p>
      <p>Tesla Advisor - Mumbai</p>
      <p>Customer Support Supervisor</p>
      <p>Lead Generation Specialist</p>
      <p>Tesla Advisor - Delhi</p>
      <button>Learn More</button>
    </main>
  </body>
</html>
`

const engineeringDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Build your Career at Tesla</title>
  </head>
  <body>
    <main>
      <h1>Software Engineer, Full Stack, Tesla Cloud Platform</h1>
      <p>Job Category | Engineering & Information Technology</p>
      <p>Location | Pune, Maharashtra</p>
      <p>Req. ID | 251983</p>
      <p>Job Type | Full-time</p>
      <a href="https://www.tesla.com/careers/search/job/apply/251983">Apply</a>
    </main>
  </body>
</html>
`

const supportDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Build your Career at Tesla</title>
  </head>
  <body>
    <main>
      <h1>Customer Support Specialist</h1>
      <p>Job Category | Sales & Customer Support</p>
      <p>Location | Mumbai Suburban, Maharashtra</p>
      <p>Req. ID | 237421</p>
      <p>Job Type | Full-time</p>
      <a href="https://www.tesla.com/careers/search/job/apply/237421">Apply</a>
    </main>
  </body>
</html>
`

const serviceDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Build your Career at Tesla</title>
  </head>
  <body>
    <main>
      <h1>Service Advisor</h1>
      <p>Job Category | Vehicle Service</p>
      <p>Location | Mumbai Suburban, Maharashtra</p>
      <p>Req. ID | 237425</p>
      <p>Job Type | Full-time</p>
      <a href="https://www.tesla.com/careers/search/job/apply/237425">Apply</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/tesla/script.js')
  } catch {
    assert.fail('Expected Tesla scraper module at ../../scraper/tesla/script.js')
  }
}

test('Tesla helpers stay pinned to the verified first-party careers surface from Friday, July 17, 2026', async () => {
  const tesla = await loadModule()

  assert.equal(tesla.SOURCE, 'tesla')
  assert.equal(tesla.COMPANY, 'Tesla')
  assert.equal(tesla.CAREERS_URL, 'https://www.tesla.com/careers')
  assert.equal(tesla.INDIA_LOCALE_CAREERS_URL, 'https://www.tesla.com/en_in/careers')
  assert.equal(tesla.SEARCH_PAGE_URL, 'https://www.tesla.com/careers/search/')
  assert.equal(tesla.INDIA_LISTINGS_PAGE_URL, 'https://www.tesla.com/careers/search/?department=3')
  assert.equal(
    tesla.SAMPLE_INDIA_ENGINEERING_JOB_URL,
    'https://www.tesla.com/careers/search/job/software-engineer-full-stack-tesla-cloud-platform-251983',
  )
  assert.equal(
    tesla.SAMPLE_INDIA_SUPPORT_JOB_URL,
    'https://www.tesla.com/careers/search/job/customer-support-specialist-237421',
  )
  assert.equal(
    tesla.SAMPLE_INDIA_SERVICE_JOB_URL,
    'https://www.tesla.com/careers/search/job/service-advisor-237425',
  )
  assert.equal(tesla.VERIFIED_ON, '2026-07-17')
  assert.equal(tesla.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(tesla.hasIndiaLocaleCareersSignal(indiaLocaleCareersHtml), true)
  assert.equal(tesla.hasOfficialSearchSurfaceSignal(searchPageHtml), true)
  assert.equal(tesla.hasIndiaListingsEvidenceSignal(indiaListingsPageHtml), true)
  assert.equal(
    tesla.buildApplyUrl('251983'),
    'https://www.tesla.com/careers/search/job/apply/251983',
  )
  assert.equal(
    tesla.hasVerifiedIndiaDetailSignal(engineeringDetailHtml, {
      title: 'Software Engineer, Full Stack, Tesla Cloud Platform',
      location: 'Pune, Maharashtra',
      reqId: '251983',
      jobType: 'Full-time',
    }),
    true,
  )
  assert.equal(
    tesla.hasVerifiedIndiaDetailSignal(supportDetailHtml, {
      title: 'Customer Support Specialist',
      location: 'Mumbai Suburban, Maharashtra',
      reqId: '237421',
      jobType: 'Full-time',
    }),
    true,
  )
  assert.equal(
    tesla.hasVerifiedIndiaDetailSignal(serviceDetailHtml, {
      title: 'Service Advisor',
      location: 'Mumbai Suburban, Maharashtra',
      reqId: '237425',
      jobType: 'Full-time',
    }),
    true,
  )
})

test('Tesla returns no jobs only while the verified first-party search surface still lacks a batch-safe listing contract', async () => {
  const tesla = await loadModule()
  const requestedUrls = []

  const jobs = await tesla.createTeslaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === tesla.CAREERS_URL) return { status: 200, url, html: careersPageHtml }
      if (url === tesla.SEARCH_PAGE_URL) return { status: 200, url, html: searchPageHtml }
      if (url === tesla.INDIA_LISTINGS_PAGE_URL) return { status: 200, url, html: indiaListingsPageHtml }
      if (url === tesla.SAMPLE_INDIA_ENGINEERING_JOB_URL) return { status: 200, url, html: engineeringDetailHtml }
      if (url === tesla.SAMPLE_INDIA_SUPPORT_JOB_URL) return { status: 200, url, html: supportDetailHtml }
      if (url === tesla.SAMPLE_INDIA_SERVICE_JOB_URL) return { status: 200, url, html: serviceDetailHtml }

      throw new Error(`Unexpected Tesla URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    tesla.CAREERS_URL,
    tesla.SEARCH_PAGE_URL,
    tesla.INDIA_LISTINGS_PAGE_URL,
    tesla.SAMPLE_INDIA_ENGINEERING_JOB_URL,
    tesla.SAMPLE_INDIA_SUPPORT_JOB_URL,
    tesla.SAMPLE_INDIA_SERVICE_JOB_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Tesla fails closed when the verified careers page, search surface, or India detail evidence drifts', async () => {
  const tesla = await loadModule()

  await assert.rejects(
    tesla.createTeslaScraper().run({
      fetchPage: async (url) => {
        if (url === tesla.CAREERS_URL) return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        if (url === tesla.SEARCH_PAGE_URL) return { status: 200, url, html: searchPageHtml }
        if (url === tesla.INDIA_LISTINGS_PAGE_URL) return { status: 200, url, html: indiaListingsPageHtml }
        if (url === tesla.SAMPLE_INDIA_ENGINEERING_JOB_URL) return { status: 200, url, html: engineeringDetailHtml }
        if (url === tesla.SAMPLE_INDIA_SUPPORT_JOB_URL) return { status: 200, url, html: supportDetailHtml }
        if (url === tesla.SAMPLE_INDIA_SERVICE_JOB_URL) return { status: 200, url, html: serviceDetailHtml }
        throw new Error(`Unexpected Tesla URL: ${url}`)
      },
    }),
    /verified Tesla careers page/i,
  )

  await assert.rejects(
    tesla.createTeslaScraper().run({
      fetchPage: async (url) => {
        if (url === tesla.CAREERS_URL) return { status: 200, url, html: careersPageHtml }
        if (url === tesla.SEARCH_PAGE_URL) return { status: 200, url, html: '<html><body><h1>Build your Career at Tesla</h1></body></html>' }
        if (url === tesla.INDIA_LISTINGS_PAGE_URL) return { status: 200, url, html: indiaListingsPageHtml }
        if (url === tesla.SAMPLE_INDIA_ENGINEERING_JOB_URL) return { status: 200, url, html: engineeringDetailHtml }
        if (url === tesla.SAMPLE_INDIA_SUPPORT_JOB_URL) return { status: 200, url, html: supportDetailHtml }
        if (url === tesla.SAMPLE_INDIA_SERVICE_JOB_URL) return { status: 200, url, html: serviceDetailHtml }
        throw new Error(`Unexpected Tesla URL: ${url}`)
      },
    }),
    /verified Tesla search surface/i,
  )

  await assert.rejects(
    tesla.createTeslaScraper().run({
      fetchPage: async (url) => {
        if (url === tesla.CAREERS_URL) return { status: 200, url, html: careersPageHtml }
        if (url === tesla.SEARCH_PAGE_URL) return { status: 200, url, html: searchPageHtml }
        if (url === tesla.INDIA_LISTINGS_PAGE_URL) return { status: 200, url, html: indiaListingsPageHtml }
        if (url === tesla.SAMPLE_INDIA_ENGINEERING_JOB_URL) {
          return {
            status: 200,
            url,
            html: engineeringDetailHtml.replace('https://www.tesla.com/careers/search/job/apply/251983', 'https://example.com/apply'),
          }
        }
        if (url === tesla.SAMPLE_INDIA_SUPPORT_JOB_URL) return { status: 200, url, html: supportDetailHtml }
        if (url === tesla.SAMPLE_INDIA_SERVICE_JOB_URL) return { status: 200, url, html: serviceDetailHtml }
        throw new Error(`Unexpected Tesla URL: ${url}`)
      },
    }),
    /verified Tesla India job detail surface/i,
  )
})
