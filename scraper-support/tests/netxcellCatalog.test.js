import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/netxcell/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/netxcell/catalog.js')
  } catch {
    assert.fail('Expected Netxcell catalog module at ../../scraper/netxcell/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/netxcell/script.js')
  } catch {
    assert.fail('Expected Netxcell scraper module at ../../scraper/netxcell/script.js')
  }
}

test('Netxcell local catalog captures the verified first-party careers page and detail pages', async () => {
  const { NETXCELL_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const netxcell = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(NETXCELL_CATALOG)

  assert.equal(defaultCatalog, NETXCELL_CATALOG)
  assert.equal(provider.source, 'netxcell')
  assert.equal(provider.companyName, 'Netxcell')
  assert.equal(provider.officialBrandName, 'Netxcell Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.netxcell.com/careers.php')
  assert.deepEqual(provider.detailPageUrls, [
    'https://www.netxcell.com/enterprise-sales-manager.php',
    'https://www.netxcell.com/arcallingexperience.php',
    'https://www.netxcell.com/business-development-mannager.php',
    'https://www.netxcell.com/linux-administrator.php',
  ])
  assert.equal(provider.companyDomain, 'netxcell.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-listing-plus-first-party-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+first-party-detail-pages+same-page-application-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /netxcell[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.netxcell\.com\/careers\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /enterprise-sales-manager\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /arcallingexperience\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /business-development-mannager\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /linux-administrator\.php/i)

  assert.equal(netxcell.PROVIDER_METADATA.source, NETXCELL_CATALOG.source)
  assert.equal(netxcell.PROVIDER_METADATA.companyName, NETXCELL_CATALOG.companyName)
  assert.equal(netxcell.PROVIDER_METADATA.companyCareerPage, NETXCELL_CATALOG.companyCareerPage)
})

test('Netxcell exact backlog name matches directly from local provider metadata', async () => {
  const { NETXCELL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Netxcell\n',
    catalog: [hydrateProviderCatalogEntry(NETXCELL_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Netxcell', 'netxcell', 'Netxcell']],
  )
})

test('Netxcell hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { NETXCELL_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NETXCELL_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Netxcell')
  assert.equal(provider.companyCareerPage, 'https://www.netxcell.com/careers.php')
  assert.equal(provider.companyDomain, 'netxcell.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.modulePath, /netxcell[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /netxcell[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
