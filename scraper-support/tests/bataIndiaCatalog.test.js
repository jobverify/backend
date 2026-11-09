import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/bataindia/catalog.js')
  } catch {
    assert.fail('Expected Bata India catalog module at ../../scraper/bataindia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/bataindia/script.js')
  } catch {
    assert.fail('Expected Bata India scraper module at ../../scraper/bataindia/script.js')
  }
}

test('Bata India local catalog captures the verified official homepage handoff and SenseHQ iframe supplement contract', async () => {
  const { BATA_INDIA_CATALOG } = await loadCatalogModule()
  const bataIndia = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(BATA_INDIA_CATALOG)

  assert.equal(provider.source, 'bataindia')
  assert.equal(provider.companyName, 'Bata India')
  assert.equal(provider.officialBrandName, 'Bata India Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.bata.in/')
  assert.equal(provider.companyCareerPage, 'https://bata.sensehq.com/careers')
  assert.equal(provider.officialCareersHandoffUrl, 'https://bata.sensehq.com/careers')
  assert.equal(
    provider.iframeListingsUrl,
    'https://bata.sensehq.com/careers/iframe/jobs?page=1&isIframe=true',
  )
  assert.equal(provider.sampleJobUrl, 'https://bata.sensehq.com/careers/jobs/530')
  assert.equal(provider.sampleIframeOnlyJobUrl, 'https://bata.sensehq.com/careers/jobs/272')
  assert.equal(provider.companyDomain, 'bata.in')
  assert.equal(provider.atsPlatform, 'sensehq')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-homepage-footer-handoff-plus-root-board-plus-iframe-pagination-dedupe',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-footer-handoff+verified-root-next-data+verified-iframe-next-data+canonical-detail-routes',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.dryRunFile, /bataindia[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /bataindia[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.bata\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bata\.sensehq\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /iframe\/jobs\?page=1&isIframe=true/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bata\.sensehq\.com\/careers\/jobs\/530/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bata\.sensehq\.com\/careers\/jobs\/272/i)
  assert.match(provider.verifiedSurfaceSummary, /15 public openings/i)

  assert.equal(bataIndia.PROVIDER_METADATA.source, provider.source)
  assert.equal(bataIndia.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(bataIndia.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Bata India backlog row matches directly from local provider metadata', async () => {
  const { BATA_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Bata India\n',
    catalog: [hydrateProviderCatalogEntry(BATA_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bata India', 'bataindia', 'Bata India']],
  )
})

test('buildScrapers and company coverage resolve Bata India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bataindia')
  const scraper = buildScrapers().find((item) => item.name === 'bataindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Bata India')
  assert.equal(provider.companyCareerPage, 'https://bata.sensehq.com/careers')
  assert.match(scraper.dryRunFile, /bataindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Bata India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bata India', 'bataindia', 'Bata India']],
  )
})
