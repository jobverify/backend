import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const paisabazaarModulePath = path.resolve(currentDir, '../../scraper/paisabazaar/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/paisabazaar/catalog.js')
  } catch {
    assert.fail('Expected Paisabazaar catalog module at ../../scraper/paisabazaar/catalog.js')
  }
}

const loadPaisabazaarModule = async () => {
  try {
    return await import('../../scraper/paisabazaar/script.js')
  } catch {
    assert.fail('Expected Paisabazaar scraper module at ../../scraper/paisabazaar/script.js')
  }
}

test('Paisabazaar local catalog captures the verified first-party careers email-intake surface without public role detail pages', async () => {
  const { PAISABAZAAR_CATALOG } = await loadCatalogModule()
  const paisabazaar = await loadPaisabazaarModule()
  const provider = hydrateProviderCatalogEntry(PAISABAZAAR_CATALOG)

  assert.equal(provider.source, 'paisabazaar')
  assert.equal(provider.companyName, 'Paisabazaar')
  assert.equal(provider.officialBrandName, 'Paisabazaar.com')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.paisabazaar.com/careers')
  assert.equal(provider.legalCin, 'U74900HR2011PTC044581')
  assert.equal(provider.companyDomain, 'paisabazaar.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-email-intake')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-careers-page-email-intake')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+team-email-intake-without-public-role-pages-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.paisabazaar\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /careers\+tech@paisabazaar\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /careers\+product@paisabazaar\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /careers\+operations@paisabazaar\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public role-detail pages/i)
  assert.equal(provider.modulePath, paisabazaarModulePath)
  assert.match(provider.dryRunFile, /paisabazaar[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Paisabazaar'), false)

  assert.equal(paisabazaar.PROVIDER_METADATA.source, PAISABAZAAR_CATALOG.source)
  assert.equal(
    paisabazaar.PROVIDER_METADATA.companyCareerPage,
    PAISABAZAAR_CATALOG.companyCareerPage,
  )
})

test('Paisabazaar backlog row matches directly from local provider metadata without alias churn', async () => {
  const { PAISABAZAAR_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Paisabazaar\n',
    catalog: [hydrateProviderCatalogEntry(PAISABAZAAR_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Paisabazaar', 'paisabazaar', 'Paisabazaar']],
  )
})
