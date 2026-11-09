import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/nineleapstechnologysolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nineleapstechnologysolutions/catalog.js')
  } catch {
    assert.fail('Expected Nineleaps Technology Solutions catalog module at ../../scraper/nineleapstechnologysolutions/catalog.js')
  }
}

test('Nineleaps Technology Solutions local catalog captures the verified first-party careers and jobs surfaces', async () => {
  const { NINELEAPS_TECHNOLOGY_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NINELEAPS_TECHNOLOGY_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, NINELEAPS_TECHNOLOGY_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'nineleapstechnologysolutions')
  assert.equal(provider.companyName, 'Nineleaps Technology Solutions')
  assert.equal(provider.officialBrandName, 'Nineleaps')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.nineleaps.com/')
  assert.equal(provider.companyCareerPage, 'https://www.nineleaps.com/jobs/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.nineleaps.com/careers/')
  assert.equal(provider.companyDomain, 'nineleaps.com')
  assert.equal(provider.atsPlatform, 'official-first-party-job-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-job-index')
  assert.equal(provider.extractionStrategy, 'first-party-job-card-list+detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /nineleapstechnologysolutions[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.nineleaps\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.nineleaps\.com\/jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /Full Stack Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /AI Engineer/i)
})

test('Nineleaps Technology Solutions exact backlog row resolves from the local provider contract', async () => {
  const { NINELEAPS_TECHNOLOGY_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Nineleaps Technology Solutions\n',
    catalog: [hydrateProviderCatalogEntry(NINELEAPS_TECHNOLOGY_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nineleaps Technology Solutions', 'nineleapstechnologysolutions', 'Nineleaps Technology Solutions']],
  )
})
