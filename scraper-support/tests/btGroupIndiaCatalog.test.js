import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/btgroupindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/btgroupindia/catalog.js')
  } catch {
    assert.fail('Expected BT Group India catalog module at ../../scraper/btgroupindia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/btgroupindia/script.js')
  } catch {
    assert.fail('Expected BT Group India scraper module at ../../scraper/btgroupindia/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('BT Group India local catalog captures the verified first-party careers handoff and jobs feed surface', async () => {
  const { BT_GROUP_INDIA_CATALOG } = await loadCatalogModule()
  const btGroupIndia = await loadScraperModule()
  const provider = buildCatalogReadyProvider(BT_GROUP_INDIA_CATALOG)

  assert.equal(provider.source, 'btgroupindia')
  assert.equal(provider.companyName, 'BT Group India')
  assert.equal(provider.officialBrandName, 'BT Group plc')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.bt.com/')
  assert.equal(provider.corporateAboutUrl, 'https://www.bt.com/about')
  assert.equal(provider.companyCareerPage, 'https://jobs.bt.com/')
  assert.equal(
    provider.indiaSearchUrl,
    'https://jobs.bt.com/search/?createNewAlert=false&q=&locationsearch=India',
  )
  assert.equal(provider.sitemapUrl, 'https://jobs.bt.com/sitemap.xml')
  assert.equal(provider.jobsFeedUrl, 'https://jobs.bt.com/sitemap_index.xml')
  assert.equal(
    provider.verifiedIndiaJobUrl,
    'https://jobs.bt.com/BT/job/Bengaluru-Software-Engineering-Professional-560103/1366481557/',
  )
  assert.equal(provider.companyDomain, 'jobs.bt.com')
  assert.equal(provider.atsPlatform, 'first-party-rss-jobs-feed')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-rss-feed-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-bt-about-careers-handoff+verified-jobs-bt-india-search+first-party-rss-feed+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.bt\.com\/about/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.bt\.com\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/jobs\.bt\.com\/search\/\?createNewAlert=false&q=&locationsearch=India/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.bt\.com\/sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.bt\.com\/sitemap_index\.xml/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/jobs\.bt\.com\/BT\/job\/Bengaluru-Software-Engineering-Professional-560103\/1366481557\//i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b26 India jobs\b/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /btgroupindia[\\/]jobs\.json$/i)

  assert.equal(btGroupIndia.PROVIDER_METADATA.source, provider.source)
  assert.equal(btGroupIndia.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(btGroupIndia.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(btGroupIndia.PROVIDER_METADATA.jobsFeedUrl, provider.jobsFeedUrl)
})

test('BT Group India exact backlog name matches from the local provider contract without aliases', async () => {
  const { BT_GROUP_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'BT Group India\n',
    catalog: [buildCatalogReadyProvider(BT_GROUP_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['BT Group India', 'btgroupindia', 'BT Group India']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'BT Group India'), false)
})
