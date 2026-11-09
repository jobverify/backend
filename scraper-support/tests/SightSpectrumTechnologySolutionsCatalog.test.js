import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sightspectrumtechnologysolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sightspectrumtechnologysolutions/catalog.js')
  } catch {
    assert.fail('Expected SightSpectrum Technology Solutions catalog module at ../../scraper/sightspectrumtechnologysolutions/catalog.js')
  }
}

test('SightSpectrum Technology Solutions local catalog captures the verified first-party careers surface', async () => {
  const { SIGHTSPECTRUM_TECHNOLOGY_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SIGHTSPECTRUM_TECHNOLOGY_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, SIGHTSPECTRUM_TECHNOLOGY_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'sightspectrumtechnologysolutions')
  assert.equal(provider.companyName, 'SightSpectrum Technology Solutions')
  assert.equal(provider.officialBrandName, 'SightSpectrum')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sightspectrum.com/')
  assert.equal(provider.companyCareerPage, 'https://www.sightspectrum.com/careers')
  assert.equal(provider.companyDomain, 'sightspectrum.com')
  assert.equal(provider.atsPlatform, 'official-first-party-job-sections')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-open-roles')
  assert.equal(provider.extractionStrategy, 'first-party-inline-job-sections')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /sightspectrumtechnologysolutions[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Data Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /UI\/UX Designer/i)
})

test('SightSpectrum Technology Solutions exact backlog row resolves from the local provider contract', async () => {
  const { SIGHTSPECTRUM_TECHNOLOGY_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SightSpectrum Technology Solutions\n',
    catalog: [hydrateProviderCatalogEntry(SIGHTSPECTRUM_TECHNOLOGY_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SightSpectrum Technology Solutions', 'sightspectrumtechnologysolutions', 'SightSpectrum Technology Solutions']],
  )
})
