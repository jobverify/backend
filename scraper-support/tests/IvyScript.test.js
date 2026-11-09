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
    <a href="/contact">Contact</a>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html>
  <head><title>Contact - Ivy Comptech</title></head>
  <body>
    <h1>Do you challenge assumptions and look for bold, innovative new solutions? Let's talk</h1>
    <ul>
      <li>Ivy Comptech Private Limited</li>
      <li>Ivy Software Development Services Private Limited</li>
      <li>Ivy Global Shared Services Private Limited</li>
      <li>Ivy Mobitech Services Private Limited</li>
    </ul>
    <p>info@ivycomptech.com</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/ivy/script.js')
  } catch {
    assert.fail('Expected ivy scraper module at ../../scraper/ivy/script.js')
  }
}

test('ivy returns [] only while the shared Ivy Comptech surface stays blocked for public job listings', async () => {
  const ivy = await loadModule()
  const probedUrls = []

  assert.equal(ivy.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(ivy.hasOfficialContactSignal(contactHtml), true)

  const jobs = await ivy.createIvyScraper().run({
    fetchText: async (url) => {
      if (url === ivy.HOMEPAGE_URL) return homepageHtml
      if (url === ivy.CONTACT_URL) return contactHtml
      throw new Error(`Unexpected fetchText URL: ${url}`)
    },
    probeUrl: async (url) => {
      probedUrls.push(url)
      return {
        ok: false,
        error: url.startsWith('http://')
          ? 'HTTP 403 Forbidden'
          : 'Could not create SSL/TLS secure channel',
      }
    },
  })

  assert.deepEqual(probedUrls, ivy.BLOCKED_ROUTE_URLS)
  assert.deepEqual(jobs, [])
})

test('ivy fails closed when the first-party blocked routes start exposing public jobs', async () => {
  const ivy = await loadModule()

  await assert.rejects(
    ivy.createIvyScraper().run({
      fetchText: async (url) => {
        if (url === ivy.HOMEPAGE_URL) return homepageHtml
        if (url === ivy.CONTACT_URL) return contactHtml
        throw new Error(`Unexpected fetchText URL: ${url}`)
      },
      probeUrl: async (url) => ({
        ok: url === 'https://ivy.global/careers',
        text: '<html><body><h1>Open Positions</h1><a href="/careers/software-engineer">Apply Now</a></body></html>',
        error: 'HTTP 403 Forbidden',
      }),
    }),
    /public job listings/i,
  )
})

test('ivy can recover with browser-backed shared surface checks when direct requests fail', async () => {
  const ivy = await loadModule()
  const browserTextUrls = []
  const browserPageUrls = []

  const jobs = await ivy.createIvyScraper().run({
    fetchText: async () => {
      throw new TypeError('fetch failed')
    },
    fetchBrowserText: async (url) => {
      browserTextUrls.push(url)

      if (url === ivy.HOMEPAGE_URL) return homepageHtml
      if (url === ivy.CONTACT_URL) return contactHtml

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

  assert.deepEqual(browserTextUrls, [ivy.HOMEPAGE_URL, ivy.CONTACT_URL])
  assert.deepEqual(browserPageUrls, ivy.BLOCKED_ROUTE_URLS)
  assert.deepEqual(jobs, [])
})

test('ivy returns [] when the shared verification surface is fully inaccessible but blocked-route probes stay blocked', async () => {
  const ivy = await loadModule()
  const browserTextUrls = []
  const browserPageUrls = []

  const jobs = await ivy.createIvyScraper().run({
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
        status: url.startsWith('http://') ? 403 : 403,
        html: '<html><body>Forbidden</body></html>',
      }
    },
  })

  assert.deepEqual(browserTextUrls, [ivy.HOMEPAGE_URL, ivy.CONTACT_URL])
  assert.deepEqual(browserPageUrls, ivy.BLOCKED_ROUTE_URLS)
  assert.deepEqual(jobs, [])
})

test('ivy skips browser fallback when ivy.global is timing out at the transport layer', async () => {
  const ivy = await loadModule()
  const browserTextUrls = []
  const browserPageUrls = []

  const jobs = await ivy.createIvyScraper().run({
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
