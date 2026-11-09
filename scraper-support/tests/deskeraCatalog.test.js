import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/deskera/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/deskera/catalog.js')
  } catch {
    assert.fail('Expected Deskera catalog module at ../../scraper/deskera/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/deskera/script.js')
  } catch {
    assert.fail('Expected Deskera scraper module at ../../scraper/deskera/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Deskera local catalog captures the verified homepage and broken LinkedIn jobs handoff contract', async () => {
  const { DESKERA_CATALOG } = await loadCatalogModule()
  const deskera = await loadScraperModule()
  const provider = buildCatalogReadyProvider(DESKERA_CATALOG)

  assert.equal(provider.source, 'deskera')
  assert.equal(provider.companyName, 'Deskera')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.deskera.com/')
  assert.equal(provider.companyCareerPage, 'https://www.linkedin.com/jobs/deskera-jobs')
  assert.equal(provider.linkedinCompanyPageUrl, 'https://www.linkedin.com/company/deskera/')
  assert.equal(provider.companyDomain, 'deskera.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-linkedin-guest-search-handoff')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-linkedin-company-page+verified-linkedin-guest-search-handoff-without-exact-deskera-board-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /deskera[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.deskera\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.linkedin\.com\/jobs\/deskera-jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.linkedin\.com\/company\/deskera\//i)
  assert.match(provider.verifiedSurfaceSummary, /generic LinkedIn guest jobs search page/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Deskera'), false)

  assert.equal(deskera.PROVIDER_METADATA.source, provider.source)
  assert.equal(deskera.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(deskera.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Deskera backlog row matches directly from local provider metadata without alias churn', async () => {
  const { DESKERA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Deskera\n',
    catalog: [buildCatalogReadyProvider(DESKERA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Deskera', 'deskera', 'Deskera']],
  )
})

test('buildScrapers and company coverage resolve Deskera from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'deskera')
  const scraper = buildScrapers().find((item) => item.name === 'deskera')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Deskera')
  assert.equal(provider.companyCareerPage, 'https://www.linkedin.com/jobs/deskera-jobs')
  assert.match(scraper.dryRunFile, /deskera[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Deskera\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Deskera', 'deskera', 'Deskera']],
  )
})
