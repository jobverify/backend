import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/fordindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fordindia/catalog.js')
  } catch {
    assert.fail('Expected Ford India catalog module at ../../scraper/fordindia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/fordindia/script.js')
  } catch {
    assert.fail('Expected Ford India scraper module at ../../scraper/fordindia/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Ford India local catalog captures the verified India-filtered Ford TalentBrew public jobs surface', async () => {
  const { FORD_INDIA_CATALOG } = await loadCatalogModule()
  const fordIndia = await loadScraperModule()
  const provider = buildCatalogReadyProvider(FORD_INDIA_CATALOG)

  assert.equal(provider.source, 'fordindia')
  assert.equal(provider.companyName, 'Ford India')
  assert.equal(provider.officialBrandName, 'Ford Motor Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(
    provider.companyCareerPage,
    'https://www.careers.ford.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
  )
  assert.equal(provider.companyDomain, 'careers.ford.com')
  assert.equal(provider.atsPlatform, 'talentbrew-radancy')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.indiaFacetId, '1269750')
  assert.equal(provider.resultsPostUrl, 'https://www.careers.ford.com/search-jobs/resultspost')
  assert.equal(provider.verifiedIndiaResultCount, 23)
  assert.equal(provider.verifiedSampleJobTitle, 'Vehicle Technical Illustration Engineer')
  assert.equal(provider.paginationStrategy, 'resultspost-page-form')
  assert.equal(
    provider.extractionStrategy,
    'verified-india-filtered-ford-careers-page+public-resultspost-json-html-fragments+detail-jsonld',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.careers\.ford\.com\/search-jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /23 Results found/i)
  assert.match(provider.verifiedSurfaceSummary, /Country:\s*India/i)
  assert.match(provider.verifiedSurfaceSummary, /Chennai, India/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /fordindia[\\/]jobs\.json$/i)

  assert.equal(fordIndia.PROVIDER_METADATA.source, provider.source)
  assert.equal(fordIndia.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(fordIndia.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(fordIndia.PROVIDER_METADATA.resultsPostUrl, provider.resultsPostUrl)
})

test('Ford India exact backlog row matches from the local provider contract without aliases', async () => {
  const { FORD_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Ford India\n',
    catalog: [buildCatalogReadyProvider(FORD_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ford India', 'fordindia', 'Ford India']],
  )
})
