import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/coupasoftwareinc/script.js')
  } catch {
    assert.fail('Expected Coupa Software Inc scraper module at ../../scraper/coupasoftwareinc/script.js')
  }
}

const verifiedLegacyJobsHtml = `
  <html>
    <head>
      <title>Jobs - Explore opportunities to make an impact. | Coupa Careers</title>
    </head>
    <body>
      <h1>Shape your career at Coupa</h1>
      <p>Displaying 1 to 2 of 2 matching jobs</p>
      <a href="/en/jobs/?page=2">Next</a>
      <article>
        <h2><a href="/en/jobs/lead-cloud-software-engineer-11625/">Lead Cloud Software Engineer - 11625</a></h2>
        <ul>
          <li>Bangalore, India</li>
          <li>Engineering</li>
          <li>Remote</li>
        </ul>
      </article>
      <article>
        <h2><a href="/en/jobs/staff-engineer-11700/">Staff Engineer - 11700</a></h2>
        <ul>
          <li>San Francisco, United States</li>
          <li>Engineering</li>
          <li>On-site</li>
        </ul>
      </article>
    </body>
  </html>
`

const verifiedLegacyJobsPageTwoHtml = `
  <html>
    <head>
      <title>Jobs - Explore opportunities to make an impact. | Coupa Careers - Page 2</title>
    </head>
    <body>
      <h1>Shape your career at Coupa</h1>
      <p>Displaying 3 to 3 of 3 matching jobs</p>
      <article>
        <h2><a href="/en/jobs/staff-data-engineer-11888/">Staff Data Engineer - 11888</a></h2>
        <ul>
          <li>Pune, India</li>
          <li>Engineering</li>
          <li>Hybrid</li>
        </ul>
      </article>
    </body>
  </html>
`

test('Coupa keeps the verified legacy first-party jobs-page parser for India cards', async () => {
  const coupa = await loadModule()

  assert.equal(coupa.hasOfficialJobsPageSignal(verifiedLegacyJobsHtml), true)
  assert.deepEqual(coupa.extractIndiaJobsFromPage(verifiedLegacyJobsHtml), [
    {
      title: 'Lead Cloud Software Engineer - 11625',
      location: 'Bangalore, India',
      department: 'Engineering',
      employmentType: 'Remote',
      sourceUrl: 'https://careers.coupa.com/en/jobs/lead-cloud-software-engineer-11625/',
      jobId: '11625',
    },
  ])
})

test('Coupa returns [] when the verified jobs page matches the live Cloudflare challenge shell', async () => {
  const coupa = await loadModule()
  const requestedPages = []

  const jobs = await coupa.createCoupaSoftwareIncScraper().run({
    detailEnrichmentBudgetMs: 0,
    fetchText: async (url) => {
      throw new Error(`HTTP 403 for ${url}`)
    },
    fetchPage: async (url) => {
      requestedPages.push(url)
      return {
        status: 403,
        url,
        headers: {
          server: 'cloudflare',
          'cf-ray': 'a2abfb470a7b802f-MAA',
          'cf-mitigated': 'challenge',
        },
        html: `
          <!DOCTYPE html>
          <html>
            <head><title>Just a moment...</title></head>
            <body>
              <main class="main-content">
                <h1>Enable JavaScript and cookies to continue</h1>
              </main>
            </body>
          </html>
        `,
      }
    },
  })

  assert.deepEqual(requestedPages, [coupa.JOBS_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('Coupa returns [] when the fallback probe resolves to the same Cloudflare challenge shell with HTTP 200', async () => {
  const coupa = await loadModule()
  const requestedPages = []

  const jobs = await coupa.createCoupaSoftwareIncScraper().run({
    detailEnrichmentBudgetMs: 0,
    fetchText: async (url) => {
      throw new Error(`HTTP 403 for ${url}`)
    },
    fetchPage: async (url) => {
      requestedPages.push(url)
      return {
        status: 200,
        url,
        headers: {
          server: 'cloudflare',
          'cf-ray': 'a2ac0138bee49de0-MAA',
        },
        html: `
          <!DOCTYPE html>
          <html>
            <head><title>Just a moment...</title></head>
            <body>
              <main class="main-content">
                <h1>Enable JavaScript and cookies to continue</h1>
              </main>
            </body>
          </html>
        `,
      }
    },
  })

  assert.deepEqual(requestedPages, [coupa.JOBS_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('Coupa recovers when the fallback probe resolves to the verified official jobs page after an initial 403', async () => {
  const coupa = await loadModule()
  const requestedPages = []
  const singlePageHtml = verifiedLegacyJobsHtml.replace('<a href="/en/jobs/?page=2">Next</a>', '')

  const jobs = await coupa.createCoupaSoftwareIncScraper({
    now: () => '2026-08-14T02:30:00.000Z',
  }).run({
    detailEnrichmentBudgetMs: 0,
    fetchText: async (url) => {
      if (url === coupa.JOBS_PAGE_URL) {
        throw new Error(`HTTP 403 for ${url}`)
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchPage: async (url) => {
      requestedPages.push(url)
      return {
        status: 200,
        url,
        headers: {
          server: 'cloudflare',
          'cf-ray': 'a2ac03331f18f651-MAA',
        },
        html: singlePageHtml,
      }
    },
  })

  assert.deepEqual(requestedPages, [coupa.JOBS_PAGE_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '11625')
  assert.equal(jobs[0].scrapedAt, '2026-08-14T02:30:00.000Z')
})

test('Coupa continues pagination when page 2 only becomes available through the verified fallback probe', async () => {
  const coupa = await loadModule()
  const requestedPages = []

  const jobs = await coupa.createCoupaSoftwareIncScraper({
    now: () => '2026-08-14T03:00:00.000Z',
  }).run({
    detailEnrichmentBudgetMs: 0,
    fetchText: async (url) => {
      if (url === coupa.JOBS_PAGE_URL) {
        return verifiedLegacyJobsHtml
      }

      if (url === 'https://careers.coupa.com/en/jobs/?page=2') {
        throw new Error(`HTTP 403 for ${url}`)
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchPage: async (url) => {
      requestedPages.push(url)
      return {
        status: 200,
        url,
        headers: {
          server: 'cloudflare',
          'cf-ray': 'a2ac051ba9c28026-MAA',
        },
        html: verifiedLegacyJobsPageTwoHtml,
      }
    },
  })

  assert.deepEqual(requestedPages, ['https://careers.coupa.com/en/jobs/?page=2'])
  assert.deepEqual(
    jobs.map((job) => job.jobId),
    ['11625', '11888'],
  )
  assert.equal(jobs[1].scrapedAt, '2026-08-14T03:00:00.000Z')
})
