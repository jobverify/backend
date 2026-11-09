import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/qentelli/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/qentelli/catalog.js')
  } catch {
    assert.fail('Expected Qentelli catalog module at ../../scraper/qentelli/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Qentelli local catalog captures the verified first-party 403-blocked surface with no trustworthy bot-accessible jobs page', async () => {
  const { QENTELLI_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(QENTELLI_CATALOG)

  assert.equal(defaultCatalog, QENTELLI_CATALOG)
  assert.equal(provider.source, 'qentelli')
  assert.equal(provider.companyName, 'Qentelli')
  assert.equal(provider.officialBrandName, 'Qentelli')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.qentelli.com/')
  assert.equal(provider.companyCareerPage, 'https://www.qentelli.com/careers')
  assert.equal(provider.blockedJobsPageUrl, 'https://www.qentelli.com/jobs')
  assert.equal(provider.atsPlatform, 'first-party-403-blocked-no-trustworthy-public-jobs-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'blocked-surface')
  assert.equal(provider.extractionStrategy, 'verified-first-party-403-routes-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'qentelli.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /403/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy bot-accessible public jobs surface/i)
})

test('Qentelli exact backlog row resolves from the local provider contract', async () => {
  const { QENTELLI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Qentelli\n',
    catalog: [buildCatalogReadyProvider(QENTELLI_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Qentelli', 'qentelli', 'Qentelli']],
  )
})
