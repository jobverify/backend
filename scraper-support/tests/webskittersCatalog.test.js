import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/webskitters/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/webskitters/catalog.js')
  } catch {
    assert.fail('Expected Webskitters catalog module at ../../scraper/webskitters/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/webskitters/script.js')
  } catch {
    assert.fail('Expected Webskitters scraper module at ../../scraper/webskitters/script.js')
  }
}

test('Webskitters local catalog captures the verified WPJobBoard empty state and fail-closed contract', async () => {
  const { WEBSKITTERS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const webskitters = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(WEBSKITTERS_CATALOG)

  assert.equal(defaultCatalog, WEBSKITTERS_CATALOG)
  assert.equal(provider.source, 'webskitters')
  assert.equal(provider.companyName, 'Webskitters')
  assert.equal(provider.officialBrandName, 'Webskitters')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.webskitters.com/')
  assert.equal(provider.companyCareerPage, 'https://www.webskitters.com/career')
  assert.equal(provider.officialCareersPageUrl, 'https://www.webskitters.com/career')
  assert.equal(provider.companyDomain, 'webskitters.com')
  assert.equal(provider.atsPlatform, 'official-careers-page-wpjobboard-empty-state')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-page-wpjobboard-empty-state-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-wpjobboard-empty-state+return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.webskitters\.com\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /No job listings found/i)
  assert.match(provider.verifiedSurfaceSummary, /WPJobBoard/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /webskitters[\\/]jobs\.json$/i)

  assert.equal(webskitters.PROVIDER_METADATA.source, provider.source)
  assert.equal(webskitters.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Webskitters exact backlog row resolves from the local provider contract without aliases', async () => {
  const { WEBSKITTERS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Webskitters\n',
    catalog: [hydrateProviderCatalogEntry(WEBSKITTERS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Webskitters', 'webskitters', 'Webskitters']],
  )
})
