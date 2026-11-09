import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sankalp Semiconductor - End-to-End Analog and Mixed Signal Solution</title>
  </head>
  <body>
    <nav>
      <a href="https://sankalpsemi.hcltech.com/life-at-sankalp/">Life @ Sankalp</a>
      <a href="https://sankalpsemi.alchemus.com/jobs">Search Openings</a>
      <a href="https://sankalpsemi.hcltech.com/hackathon/">Hackathon</a>
    </nav>
    <main>
      <h1>END-TO-END SEMICONDUCTOR SERVICES</h1>
      <p>For Job Opportunities</p>
      <p>sankalp-recruit@hcl.com</p>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact us</title>
  </head>
  <body>
    <h1>Contact us</h1>
    <p>For Job Opportunities</p>
    <p>sankalp-recruit@hcl.com</p>
    <p>Hubli</p>
    <p>Bangalore</p>
    <p>Kolkata</p>
  </body>
</html>
`

const publicJobsBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sankalp Semiconductor Search Openings</title>
  </head>
  <body>
    <h1>Search Openings</h1>
    <a href="/job/design-engineer">Design Engineer</a>
    <p>Bangalore, India</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sankalpsemiconductor/script.js')
  } catch {
    assert.fail('Expected Sankalp Semiconductor scraper module at ../../scraper/sankalpsemiconductor/script.js')
  }
}

test('Sankalp Semiconductor sentinel helpers stay pinned to the verified exact-name first-party site and ATS handoff', async () => {
  const sankalp = await loadModule()

  assert.equal(sankalp.SOURCE, 'sankalpsemiconductor')
  assert.equal(sankalp.COMPANY, 'Sankalp Semiconductor')
  assert.equal(sankalp.OFFICIAL_BRAND_NAME, 'Sankalp Semiconductor')
  assert.equal(sankalp.VERIFIED_ON, '2026-07-17')
  assert.equal(sankalp.HOMEPAGE_URL, 'https://sankalpsemi.hcltech.com/')
  assert.equal(sankalp.CONTACT_URL, 'https://sankalpsemi.hcltech.com/contact/')
  assert.equal(sankalp.SEARCH_OPENINGS_HOST_URL, 'https://sankalpsemi.alchemus.com/')
  assert.equal(sankalp.JOB_OPPORTUNITIES_EMAIL, 'sankalp-recruit@hcl.com')
  assert.equal(sankalp.hasHomepageSignal(homepageHtml), true)
  assert.equal(sankalp.hasHomepageSignal('<html><title>Other</title></html>'), false)
  assert.equal(sankalp.hasContactPageSignal(contactHtml), true)
  assert.equal(sankalp.hasContactPageSignal('<html><body>Contact</body></html>'), false)
  assert.equal(sankalp.extractSearchOpeningsUrl(homepageHtml), 'https://sankalpsemi.alchemus.com/jobs')
  assert.equal(sankalp.hasPublicJobBoardSignal(publicJobsBoardHtml), true)
  assert.equal(sankalp.hasPublicJobBoardSignal('<html><body>Login</body></html>'), false)
})

test('Sankalp Semiconductor sentinel returns [] while the exact-name site stays stable and the ATS handoff remains unreachable', async () => {
  const sankalp = await loadModule()
  const requestedUrls = []

  const jobs = await sankalp.createSankalpSemiconductorScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sankalp.HOMEPAGE_URL) return homepageHtml
      if (url === sankalp.CONTACT_URL) return contactHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    probeText: async () => {
      throw new TypeError('fetch failed: getaddrinfo ENOTFOUND sankalpsemi.alchemus.com')
    },
  })

  assert.deepEqual(requestedUrls, [
    sankalp.HOMEPAGE_URL,
    sankalp.CONTACT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Sankalp Semiconductor returns discovery-only evidence when the verified homepage returns HTTP 500', async () => {
  const sankalp = await loadModule()

  const jobs = await sankalp.createSankalpSemiconductorScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
    fetchText: async () => {
      throw new Error(`HTTP 500 for ${sankalp.HOMEPAGE_URL}`)
    },
    probeText: async () => '',
  })

  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, sankalp.HOMEPAGE_URL)
  assert.equal(evidence?.listingComplete, false)
})

test('Sankalp Semiconductor sentinel fails closed when the verified homepage, contact page, or ATS assumptions drift into a public jobs surface', async () => {
  const sankalp = await loadModule()

  await assert.rejects(
    sankalp.createSankalpSemiconductorScraper().run({
      fetchText: async (url) => {
        if (url === sankalp.HOMEPAGE_URL) return '<html><title>Unexpected</title></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
      probeText: async () => '',
    }),
    /homepage no longer matches the verified public surface/i,
  )

  await assert.rejects(
    sankalp.createSankalpSemiconductorScraper().run({
      fetchText: async (url) => {
        if (url === sankalp.HOMEPAGE_URL) return homepageHtml
        if (url === sankalp.CONTACT_URL) return '<html><body>Contact us</body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
      probeText: async () => '',
    }),
    /contact page no longer matches the verified public surface/i,
  )

  await assert.rejects(
    sankalp.createSankalpSemiconductorScraper().run({
      fetchText: async (url) => {
        if (url === sankalp.HOMEPAGE_URL) return homepageHtml
        if (url === sankalp.CONTACT_URL) return contactHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
      probeText: async () => publicJobsBoardHtml,
    }),
    /ats handoff now exposes a public jobs surface/i,
  )
})
