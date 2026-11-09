import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const aptaraModulePath = path.resolve(currentDir, '../../scraper/aptara/script.js')

const loadAptaraCatalog = async () => {
  try {
    return await import('../../scraper/aptara/catalog.js')
  } catch {
    assert.fail('Expected Aptara catalog module at ../../scraper/aptara/catalog.js')
  }
}

test('Aptara catalog captures the verified first-party careers page with inline India job cards', async () => {
  const { APTARA_CATALOG } = await loadAptaraCatalog()
  const provider = hydrateProviderCatalogEntry(APTARA_CATALOG)

  assert.equal(provider.source, 'aptara')
  assert.equal(provider.companyName, 'Aptara')
  assert.equal(provider.officialBrandName, 'Aptara Corp')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.aptaracorp.com/careers/')
  assert.equal(provider.homepageUrl, 'https://www.aptaracorp.com/')
  assert.equal(provider.applyAnchorUrl, 'https://www.aptaracorp.com/careers/#applynow')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-role-cards+shared-first-party-apply-anchor+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'aptaracorp.com')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.aptaracorp\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.aptaracorp\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /Instructional Designer Manager \(IDM\)/i)
  assert.match(provider.verifiedSurfaceSummary, /Perungudi, Chennai/i)
  assert.match(provider.verifiedSurfaceSummary, /#applynow/i)
  assert.equal(provider.modulePath, aptaraModulePath)
})

test('Aptara backlog row matches directly from provider metadata without aliases', async () => {
  const { APTARA_CATALOG } = await loadAptaraCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Aptara\n',
    catalog: [hydrateProviderCatalogEntry(APTARA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aptara', 'aptara', 'Aptara']],
  )
})
