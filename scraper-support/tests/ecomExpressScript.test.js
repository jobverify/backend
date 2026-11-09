import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import https from 'node:https'
import test from 'node:test'

const mergerLandingHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Delhivery X Ecom Express</title>
    <link rel="canonical" href="https://www.ecomexpress.in/" />
    <meta name="description" content="Delhivery and Ecom Express Unite to Serve a Growing India." />
  </head>
  <body>
    <main>
      <h1>Better Together</h1>
      <p>Delhivery and Ecom Express Unite to Serve a Growing India.</p>
      <a href="https://www.delhivery.com/">Continue to Delhivery</a>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Current Openings</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/ecomexpress/software-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const loadEcomExpressModule = async () => {
  try {
    return await import('../../scraper/ecomexpress/script.js')
  } catch {
    assert.fail('Expected Ecom Express scraper module at ../../scraper/ecomexpress/script.js')
  }
}

test('Ecom Express helpers stay pinned to the verified merger landing page and reject public job signals', async () => {
  const ecomExpress = await loadEcomExpressModule()

  assert.equal(ecomExpress.SOURCE, 'ecomexpress')
  assert.equal(ecomExpress.COMPANY, 'Ecom Express')
  assert.equal(ecomExpress.OFFICIAL_BRAND_NAME, 'Ecom Express')
  assert.equal(ecomExpress.VERIFIED_ON, '2026-07-15')
  assert.equal(ecomExpress.HOMEPAGE_URL, 'https://www.ecomexpress.in/')
  assert.equal(ecomExpress.CAREER_PAGE_URL, 'https://www.ecomexpress.in/careers/')
  assert.deepEqual(ecomExpress.CHECKED_LANDING_PAGE_URLS, [
    'https://www.ecomexpress.in/',
    'https://www.ecomexpress.in/careers/',
    'https://www.ecomexpress.in/jobs/',
    'https://www.ecomexpress.in/career/',
    'https://www.ecomexpress.in/work-with-us/',
  ])
  assert.equal(ecomExpress.ROBOTS_TXT_URL, 'https://www.ecomexpress.in/robots.txt')
  assert.equal(ecomExpress.SITEMAP_URL, 'https://www.ecomexpress.in/sitemap.xml')
  assert.equal(ecomExpress.DELHIVERY_CONTINUE_URL, 'https://www.delhivery.com/')
  assert.equal(ecomExpress.hasMergerLandingSignal(mergerLandingHtml), true)
  assert.equal(ecomExpress.hasPublicJobsSignal(mergerLandingHtml), false)
  assert.equal(ecomExpress.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(
    ecomExpress.isRecoverableCertificateError({
      message: 'fetch failed',
      cause: {
        code: 'CERT_HAS_EXPIRED',
        message: 'certificate has expired',
      },
    }),
    true,
  )
})

test('Ecom Express returns [] only while the homepage, common careers routes, robots.txt, and sitemap.xml all serve the same merger landing page', async () => {
  const ecomExpress = await loadEcomExpressModule()
  const requestedUrls = []

  const jobs = await ecomExpress.createEcomExpressScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return { status: 200, url, html: mergerLandingHtml }
    },
  })

  assert.deepEqual(requestedUrls, [
    ...ecomExpress.CHECKED_LANDING_PAGE_URLS,
    ecomExpress.ROBOTS_TXT_URL,
    ecomExpress.SITEMAP_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Ecom Express falls back to an expired-certificate fetch only for the verified first-party landing pages', async () => {
  const ecomExpress = await loadEcomExpressModule()
  const primaryRequests = []
  const insecureRequests = []

  const jobs = await ecomExpress.createEcomExpressScraper().run({
    fetchPage: async (url) => {
      primaryRequests.push(url)
      throw Object.assign(new TypeError('fetch failed'), {
        cause: {
          code: 'CERT_HAS_EXPIRED',
          message: 'certificate has expired',
        },
      })
    },
    fetchPageAllowingExpiredCertificate: async (url) => {
      insecureRequests.push(url)
      return { status: 200, url, html: mergerLandingHtml }
    },
  })

  assert.deepEqual(primaryRequests, [
    ...ecomExpress.CHECKED_LANDING_PAGE_URLS,
    ecomExpress.ROBOTS_TXT_URL,
    ecomExpress.SITEMAP_URL,
  ])
  assert.deepEqual(insecureRequests, primaryRequests)
  assert.deepEqual(jobs, [])
})

test('Ecom Express expired-certificate fetch disables TLS rejection only in the fallback path', async () => {
  const ecomExpress = await loadEcomExpressModule()
  const originalRequest = https.request
  const observedOptions = []

  https.request = (targetUrl, options, callback) => {
    observedOptions.push({ targetUrl: targetUrl.toString(), options })
    const response = new EventEmitter()
    response.statusCode = 200
    response.headers = {}
    response.setEncoding = () => {}

    queueMicrotask(() => {
      callback(response)
      response.emit('data', mergerLandingHtml)
      response.emit('end')
    })

    return {
      setTimeout: () => {},
      on: () => {},
      end: () => {},
    }
  }

  try {
    const page = await ecomExpress.fetchPageAllowingExpiredCertificate(ecomExpress.HOMEPAGE_URL)

    assert.equal(observedOptions.length, 1)
    assert.equal(observedOptions[0].options.rejectUnauthorized, false)
    assert.equal(page.status, 200)
    assert.equal(page.html, mergerLandingHtml)
  } finally {
    https.request = originalRequest
  }
})

test('Ecom Express fails closed when the merger landing page or no-public-jobs contract drifts', async () => {
  const ecomExpress = await loadEcomExpressModule()

  await assert.rejects(
    ecomExpress.createEcomExpressScraper().run({
      fetchPage: async (url) => {
        if (url === ecomExpress.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Ecom Express URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    ecomExpress.createEcomExpressScraper().run({
      fetchPage: async (url) => {
        if (url === ecomExpress.HOMEPAGE_URL) {
          return { status: 200, url, html: mergerLandingHtml }
        }

        if (url === ecomExpress.CHECKED_LANDING_PAGE_URLS[1]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected Ecom Express URL: ${url}`)
      },
    }),
    /route changed/i,
  )

  await assert.rejects(
    ecomExpress.createEcomExpressScraper().run({
      fetchPage: async (url) => {
        if (ecomExpress.CHECKED_LANDING_PAGE_URLS.includes(url)) {
          return { status: 200, url, html: mergerLandingHtml }
        }

        if (url === ecomExpress.ROBOTS_TXT_URL) {
          return { status: 200, url, html: 'User-agent: *\nAllow: /' }
        }

        if (url === ecomExpress.SITEMAP_URL) {
          return { status: 200, url, html: mergerLandingHtml }
        }

        throw new Error(`Unexpected Ecom Express URL: ${url}`)
      },
    }),
    /robots\.txt changed/i,
  )

  await assert.rejects(
    ecomExpress.createEcomExpressScraper().run({
      fetchPage: async (url) => {
        if (ecomExpress.CHECKED_LANDING_PAGE_URLS.includes(url)) {
          return { status: 200, url, html: mergerLandingHtml }
        }

        if (url === ecomExpress.ROBOTS_TXT_URL) {
          return { status: 200, url, html: mergerLandingHtml }
        }

        if (url === ecomExpress.SITEMAP_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected Ecom Express URL: ${url}`)
      },
    }),
    /sitemap changed/i,
  )
})
