import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sterlingsoftwareprivatelimited/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sterlingsoftwareprivatelimited/catalog.js')
  } catch {
    assert.fail('Expected Sterling Software Private Limited catalog module at ../../scraper/sterlingsoftwareprivatelimited/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sterlingsoftwareprivatelimited/script.js')
  } catch {
    assert.fail('Expected Sterling Software Private Limited scraper module at ../../scraper/sterlingsoftwareprivatelimited/script.js')
  }
}

test('Sterling Software Private Limited local catalog captures the verified careers page and public-opening extractor contract', async () => {
  const {
    STERLING_SOFTWARE_PRIVATE_LIMITED_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const sterlingSoftware = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(STERLING_SOFTWARE_PRIVATE_LIMITED_CATALOG)

  assert.equal(defaultCatalog, STERLING_SOFTWARE_PRIVATE_LIMITED_CATALOG)
  assert.equal(provider.source, 'sterlingsoftwareprivatelimited')
  assert.equal(provider.companyName, 'Sterling Software Private Limited')
  assert.equal(provider.officialBrandName, 'Sterling')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://sterlingsoftware.global/')
  assert.equal(provider.companyCareerPage, 'https://sterlingsoftware.global/career/')
  assert.equal(provider.atsPlatform, 'official-company-site-public-job-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-table-plus-public-detail-pages',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+public-opening-table+public-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sterlingsoftware.global')
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.match(provider.verifiedSurfaceSummary, /Wednesday, August 5, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/sterlingsoftware\.global\/career\//i)
  assert.match(provider.verifiedSurfaceSummary, /Application Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Java/i)
  assert.match(provider.verifiedSurfaceSummary, /application-engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /java-architect/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /sterlingsoftwareprivatelimited[\\/]jobs\.json$/i)

  assert.equal(sterlingSoftware.PROVIDER_METADATA.source, provider.source)
  assert.equal(sterlingSoftware.PROVIDER_METADATA.companyName, provider.companyName)
})

test('Sterling Software Private Limited coverage resolves the backlog company row without aliases', async () => {
  const { STERLING_SOFTWARE_PRIVATE_LIMITED_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sterling Software Private Limited\n',
    catalog: [hydrateProviderCatalogEntry(STERLING_SOFTWARE_PRIVATE_LIMITED_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sterling Software Private Limited', 'sterlingsoftwareprivatelimited', 'Sterling Software Private Limited']],
  )
})
