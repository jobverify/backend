import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Spire Technologies Main Website</title>
  </head>
  <body>
    <main>
      <h1>Smart Digital Marketing & Automation System</h1>
      <p>Spire Technologies gives you a ready system — not trial and error.</p>
      <p>At Spire Technologies, we provide pre-built, proven templates that are ready to use.</p>
      <p>That’s why people choose Spire Technologies as their growth partner.</p>
      <p>support@spiretechnologies.in</p>
      <p>www.spiretechnologies.in</p>
      <p>Spire Technologies, Office No. 307, Undri City Center Mall, Pune - 411060</p>
      <p>© Copyrights 2026 - 2027. Spire Technologies. All Rights Reserved.</p>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.example.com/spiretechnologies/growth-manager">Growth Manager</a>
    <a href="https://jobs.example.com/spiretechnologies/growth-manager/apply">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/spiretechnologies/script.js')
  } catch {
    assert.fail('Expected Spire Technologies scraper module at ../../scraper/spiretechnologies/script.js')
  }
}

test('Spire Technologies sentinel helpers stay pinned to the verified exact-name homepage shell', async () => {
  const spire = await loadModule()

  assert.equal(spire.SOURCE, 'spiretechnologies')
  assert.equal(spire.COMPANY, 'Spire Technologies')
  assert.equal(spire.OFFICIAL_BRAND_NAME, 'Spire Technologies')
  assert.equal(spire.VERIFIED_ON, '2026-07-17')
  assert.equal(spire.CAREERS_PAGE_URL, 'https://spiretechno.com/')
  assert.match(spire.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(spire.hasOfficialHomepageSignal(OFFICIAL_HOMEPAGE_HTML), true)
  assert.equal(spire.pageExposesPublicJobListings(OFFICIAL_HOMEPAGE_HTML), false)
  assert.equal(spire.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
})

test('Spire Technologies returns [] only while the verified exact-name homepage stays a no-jobs surface', async () => {
  const spire = await loadModule()
  const requestedUrls = []

  const jobs = await spire.createSpireTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === spire.CAREERS_PAGE_URL) {
        return { status: 200, url, html: OFFICIAL_HOMEPAGE_HTML }
      }

      throw new Error(`Unexpected Spire Technologies URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [spire.CAREERS_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('Spire Technologies default fetch is bounded by a timeout signal', async () => {
  const spire = await loadModule()
  let capturedInit = null

  const page = await spire.defaultFetchPage(spire.CAREERS_PAGE_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init

      return {
        status: 200,
        url,
        text: async () => OFFICIAL_HOMEPAGE_HTML,
      }
    },
  })

  assert.equal(page.status, 200)
  assert.equal(page.url, spire.CAREERS_PAGE_URL)
  assert.equal(page.html, OFFICIAL_HOMEPAGE_HTML)
  assert.equal(capturedInit.redirect, 'follow')
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('Spire Technologies fails closed when the verified homepage shell drifts or begins exposing jobs', async () => {
  const spire = await loadModule()

  await assert.rejects(
    spire.createSpireTechnologiesScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    spire.createSpireTechnologiesScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: PUBLIC_JOBS_HTML,
      }),
    }),
    /appears to expose public jobs/i,
  )
})
