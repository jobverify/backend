import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html>
  <head><title>Ivy Comptech - Leading Solutions for the Online Gaming Industry</title></head>
  <body>
    <h1>Ivy Comptech</h1>
    <p>Ivy is a beacon for open-minded, curious people.</p>
    <p>Are you ready to shine?</p>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html>
  <head><title>Contact - Ivy Comptech</title></head>
  <body>
    <li>Ivy Comptech Private Limited</li>
    <li>Ivy Software Development Services Private Limited</li>
    <li>Ivy Global Shared Services Private Limited</li>
    <li>Ivy Mobitech Services Private Limited</li>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/ivysoftwaredevelopmentservices/script.js')
  } catch {
    assert.fail('Expected IVY SOFTWARE DEVELOPMENT SERVICES scraper module at ../../scraper/ivysoftwaredevelopmentservices/script.js')
  }
}

test('IVY SOFTWARE DEVELOPMENT SERVICES returns [] while its shared Ivy Comptech jobs surface remains blocked', async () => {
  const ivySoftware = await loadModule()

  const jobs = await ivySoftware.createIvySoftwareDevelopmentServicesScraper().run({
    fetchText: async (url) => {
      if (url === ivySoftware.HOMEPAGE_URL) return homepageHtml
      if (url === ivySoftware.CONTACT_URL) return contactHtml
      throw new Error(`Unexpected fetchText URL: ${url}`)
    },
    probeUrl: async (url) => ({
      ok: false,
      error: url.startsWith('http://')
        ? 'HTTP 403 Forbidden'
        : 'Could not create SSL/TLS secure channel',
    }),
  })

  assert.deepEqual(jobs, [])
})

test('IVY SOFTWARE DEVELOPMENT SERVICES fails closed when a public jobs page becomes reachable on the shared surface', async () => {
  const ivySoftware = await loadModule()

  await assert.rejects(
    ivySoftware.createIvySoftwareDevelopmentServicesScraper().run({
      fetchText: async (url) => {
        if (url === ivySoftware.HOMEPAGE_URL) return homepageHtml
        if (url === ivySoftware.CONTACT_URL) return contactHtml
        throw new Error(`Unexpected fetchText URL: ${url}`)
      },
      probeUrl: async (url) => ({
        ok: url === 'https://ivy.global/jobs',
        text: '<html><body><h1>Current Openings</h1><a href="/jobs/qa-engineer">View Job</a></body></html>',
        error: 'HTTP 403 Forbidden',
      }),
    }),
    /public job listings/i,
  )
})

test('IVY SOFTWARE DEVELOPMENT SERVICES can recover with browser-backed shared surface checks when direct requests fail', async () => {
  const ivySoftware = await loadModule()
  const browserTextUrls = []
  const browserPageUrls = []

  const jobs = await ivySoftware.createIvySoftwareDevelopmentServicesScraper().run({
    fetchText: async () => {
      throw new TypeError('fetch failed')
    },
    fetchBrowserText: async (url) => {
      browserTextUrls.push(url)

      if (url === ivySoftware.HOMEPAGE_URL) return homepageHtml
      if (url === ivySoftware.CONTACT_URL) return contactHtml

      throw new Error(`Unexpected fetchBrowserText URL: ${url}`)
    },
    fetchBrowserPage: async (url) => {
      browserPageUrls.push(url)
      return {
        status: 403,
        html: '<html><body>Forbidden</body></html>',
      }
    },
  })

  assert.deepEqual(browserTextUrls, [ivySoftware.HOMEPAGE_URL, ivySoftware.CONTACT_URL])
  assert.deepEqual(browserPageUrls, ivySoftware.BLOCKED_ROUTE_URLS)
  assert.deepEqual(jobs, [])
})

test('IVY SOFTWARE DEVELOPMENT SERVICES returns [] when the shared verification surface is fully inaccessible but blocked-route probes stay blocked', async () => {
  const ivySoftware = await loadModule()
  const browserTextUrls = []
  const browserPageUrls = []

  const jobs = await ivySoftware.createIvySoftwareDevelopmentServicesScraper().run({
    fetchText: async () => {
      throw new TypeError('fetch failed | tlsv1 alert internal error')
    },
    fetchBrowserText: async (url) => {
      browserTextUrls.push(url)
      throw new Error(`net::ERR_SSL_PROTOCOL_ERROR at ${url}`)
    },
    fetchBrowserPage: async (url) => {
      browserPageUrls.push(url)
      return {
        status: 403,
        html: '<html><body>Forbidden</body></html>',
      }
    },
  })

  assert.deepEqual(browserTextUrls, [ivySoftware.HOMEPAGE_URL, ivySoftware.CONTACT_URL])
  assert.deepEqual(browserPageUrls, ivySoftware.BLOCKED_ROUTE_URLS)
  assert.deepEqual(jobs, [])
})

test('IVY SOFTWARE DEVELOPMENT SERVICES skips browser fallback when ivy.global is timing out at the transport layer', async () => {
  const ivySoftware = await loadModule()
  const browserTextUrls = []
  const browserPageUrls = []

  const jobs = await ivySoftware.createIvySoftwareDevelopmentServicesScraper().run({
    fetchText: async () => {
      throw new TypeError('fetch failed | Connect Timeout Error (attempted address: ivy.global:443, timeout: 10000ms)')
    },
    fetchBrowserText: async (url) => {
      browserTextUrls.push(url)
      throw new Error(`Unexpected browser text fallback for ${url}`)
    },
    fetchBrowserPage: async (url) => {
      browserPageUrls.push(url)
      throw new Error(`Unexpected browser page fallback for ${url}`)
    },
  })

  assert.deepEqual(browserTextUrls, [])
  assert.deepEqual(browserPageUrls, [])
  assert.deepEqual(jobs, [])
})
