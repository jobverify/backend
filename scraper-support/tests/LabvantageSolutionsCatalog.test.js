import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/labvantage/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/labvantage/catalog.js')
  } catch {
    assert.fail('Expected Labvantage Solutions catalog module at ../../scraper/labvantage/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/labvantage/script.js')
  } catch {
    assert.fail('Expected Labvantage Solutions scraper module at ../../scraper/labvantage/script.js')
  }
}

test('Labvantage Solutions local catalog captures the verified first-party India openings section', async () => {
  const { LABVANTAGE_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const labvantage = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(LABVANTAGE_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, LABVANTAGE_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'labvantage')
  assert.equal(provider.companyName, 'Labvantage Solutions')
  assert.equal(provider.officialBrandName, 'LabVantage Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.labvantage.com/')
  assert.equal(provider.companyCareerPage, 'https://www.labvantage.com/who-we-are/careers/')
  assert.equal(provider.applicationEmail, 'teamhr@labvantage.com')
  assert.equal(provider.applicationUrl, 'mailto:teamhr@labvantage.com')
  assert.equal(provider.companyDomain, 'labvantage.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-regional-section-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+india-section-job-list+shared-email-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /teamhr@labvantage\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Software Engineer – Development/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Engineer – DevOps/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /labvantage[\\/]jobs\.json$/i)

  assert.equal(labvantage.PROVIDER_METADATA.source, provider.source)
  assert.equal(labvantage.PROVIDER_METADATA.applicationEmail, provider.applicationEmail)
})

test('Labvantage Solutions exact backlog row resolves from the local provider contract', async () => {
  const { LABVANTAGE_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Labvantage Solutions\n',
    catalog: [hydrateProviderCatalogEntry(LABVANTAGE_SOLUTIONS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Labvantage Solutions', 'labvantage', 'Labvantage Solutions']],
  )
})
