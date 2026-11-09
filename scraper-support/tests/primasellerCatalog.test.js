import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const primasellerModulePath = path.resolve(currentDir, '../../scraper/primaseller/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/primaseller/catalog.js')
  } catch {
    assert.fail('Expected Primaseller catalog module at ../../scraper/primaseller/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/primaseller/script.js')
  } catch {
    assert.fail('Expected Primaseller scraper module at ../../scraper/primaseller/script.js')
  }
}

test('Primaseller local catalog captures the exact-name redirect and expired legacy subdomain sentinel contract', async () => {
  const { PRIMASELLER_CATALOG } = await loadCatalogModule()
  const primaseller = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(PRIMASELLER_CATALOG)

  assert.equal(provider.source, 'primaseller')
  assert.equal(provider.companyName, 'Primaseller')
  assert.equal(provider.officialBrandName, 'Primaseller')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.primaseller.com/')
  assert.equal(provider.companyCareerPage, 'https://www.primaseller.com/')
  assert.equal(provider.legacyAboutPageUrl, 'https://help.primaseller.com/about-us')
  assert.equal(provider.legacyFsLinkUrl, 'https://fslink.primaseller.com/')
  assert.equal(provider.redirectTargetUrl, 'https://www.delhivery.com/solutions/d2c-brands')
  assert.equal(provider.companyDomain, 'primaseller.com')
  assert.equal(provider.atsPlatform, 'exact-name-homepage-redirect-plus-legacy-subdomain-tls-failure')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'redirect-validation-plus-legacy-subdomain-tls-failure-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-redirect-to-delhivery+verified-help-and-fslink-expired-tls-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /primaseller[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, primasellerModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.primaseller\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/help\.primaseller\.com\/about-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/fslink\.primaseller\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /Delhivery/i)
  assert.match(provider.verifiedSurfaceSummary, /expired/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Primaseller'), false)

  assert.equal(primaseller.PROVIDER_METADATA.source, PRIMASELLER_CATALOG.source)
  assert.equal(primaseller.PROVIDER_METADATA.companyName, PRIMASELLER_CATALOG.companyName)
  assert.equal(
    primaseller.PROVIDER_METADATA.redirectTargetUrl,
    PRIMASELLER_CATALOG.redirectTargetUrl,
  )
})

test('Primaseller backlog row matches directly from the local catalog without alias churn', async () => {
  const { PRIMASELLER_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Primaseller\n',
    catalog: [hydrateProviderCatalogEntry(PRIMASELLER_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Primaseller', 'primaseller', 'Primaseller']],
  )
})

test('getScraperCatalog exposes Primaseller as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'primaseller')
  const scraper = buildScrapers().find((item) => item.name === 'primaseller')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Primaseller')
  assert.equal(provider.companyCareerPage, 'https://www.primaseller.com/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Primaseller'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Primaseller\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Primaseller', 'primaseller', 'Primaseller']],
  )
})
