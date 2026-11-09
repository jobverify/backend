import assert from 'node:assert/strict'
import test from 'node:test'

import { getCompanyAliasMap, generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const ALL_JOBS_HTML = `
  <html>
    <head><title>Job Overview | Dynatrace Careers</title></head>
    <body>
      <h1>All Dynatrace jobs</h1>
      <p>0 open positions</p>
      <p>No open roles right now, but we're always on the lookout for great talent.</p>
      <a href="/careers/">Dynatrace Careers</a>
    </body>
  </html>
`

const LOCATIONS_OVERVIEW_HTML = `
  <html>
    <body>
      <h1>Our locations</h1>
      <section>
        <h2>Asia Pacific</h2>
        <p>India Bengaluru 1 job See more</p>
        <p>India Mumbai 2 jobs See more</p>
      </section>
    </body>
  </html>
`

const BENGALURU_HTML = `
  <html>
    <body>
      <h1>Careers in Bengaluru</h1>
      <p>Benefits and perks empower you to thrive in your career while staying happy, healthy, and balancing what's important to you outside of work.</p>
      <a href="/careers/jobs/">Explore all jobs</a>
      <address>
        Dynatrace India Software Operations Pvt. Ltd.
        1st floor, Table Space Towers,
        4th Cross Rd, Kaveri Nagar, Krishnarajapuram,
        Bengaluru, Karnataka 560048, India
      </address>
    </body>
  </html>
`

const MUMBAI_HTML = `
  <html>
    <body>
      <h1>Careers in Mumbai</h1>
      <p>Join our remote team in Mumbai and help redefine the future of digital innovation.</p>
      <a href="/careers/jobs/">Explore all jobs</a>
      <address>
        Dynatrace India Software Operations Pvt. Ltd.
        20th Floor, AKT, Parinee Crescenzo,
        Bandra Kurla Complex, Bandra East,
        Mumbai, Maharashtra, 400051, India
      </address>
    </body>
  </html>
`

const OFFICE_LOCATIONS_HTML = `
  <html>
    <head><title>Office locations across the world</title></head>
    <body>
      <h1>Dynatrace office locations</h1>
      <h2>India</h2>
      <p>Dynatrace India Software Operations Pvt. Ltd.</p>
      <p>Mumbai, Maharashtra, 400051</p>
      <p>Dynatrace India Software Operations Pvt. Ltd.</p>
      <p>Bengaluru (Bangalore), Karnataka, 560048</p>
    </body>
  </html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dynatrace/catalog.js')
  } catch {
    assert.fail('Expected Dynatrace catalog module at ../../scraper/dynatrace/catalog.js')
  }
}

const loadDynatraceModule = async () => {
  try {
    return await import('../../scraper/dynatrace/script.js')
  } catch {
    assert.fail('Expected Dynatrace scraper module at ../../scraper/dynatrace/script.js')
  }
}

test('Dynatrace catalog captures the contradictory first-party India careers surface and shared alias coverage', async () => {
  const { DYNATRACE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = getScraperCatalog().find((item) => item.source === 'dynatrace')
  const aliases = getCompanyAliasMap()

  assert.equal(defaultCatalog, DYNATRACE_CATALOG)
  assert.ok(provider, 'Expected Dynatrace provider to be registered in customProviders.json')
  assert.equal(provider.companyName, 'Dynatrace')
  assert.equal(provider.officialBrandName, 'Dynatrace')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.dynatrace.com/careers/jobs/')
  assert.equal(provider.locationsOverviewUrl, 'https://www.dynatrace.com/careers/locations/')
  assert.equal(provider.bengaluruLocationUrl, 'https://www.dynatrace.com/careers/locations/bengaluru/')
  assert.equal(provider.mumbaiLocationUrl, 'https://www.dynatrace.com/careers/locations/mumbai/')
  assert.equal(provider.officialOfficeLocationsUrl, 'https://www.dynatrace.com/company/locations/')
  assert.equal(provider.officialIndiaLegalEntity, 'Dynatrace India Software Operations Pvt. Ltd.')
  assert.equal(provider.atsPlatform, 'official-first-party-careers-pages')
  assert.equal(
    provider.paginationStrategy,
    'first-party-all-jobs-page-plus-india-location-pages-currently-contradictory-empty-slice',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-all-jobs-page+verified-india-location-pages+verified-office-locations-page+documented-india-job-count-mismatch+return-empty-until-public-listings-reappear',
  )
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'dynatrace.com')
  assert.equal(provider.verifiedOn, '2026-08-17')
  assert.match(provider.modulePath, /dynatrace[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /dynatrace[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /0 open positions/i)
  assert.match(provider.verifiedSurfaceSummary, /India Bengaluru 1 job/i)
  assert.match(provider.verifiedSurfaceSummary, /India Mumbai 2 jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /returns an empty verified slice/i)
  assert.equal(aliases['Dynatrace India'], 'dynatrace')
})

test('Dynatrace scraper verifies the contradictory first-party India surface and returns an empty slice', async () => {
  const dynatrace = await loadDynatraceModule()
  const requestedUrls = []

  assert.equal(dynatrace.hasAllJobsPageSignal(ALL_JOBS_HTML), true)
  assert.equal(dynatrace.hasZeroOpenPositions(ALL_JOBS_HTML), true)
  assert.equal(dynatrace.hasIndiaLocationCounts(LOCATIONS_OVERVIEW_HTML), true)
  assert.equal(dynatrace.hasLocationPageSignal(BENGALURU_HTML, 'Bengaluru'), true)
  assert.equal(dynatrace.hasLocationPageSignal(MUMBAI_HTML, 'Mumbai'), true)
  assert.equal(dynatrace.hasNoOpenRolesMessage(BENGALURU_HTML), true)
  assert.equal(dynatrace.hasNoOpenRolesMessage(MUMBAI_HTML), true)
  assert.equal(dynatrace.hasOfficeLocationsSignal(OFFICE_LOCATIONS_HTML), true)

  const jobs = await dynatrace.createDynatraceScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === dynatrace.ALL_JOBS_URL) return ALL_JOBS_HTML
      if (url === dynatrace.LOCATIONS_OVERVIEW_URL) return LOCATIONS_OVERVIEW_HTML
      if (url === dynatrace.BENGALURU_LOCATION_URL) return BENGALURU_HTML
      if (url === dynatrace.MUMBAI_LOCATION_URL) return MUMBAI_HTML
      if (url === dynatrace.OFFICIAL_OFFICE_LOCATIONS_URL) return OFFICE_LOCATIONS_HTML
      throw new Error(`Unexpected Dynatrace URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls.sort(), [
    dynatrace.ALL_JOBS_URL,
    dynatrace.BENGALURU_LOCATION_URL,
    dynatrace.LOCATIONS_OVERVIEW_URL,
    dynatrace.MUMBAI_LOCATION_URL,
  ].sort())
  assert.deepEqual(jobs, [])
})

test('Dynatrace India resolves through the shared alias to the broader Dynatrace provider and stays runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nDynatrace India\nDynatrace\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Dynatrace India', 'dynatrace', 'Dynatrace'],
      ['Dynatrace', 'dynatrace', 'Dynatrace'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'dynatrace')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'dynatrace')
  assert.match(scraper.dryRunFile, /dynatrace[\\/]jobs\.json$/i)
})
