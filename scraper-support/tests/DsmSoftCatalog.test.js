import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/dsmsoft/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dsmsoft/catalog.js')
  } catch {
    assert.fail('Expected DSM SOFT catalog module at ../../scraper/dsmsoft/catalog.js')
  }
}

test('DSM SOFT local catalog captures the verified resume-only first-party careers surface', async () => {
  const { DSM_SOFT_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(DSM_SOFT_CATALOG)

  assert.equal(defaultCatalog, DSM_SOFT_CATALOG)
  assert.equal(provider.source, 'dsmsoft')
  assert.equal(provider.companyName, 'DSM SOFT')
  assert.equal(provider.officialBrandName, 'DSM Soft')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://dsmsoft.com/')
  assert.equal(provider.companyCareerPage, 'https://dsmsoft.com/Careers.aspx')
  assert.equal(provider.companyDomain, 'dsmsoft.com')
  assert.equal(provider.atsPlatform, 'official-first-party-resume-intake-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-form-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-form-without-trustworthy-public-job-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /dsmsoft[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Interested candidates can send the resume to/i)
  assert.match(provider.verifiedSurfaceSummary, /hr_team@dsmsoft\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public job listings/i)
})

test('DSM SOFT exact backlog row resolves from the local provider contract', async () => {
  const { DSM_SOFT_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'DSM SOFT\n',
    catalog: [hydrateProviderCatalogEntry(DSM_SOFT_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DSM SOFT', 'dsmsoft', 'DSM SOFT']],
  )
})
