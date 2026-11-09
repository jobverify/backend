import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/rxlogixcorporation/script.js')

const careersHtml = `
  <html>
    <head><title>Careers at RxLogix | Join Our Team</title></head>
    <body>
      <h1>Careers</h1>
      <p>Interested to join our growing team? Browse our current openings:</p>
      <h2>Technical / Enterprise Architect</h2>
      <a href="https://rxlogix.com/technical-architect/" class="job_tab">
        <div class="title">Technical Architect</div>
        <div class="loc">Noida, India</div>
      </a>
      <h2>TECHNOLOGY</h2>
      <a href="https://rxlogix.com/performance-test-engineer/" class="job_tab">
        <div class="title">Performance Test Engineer</div>
        <div class="loc">Noida, India</div>
      </a>
      <a href="https://rxlogix.com/data-engineer/" class="job_tab">
        <div class="title">Data Engineer</div>
        <div class="loc">Noida, India</div>
      </a>
      <h2>Sales & Marketing</h2>
      <a href="https://rxlogix.com/director-marketing/" class="job_tab">
        <div class="title">Director - Marketing</div>
        <div class="loc">Princeton, NJ, US</div>
      </a>
    </body>
  </html>
`

const detailPages = {
  'https://rxlogix.com/technical-architect/': `
    <html>
      <head>
        <title>Technical Architect - Rxlogix</title>
        <meta name="description" content="Job Status: Full Time General Purpose: Lead architecture for pharmacovigilance systems. Overall 8-10+ years of experience with minimum 5+ years on product technical design and architecture." />
      </head>
      <body></body>
    </html>
  `,
  'https://rxlogix.com/performance-test-engineer/': `
    <html>
      <head>
        <title>Performance Test Engineer - Rxlogix</title>
        <meta name="description" content="Role Overview As a Performance Test Engineer, you will ensure performance and scalability. Requires 4+ years experience supporting cloud infrastructure." />
      </head>
      <body></body>
    </html>
  `,
  'https://rxlogix.com/data-engineer/': `
    <html>
      <head>
        <title>Data Engineer - Rxlogix</title>
        <meta name="description" content="Experience: 2-5 years Job Summary: Build and maintain data pipelines." />
      </head>
      <body></body>
    </html>
  `,
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/rxlogixcorporation/catalog.js')
  } catch {
    assert.fail('Expected RxLogix Corporation catalog module at ../../scraper/rxlogixcorporation/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/rxlogixcorporation/script.js')
  } catch {
    assert.fail('Expected RxLogix Corporation scraper module at ../../scraper/rxlogixcorporation/script.js')
  }
}

test('RxLogix Corporation catalog captures the official careers page with current India openings', async () => {
  const { RX_LOGIX_CORPORATION_CATALOG, default: defaultCatalog } = await loadCatalogModule()

  assert.equal(defaultCatalog, RX_LOGIX_CORPORATION_CATALOG)
  assert.equal(RX_LOGIX_CORPORATION_CATALOG.source, 'rxlogixcorporation')
  assert.equal(RX_LOGIX_CORPORATION_CATALOG.companyName, 'RxLogix Corporation')
  assert.equal(RX_LOGIX_CORPORATION_CATALOG.adapter, 'script')
  assert.equal(RX_LOGIX_CORPORATION_CATALOG.companyCareerPage, 'https://rxlogix.com/careers/')
  assert.equal(RX_LOGIX_CORPORATION_CATALOG.companyDomain, 'rxlogix.com')
  assert.equal(RX_LOGIX_CORPORATION_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(RX_LOGIX_CORPORATION_CATALOG.countryFilter, 'India')
  assert.equal(RX_LOGIX_CORPORATION_CATALOG.verifiedOn, '2026-08-04')
  assert.equal(RX_LOGIX_CORPORATION_CATALOG.modulePath, modulePath)
  assert.match(RX_LOGIX_CORPORATION_CATALOG.verifiedSurfaceSummary, /Technical Architect/i)
  assert.match(RX_LOGIX_CORPORATION_CATALOG.verifiedSurfaceSummary, /Performance Test Engineer/i)
  assert.match(RX_LOGIX_CORPORATION_CATALOG.verifiedSurfaceSummary, /root-level detail URLs/i)
})

test('RxLogix Corporation scraper keeps only India openings from the official careers page and linked detail pages', async () => {
  const rxLogix = await loadScriptModule()

  assert.equal(rxLogix.hasOfficialRxLogixCareersSignal(careersHtml), true)

  const listings = rxLogix.extractCareerListings(careersHtml)
  assert.equal(listings.length, 3)
  assert.deepEqual(
    listings.map((listing) => [listing.title, listing.location, listing.department]),
    [
      ['Technical Architect', 'Noida, India', 'Technical / Enterprise Architect'],
      ['Performance Test Engineer', 'Noida, India', 'TECHNOLOGY'],
      ['Data Engineer', 'Noida, India', 'TECHNOLOGY'],
    ],
  )

  const jobs = await rxLogix.createRxLogixCorporationScraper().run({
    fetchPage: async (url) => {
      if (url === 'https://rxlogix.com/careers/') {
        return { status: 200, url, html: careersHtml }
      }

      return { status: 200, url, html: detailPages[url] }
    },
    now: () => '2026-08-04T00:00:00.000Z',
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.experienceRequired]),
    [
      ['Technical Architect', 'Noida, India', '8-10+ years'],
      ['Performance Test Engineer', 'Noida, India', '4+ years'],
      ['Data Engineer', 'Noida, India', '2-5 years'],
    ],
  )
})
