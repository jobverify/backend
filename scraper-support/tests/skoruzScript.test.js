import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const SKORUZ_EMPTY_US_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Skoruz Technologies Pvt Ltd</title>
  </head>
  <body>
    <main>
      <h1>Join Us</h1>
      <p>Multiple Open Positions</p>
      <section>
        <h2>India</h2>
        <iframe
          style="border: 1px solid #ccc; margin: 10px 0;"
          src="https://talenthire.ceipal.in/Jobs/listing/MTAz"
          width="1020"
          height="1700"></iframe>
      </section>
      <section>
        <h2>United States</h2>
        <script
          type="text/javascript"
          src="https://jobsapi.ceipal.com/APISource/widget.js"
          data-ceipal-api-key="MnBZVTdZUU9lZC9xOXJDbFdCSi9OQT09"></script>
        <div id="example-widget-container"></div>
        <h4>"Currently, no openings available. Please check back later for updates. Thank you for your interest!"</h4>
      </section>
    </main>
  </body>
</html>
`

const SKORUZ_PUBLIC_US_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Skoruz Technologies Pvt Ltd</title>
  </head>
  <body>
    <main>
      <h1>Join Us</h1>
      <p>Multiple Open Positions</p>
      <section>
        <h2>India</h2>
        <iframe
          style="border: 1px solid #ccc; margin: 10px 0;"
          src="https://talenthire.ceipal.in/Jobs/listing/MTAz"
          width="1020"
          height="1700"></iframe>
      </section>
      <section>
        <h2>United States</h2>
        <script
          type="text/javascript"
          src="https://jobsapi.ceipal.com/APISource/widget.js"
          data-ceipal-api-key="MnBZVTdZUU9lZC9xOXJDbFdCSi9OQT09"></script>
        <div id="example-widget-container"></div>
        <h4 style="text-align: center;">
          <p><strong>Date Posted: August 1, 2026</strong></p>
          <p><strong>Network and Computer Systems Administrator:</strong> Install, configure, and maintain network and server hardware and software. Jobs based in San Jose, CA. No travel (US or Intl), but 40% chance of relocation to unanticipated locations throughout the U.S. Email cover letter and resume to hr@skoruz.com or mail to HR at Skoruz Technologies Inc. 2033 Gateway Place, Ste. 500, San Jose, CA-95110. No Walk-ins.</p>
        </h4>
      </section>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/skoruz/script.js')
  } catch {
    assert.fail('Expected Skoruz scraper module at ../../scraper/skoruz/script.js')
  }
}

test('Skoruz recognizes the verified careers page variants and the trusted India iframe failure condition', async () => {
  const skoruz = await loadModule()

  assert.equal(skoruz.SOURCE, 'skoruz')
  assert.equal(skoruz.COMPANY, 'Skoruz')
  assert.equal(skoruz.OFFICIAL_BRAND_NAME, 'Skoruz Technologies Pvt Ltd')
  assert.equal(skoruz.VERIFIED_ON, '2026-08-04')
  assert.equal(skoruz.CAREERS_URL, 'https://www.skoruz.com/careers/')
  assert.equal(skoruz.INDIA_IFRAME_URL, 'https://talenthire.ceipal.in/Jobs/listing/MTAz')
  assert.equal(skoruz.hasVerifiedCareersSignal(SKORUZ_EMPTY_US_HTML), true)
  assert.equal(skoruz.hasVerifiedCareersSignal(SKORUZ_PUBLIC_US_HTML), true)
  assert.equal(
    skoruz.extractIndiaIframeUrl(SKORUZ_PUBLIC_US_HTML),
    'https://talenthire.ceipal.in/Jobs/listing/MTAz',
  )
  const publicJobs = skoruz.extractPublicUsJobs(SKORUZ_PUBLIC_US_HTML)
  assert.equal(publicJobs.length, 1)
  assert.equal(publicJobs[0].title, 'Network and Computer Systems Administrator')
  assert.equal(publicJobs[0].postedAt, '2026-08-01')
  assert.equal(publicJobs[0].location, 'San Jose, CA, United States')
  assert.equal(publicJobs[0].city, 'San Jose')
  assert.equal(publicJobs[0].state, 'CA')
  assert.equal(publicJobs[0].country, 'United States')
  assert.equal(publicJobs[0].applyUrl, 'mailto:hr@skoruz.com')
  assert.equal(publicJobs[0].sourceUrl, 'https://www.skoruz.com/careers/')
  assert.match(publicJobs[0].description, /Install, configure, and maintain network and server hardware and software\./i)
  assert.match(publicJobs[0].description, /No Walk-ins\./i)
  assert.equal(
    skoruz.isTrustedIndiaIframeFailure(
      new Error('The underlying connection was closed: Could not establish trust relationship for the SSL/TLS secure channel.'),
    ),
    true,
  )
  assert.equal(
    skoruz.isTrustedIndiaIframeFailure(
      new Error('curl: (28) Failed to connect to talenthire.ceipal.in port 443 after 21065 ms: Could not connect to server'),
    ),
    true,
  )
  assert.equal(
    skoruz.isTrustedIndiaIframeFailure(
      new Error('[skoruz] All 3 attempts failed. Last error: fetch failed | Connect Timeout Error (attempted address: talenthire.ceipal.in:443, timeout: 10000ms)'),
    ),
    true,
  )
})

test('Skoruz returns discovery-only evidence when the India iframe is inaccessible and the US tab is empty', async () => {
  const skoruz = await loadModule()
  const requestedUrls = []

  const jobs = await skoruz.createSkoruzScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === skoruz.CAREERS_URL) return SKORUZ_EMPTY_US_HTML
      if (url === skoruz.INDIA_IFRAME_URL) {
        throw new Error(
          'The underlying connection was closed: Could not establish trust relationship for the SSL/TLS secure channel.',
        )
      }

      throw new Error(`Unexpected Skoruz URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    skoruz.CAREERS_URL,
    skoruz.INDIA_IFRAME_URL,
  ])
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, skoruz.INDIA_IFRAME_URL)
  assert.equal(evidence?.listingComplete, false)
  assert.equal(evidence?.indiaFacetCount, null)
})

