import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/meditabsoftware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/meditabsoftware/catalog.js')
  } catch {
    assert.fail('Expected Meditab Software catalog module at ../../scraper/meditabsoftware/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/meditabsoftware/script.js')
  } catch {
    assert.fail('Expected Meditab Software scraper module at ../../scraper/meditabsoftware/script.js')
  }
}

test('Meditab Software local catalog captures the verified first-party careers page and fail-closed sentinel contract', async () => {
  const { MEDITAB_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const meditabSoftware = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(MEDITAB_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, MEDITAB_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'meditabsoftware')
  assert.equal(provider.companyName, 'Meditab Software')
  assert.equal(provider.officialBrandName, 'Meditab')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.meditab.com/')
  assert.equal(provider.companyCareerPage, 'https://www.meditab.com/company/our-careers')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-job-records')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-page-without-public-job-records',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+returns-empty-array',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'meditab.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.meditab\.com\/company\/our-careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Find your Next Career/i)
  assert.match(provider.verifiedSurfaceSummary, /recruitment@meditab\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no public job records/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /meditabsoftware[\\/]jobs\.json$/i)

  assert.equal(meditabSoftware.PROVIDER_METADATA.source, provider.source)
  assert.equal(meditabSoftware.PROVIDER_METADATA.companyName, provider.companyName)
})

test('Meditab Software coverage resolves the backlog company row without aliases', async () => {
  const { MEDITAB_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Meditab Software\n',
    catalog: [hydrateProviderCatalogEntry(MEDITAB_SOFTWARE_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Meditab Software', 'meditabsoftware', 'Meditab Software']],
  )
})
