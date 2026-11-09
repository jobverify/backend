import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const BLOCKED_PAGE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Attention Required! | Cloudflare</title>
    </head>
    <body>
      <main>
        <p>Please enable cookies.</p>
        <h1>Sorry, you have been blocked</h1>
        <p>You are unable to access spauldingridge.com</p>
        <p>Cloudflare Ray ID: abc123</p>
        <p>Performance &amp; security by Cloudflare</p>
      </main>
    </body>
  </html>
`

test('Spaulding Ridge recognizes the verified Cloudflare-blocked first-party careers surfaces from Monday, July 27, 2026', async () => {
  const spauldingRidge = await loadModule()
  assert.ok(spauldingRidge, 'Spaulding Ridge scraper module should load')

  assert.equal(
    spauldingRidge.CAREERS_URL,
    'https://spauldingridge.com/about-us/careers',
  )
  assert.equal(
    spauldingRidge.OPEN_POSITIONS_URL,
    'https://spauldingridge.com/about-us/open-positions',
  )
  assert.equal(typeof spauldingRidge.hasCloudflareBlockSignal, 'function')
  assert.equal(spauldingRidge.hasCloudflareBlockSignal(BLOCKED_PAGE_HTML), true)
})

test('Spaulding Ridge returns [] only while both official first-party routes remain Cloudflare-blocked', async () => {
  const spauldingRidge = await loadModule()
  assert.ok(spauldingRidge, 'Spaulding Ridge scraper module should load')

  const requestedUrls = []
  const jobs = await spauldingRidge.createSpauldingRidgeScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === spauldingRidge.CAREERS_URL) {
        return {
          status: 403,
          url,
          body: BLOCKED_PAGE_HTML,
        }
      }
      if (url === spauldingRidge.OPEN_POSITIONS_URL) {
        return {
          status: 403,
          url,
          body: BLOCKED_PAGE_HTML,
        }
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    spauldingRidge.CAREERS_URL,
    spauldingRidge.OPEN_POSITIONS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Spaulding Ridge fails closed when either blocked route stops matching the verified Cloudflare shell', async () => {
  const spauldingRidge = await loadModule()
  assert.ok(spauldingRidge, 'Spaulding Ridge scraper module should load')

  await assert.rejects(
    spauldingRidge.createSpauldingRidgeScraper().run({
      fetchPage: async (url) => {
        if (url === spauldingRidge.CAREERS_URL) {
          return {
            status: 200,
            url,
            body: '<html><body><h1>Careers</h1><a href="/jobs/senior-consultant">Apply now</a></body></html>',
          }
        }
        if (url === spauldingRidge.OPEN_POSITIONS_URL) {
          return {
            status: 403,
            url,
            body: BLOCKED_PAGE_HTML,
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /cloudflare-blocked/i,
  )

  await assert.rejects(
    spauldingRidge.createSpauldingRidgeScraper().run({
      fetchPage: async (url) => {
        if (url === spauldingRidge.CAREERS_URL) {
          return {
            status: 403,
            url,
            body: BLOCKED_PAGE_HTML,
          }
        }
        if (url === spauldingRidge.OPEN_POSITIONS_URL) {
          return {
            status: 200,
            url,
            body: '<html><body><h1>Open Positions</h1><a href="https://jobs.lever.co/spauldingridge/senior-consultant">Senior Consultant</a></body></html>',
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /cloudflare-blocked/i,
  )
})