test('Skoruz records discovery-only evidence instead of publishing visible US jobs as India inventory', async () => {
  const skoruz = await loadModule()
  const requestedUrls = []

  const jobs = await skoruz.createSkoruzScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === skoruz.CAREERS_URL) return SKORUZ_PUBLIC_US_HTML
      if (url === skoruz.INDIA_IFRAME_URL) {
        throw new Error(
          '[skoruz] All 3 attempts failed. Last error: fetch failed | Connect Timeout Error (attempted address: talenthire.ceipal.in:443, timeout: 10000ms)',
        )
      }

      throw new Error(`Unexpected Skoruz URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    skoruz.CAREERS_URL,
    skoruz.INDIA_IFRAME_URL,
  ])
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, skoruz.INDIA_IFRAME_URL)
  assert.equal(evidence?.listingComplete, false)
  assert.equal(evidence?.indiaFacetCount, null)
})

test('Skoruz fails closed when the verified careers page drifts or the India iframe becomes reachable', async () => {
  const skoruz = await loadModule()

  await assert.rejects(
    skoruz.createSkoruzScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified skoruz careers page/i,
  )

  await assert.rejects(
    skoruz.createSkoruzScraper().run({
      fetchText: async (url) => {
        if (url === skoruz.CAREERS_URL) return SKORUZ_PUBLIC_US_HTML
        return '<html><body><h1>Senior Data Engineer</h1><a href="/apply">Apply</a></body></html>'
      },
    }),
    /Skoruz India jobs iframe became reachable or changed materially/i,
  )
})
