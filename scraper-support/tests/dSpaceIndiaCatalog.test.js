import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dspaceindia/catalog.js')
  } catch {
    assert.fail('Expected dSpace India catalog module at ../../scraper/dspaceindia/catalog.js')
  }
}

const loadDSpaceIndiaModule = async () => {
  try {
    return await import('../../scraper/dspaceindia/script.js')
  } catch {
    assert.fail('Expected dSpace India scraper module at ../../scraper/dspaceindia/script.js')
  }
}

test('dSpace India local catalog captures the verified first-party careers and India-only current-positions contract without aliases', async () => {
  const { DSPACE_INDIA_CATALOG } = await loadCatalogModule()
  const dspaceIndia = await loadDSpaceIndiaModule()
  const provider = hydrateProviderCatalogEntry(DSPACE_INDIA_CATALOG)

  assert.equal(provider.source, 'dspaceindia')
  assert.equal(provider.companyName, 'dSpace India')
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /dspaceindia[\\/]script\.js$/i)
  assert.equal(provider.companyCareerPage, 'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm')
  assert.equal(provider.officialCareersLandingUrl, 'https://www.dspace.com/en/pub/home/career.cfm')
  assert.equal(provider.jobFinderEntryUrl, 'https://www.dspace.com/en/pub/home/career/jobfinder.cfm')
  assert.equal(provider.indiaCountryFilterTerm, 'term-land-9')
  assert.equal(provider.indiaLocationFilterTerm, 'term-ort-1031')
  assert.equal(provider.indiaLocationName, 'Trivandrum')
  assert.equal(provider.applicationEmail, 'career.tvm@dspace.in')
  assert.equal(
    provider.sampleJobUrl,
    'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38151&t=Software%20Developer%20%28f%2Fm%2Fd%29',
  )
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-inline-results-data-array')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-first-party-current-positions-page+inline-results-data+india-country-filter+first-party-jobposting-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'dspace.com')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.dspace\.com\/en\/pub\/home\/career\.cfm/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/www\.dspace\.com\/en\/pub\/home\/career\/jobfinder\/stellen\.cfm/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b12 live India roles\b/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Developer \(f\/m\/d\)/i)
  assert.match(provider.verifiedSurfaceSummary, /career\.tvm@dspace\.in/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'dSpace India'), false)

  assert.equal(dspaceIndia.PROVIDER_METADATA.source, DSPACE_INDIA_CATALOG.source)
  assert.equal(dspaceIndia.PROVIDER_METADATA.companyName, DSPACE_INDIA_CATALOG.companyName)
  assert.equal(dspaceIndia.PROVIDER_METADATA.companyCareerPage, DSPACE_INDIA_CATALOG.companyCareerPage)
  assert.equal(
    dspaceIndia.PROVIDER_METADATA.indiaCountryFilterTerm,
    DSPACE_INDIA_CATALOG.indiaCountryFilterTerm,
  )
})

test('dSpace India backlog row matches directly from local provider metadata without alias churn', async () => {
  const { DSPACE_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'dSpace India\n',
    catalog: [hydrateProviderCatalogEntry(DSPACE_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['dSpace India', 'dspaceindia', 'dSpace India']],
  )
})
