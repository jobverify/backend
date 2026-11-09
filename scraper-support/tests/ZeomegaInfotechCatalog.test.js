import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/zeomegainfotech/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/zeomegainfotech/catalog.js')
  } catch {
    assert.fail('Expected Zeomega Infotech catalog module at ../../scraper/zeomegainfotech/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/zeomegainfotech/script.js')
  } catch {
    assert.fail('Expected Zeomega Infotech scraper module at ../../scraper/zeomegainfotech/script.js')
  }
}

test('Zeomega Infotech local catalog captures the verified India careers handoff and blocked SuccessFactors board', async () => {
  const { ZEOMEGA_INFOTECH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const zeomega = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(ZEOMEGA_INFOTECH_CATALOG)

  assert.equal(defaultCatalog, ZEOMEGA_INFOTECH_CATALOG)
  assert.equal(provider.source, 'zeomegainfotech')
  assert.equal(provider.companyName, 'Zeomega Infotech')
  assert.equal(provider.officialBrandName, 'ZeOmega')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.zeomega.com/')
  assert.equal(provider.companyCareerPage, 'https://www.zeomega.com/company/careers-india')
  assert.match(provider.boardUrl, /^https:\/\/career10\.successfactors\.com\/career\?company=zeomegainf/i)
  assert.equal(provider.companyDomain, 'zeomega.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-handoff+blocked-successfactors')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-india-careers-page-plus-erroring-successfactors-handoff')
  assert.equal(
    provider.extractionStrategy,
    'verified-india-careers-page+verified-blocked-successfactors-handoff-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Careers \(India\)/i)
  assert.match(provider.verifiedSurfaceSummary, /Available Careers/i)
  assert.match(provider.verifiedSurfaceSummary, /An error occurred while processing your request/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /zeomegainfotech[\\/]jobs\.json$/i)

  assert.equal(zeomega.PROVIDER_METADATA.source, provider.source)
  assert.equal(zeomega.PROVIDER_METADATA.boardUrl, provider.boardUrl)
})

test('Zeomega Infotech exact backlog row resolves from the local provider contract', async () => {
  const { ZEOMEGA_INFOTECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Zeomega Infotech\n',
    catalog: [hydrateProviderCatalogEntry(ZEOMEGA_INFOTECH_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Zeomega Infotech', 'zeomegainfotech', 'Zeomega Infotech']],
  )
})
