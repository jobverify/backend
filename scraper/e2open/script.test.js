import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Supply Chain Careers with e2open - Supply Chain Software</title>
    </head>
    <body>
      <main>
        <h1>Unlock your potential at e2open</h1>
        <a href="https://www.e2open.com/jobs/">View our open positions</a>
        <a href="https://www.e2open.com/jobs/">Search e2open Jobs</a>
      </main>
    </body>
  </html>
`

const noJobsHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Jobs - Supply Chain Software | Strategic Digital Supply Chain | e2open</title>
    </head>
    <body>
      <main>
        <h1>Employment opportunities at e2open</h1>
        <p>Filter by:</p>
        <p>All departments</p>
        <p>All locations</p>
        <p>Sorry, no jobs were found for that criteria.</p>
      </main>
    </body>
  </html>
`

const jobsWithJsonLdHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Jobs - Supply Chain Software | Strategic Digital Supply Chain | e2open</title>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "JobPosting",
              "title": "Software Engineer",
              "description": "<p>Build supply chain workflows.</p>",
              "datePosted": "2026-07-01",
              "employmentType": "FULL_TIME",
              "identifier": {
                "@type": "PropertyValue",
                "name": "Req",
                "value": "REQ-123"
              },
              "hiringOrganization": {
                "@type": "Organization",
                "name": "e2open"
              },
              "jobLocation": {
                "@type": "Place",
                "address": {
                  "@type": "PostalAddress",
                  "addressLocality": "Bengaluru",
                  "addressRegion": "Karnataka",
                  "addressCountry": "IN"
                }
              },
              "url": "https://www.e2open.com/jobs/software-engineer/"
            },
            {
              "@type": "JobPosting",
              "title": "Account Executive",
              "description": "<p>Grow the business.</p>",
              "identifier": {
                "@type": "PropertyValue",
                "value": "REQ-999"
              },
              "jobLocation": {
                "@type": "Place",
                "address": {
                  "@type": "PostalAddress",
                  "addressLocality": "Austin",
                  "addressRegion": "Texas",
                  "addressCountry": "US"
                }
              },
              "url": "https://www.e2open.com/jobs/account-executive/"
            }
          ]
        }
      </script>
    </head>
    <body>
      <main>
        <h1>Employment opportunities at e2open</h1>
        <p>Filter by:</p>
        <p>All departments</p>
        <p>All locations</p>
      </main>
    </body>
  </html>
`

test('e2open scraper module loads and validates the verified official careers surface', async () => {
  const e2open = await loadModule()
  assert.ok(e2open, 'e2open scraper module should load')

  const {
    CAREERS_PAGE_URL,
    JOBS_PAGE_URL,
    VERIFIED_CAREERS_PAGE_TITLE,
    hasVerifiedCareersSurface,
    hasVerifiedJobsSurface,
    extractJobsPageLinks,
    pageShowsNoPublicJobs,
  } = e2open

  assert.equal(CAREERS_PAGE_URL, 'https://www.e2open.com/company/careers/')
  assert.equal(JOBS_PAGE_URL, 'https://www.e2open.com/jobs/')
  assert.equal(VERIFIED_CAREERS_PAGE_TITLE, 'Supply Chain Careers with e2open - Supply Chain Software')
  assert.equal(hasVerifiedCareersSurface(careersHtml), true)
  assert.deepEqual(extractJobsPageLinks(careersHtml), [
    'https://www.e2open.com/jobs/',
    'https://www.e2open.com/jobs/',
  ])
  assert.equal(hasVerifiedJobsSurface(noJobsHtml), true)
  assert.equal(pageShowsNoPublicJobs(noJobsHtml), true)
})

test('e2open scraper returns no jobs when the official public jobs page shows no listings', async () => {
  const e2open = await loadModule()
  assert.ok(e2open, 'e2open scraper module should load')

  const { CAREERS_PAGE_URL, JOBS_PAGE_URL, createE2OpenScraper } = e2open

  const requestedUrls = []
  const jobs = await createE2OpenScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_PAGE_URL) return careersHtml
      if (url === JOBS_PAGE_URL) return noJobsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_PAGE_URL,
    JOBS_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('e2open scraper normalizes India job postings from embedded official jobs-page JSON-LD', async () => {
  const e2open = await loadModule()
  assert.ok(e2open, 'e2open scraper module should load')

  const { createE2OpenScraper } = e2open

  const jobs = await createE2OpenScraper().run({
    fetchText: async (url) => {
      if (url.endsWith('/company/careers/')) return careersHtml
      if (url.endsWith('/jobs/')) return jobsWithJsonLdHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Engineer')
  assert.equal(jobs[0].company, 'e2open')
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].state, 'Karnataka')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].jobId, 'REQ-123')
  assert.equal(jobs[0].requisitionId, 'REQ-123')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].sourceUrl, 'https://www.e2open.com/jobs/software-engineer/')
  assert.equal(jobs[0].applyUrl, 'https://www.e2open.com/jobs/software-engineer/')
  assert.equal(jobs[0].source, 'e2open')
  assert.equal(jobs[0].link, 'https://www.e2open.com/jobs/software-engineer/')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('e2open scraper rejects unsupported jobs-page markup when listings may exist', async () => {
  const e2open = await loadModule()
  assert.ok(e2open, 'e2open scraper module should load')

  const { createE2OpenScraper } = e2open

  await assert.rejects(
    createE2OpenScraper().run({
      fetchText: async (url) => {
        if (url.endsWith('/company/careers/')) return careersHtml
        if (url.endsWith('/jobs/')) {
          return `
            <html>
              <head>
                <title>Jobs - Supply Chain Software | Strategic Digital Supply Chain | e2open</title>
              </head>
              <body>
                <h1>Employment opportunities at e2open</h1>
                <p>Filter by:</p>
                <p>All departments</p>
                <p>All locations</p>
                <p>1 role available</p>
              </body>
            </html>
          `
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /jobs page no longer matches the supported public listings surface/i,
  )
})
