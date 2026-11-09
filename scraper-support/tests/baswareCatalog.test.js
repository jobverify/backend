import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/basware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/basware/catalog.js')
  } catch {
    assert.fail('Expected Basware catalog module at ../../scraper/basware/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/basware/script.js')
  } catch {
    assert.fail('Expected Basware scraper module at ../../scraper/basware/script.js')
  }
}

test('Basware local catalog describes current native extraction without asserting inventory totals', async () => {
  const { BASWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const basware = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(BASWARE_CATALOG)

  assert.equal(defaultCatalog, BASWARE_CATALOG)
  assert.equal(provider.source, 'basware')
  assert.equal(provider.companyName, 'Basware')
  assert.equal(provider.officialBrandName, 'Basware')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.basware.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.basware.com/')
  assert.equal(provider.officialCareersPageUrl, 'https://careers.basware.com/')
  assert.equal(provider.companyDomain, 'basware.com')
  assert.equal(provider.atsPlatform, 'jobylon-native-widget')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-inline-widget-array-and-closing-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'current-first-party-group-binding+native-widget-records+verified-full-role-details',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.basware\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /jobylon-jobs-widget/i)
  assert.match(provider.verifiedSurfaceSummary, /cdn\.jobylon\.com\/embedder\.js/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /basware[\\/]jobs\.json$/i)

  assert.equal(basware.PROVIDER_METADATA.source, provider.source)
  assert.equal(basware.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Basware exact backlog row resolves from the local provider contract without aliases', async () => {
  const { BASWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Basware\n',
    catalog: [hydrateProviderCatalogEntry(BASWARE_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Basware', 'basware', 'Basware']],
  )
})
