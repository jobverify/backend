import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  JOBS_URL,
  SOURCE,
  WELLFOUND_JOBS_URL,
  createSwymScraper,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
  hasOfficialJobs404Signal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Swym - Helping e-commerce brands craft a more seamless experience for their customers</title>
      <link href="https://www.getswym.com" rel="canonical" />
      <script type="application/ld+json">
        {
          "@type": "Organization",
          "name": "Swym",
          "url": "https://www.getswym.com/"
        }
      </script>
    </head>
    <body>
      <a href="/careers">Careers</a>
      <p>Helping e-commerce brands craft a more seamless experience for their customers</p>
      <p>45K+ brands trust Swym</p>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers at Swym | Join Our Remote-First eCommerce Team</title>
      <meta
        name="description"
        content="Join Swym's remote-first team building innovative eCommerce solutions. Competitive compensation, flexible time off, health insurance, and a culture of growth."
      />
      <link href="https://www.getswym.com/careers" rel="canonical" />
      <script type="application/ld+json">
        {
          "@type": "WebPage",
          "name": "Careers at Swym",
          "headline": "Come win with us",
          "description": "Careers page for Swym, inviting candidates to join a global team building shopper-first ecommerce experiences, with open roles and company information."
        }
      </script>
    </head>
    <body>
      <main>
        <h1>Come win with us</h1>
        <p>We're a remote-first company with team members all over the world.</p>
        <h4>Competitive compensation</h4>
        <p>Flexible time off plus 20 days of PTO help our global team grow.</p>
        <p>Health &amp; wellness starts with health insurance for your family.</p>
        <a href="https://wellfound.com/company/swym/jobs" target="_blank">View Current Openings</a>
      </main>
    </body>
  </html>
`

const jobs404Html = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Not Found</title>
      <link href="https://www.getswym.com/404" rel="canonical" />
    </head>
    <body>
      <main>
        <h1>We've looked everywhere!</h1>
        <p>Just like a favorite item that's gone out of stock, this page is currently unavailable.</p>
        <a href="/">Go to Homepage</a>
      </main>
      <div class="utility-page-content">
        <h2>Page Not Found</h2>
      </div>
    </body>
  </html>
`

test('Swym sentinel recognizes the verified first-party homepage, careers page, and jobs-route 404 surface', () => {
  assert.equal(SOURCE, 'swym')
  assert.equal(COMPANY, 'Swym')
  assert.equal(HOMEPAGE_URL, 'https://www.getswym.com/')
  assert.equal(CAREERS_URL, 'https://www.getswym.com/careers')
  assert.equal(JOBS_URL, 'https://www.getswym.com/jobs')
  assert.equal(WELLFOUND_JOBS_URL, 'https://wellfound.com/company/swym/jobs')

  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasOfficialJobs404Signal(jobs404Html), true)
})

test('Swym sentinel returns no jobs while the verified first-party careers handoff stays unchanged', async () => {
  const requestedUrls = []

  const jobs = await createSwymScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === JOBS_URL) {
        return { status: 404, url, html: jobs404Html }
      }

      throw new Error(`Unexpected Swym URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_URL,
    JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Swym default fetch path applies a bounded timeout to every request', async () => {
  const originalFetch = globalThis.fetch
  const originalTimeout = AbortSignal.timeout
  const timeoutCalls = []
  const timeoutSignals = []
  const requests = []

  AbortSignal.timeout = (timeoutMs) => {
    timeoutCalls.push(timeoutMs)
    const controller = new AbortController()
    timeoutSignals.push(controller.signal)
    return controller.signal
  }

  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options })

    if (url === HOMEPAGE_URL) {
      return { status: 200, url, text: async () => homepageHtml }
    }

    if (url === CAREERS_URL) {
      return { status: 200, url, text: async () => careersHtml }
    }

    return { status: 404, url, text: async () => jobs404Html }
  }

  try {
    assert.deepEqual(await createSwymScraper().run(), [])
  } finally {
    globalThis.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
  }

  assert.deepEqual(requests.map((request) => request.url), [
    HOMEPAGE_URL,
    CAREERS_URL,
    JOBS_URL,
  ])
  assert.deepEqual(timeoutCalls, [15000, 15000, 15000])
  assert.deepEqual(requests.map((request) => request.options.signal), timeoutSignals)
})

test('Swym sentinel fails closed when the verified homepage, careers handoff, or jobs-route 404 contract changes', async () => {
  await assert.rejects(
    createSwymScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: HOMEPAGE_URL,
        html: '<html><body><h1>Unexpected homepage</h1></body></html>',
      }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    createSwymScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        return {
          status: 200,
          url,
          html: careersHtml.replace(WELLFOUND_JOBS_URL, 'https://jobs.ashbyhq.com/swym'),
        }
      },
    }),
    /verified careers handoff/i,
  )

  await assert.rejects(
    createSwymScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        return {
          status: 200,
          url,
          html: '<html><body><h1>Jobs</h1><a href="/jobs/software-engineer">Software Engineer</a></body></html>',
        }
      },
    }),
    /verified first-party jobs route/i,
  )
})
