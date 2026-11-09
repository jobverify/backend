import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadPractoCatalog = async () => {
  try {
    return await import('../../scraper/practo/catalog.js')
  } catch {
    assert.fail('Expected Practo catalog module at ../../scraper/practo/catalog.js')
  }
}

test('Practo catalog captures the verified August 1, 2026 public Zwayam search contract', async () => {
  const { PRACTO_CATALOG } = await loadPractoCatalog()

  assert.equal(PRACTO_CATALOG.source, 'practo')
  assert.equal(PRACTO_CATALOG.companyName, 'Practo')
  assert.equal(PRACTO_CATALOG.officialBrandName, 'Practo')
  assert.equal(PRACTO_CATALOG.adapter, 'script')
  assert.equal(PRACTO_CATALOG.homepageUrl, 'https://www.practo.com/')
  assert.equal(PRACTO_CATALOG.companyCareerPage, 'https://careers.practo.com/practo/')
  assert.equal(PRACTO_CATALOG.companyDomain, 'practo.com')
  assert.equal(PRACTO_CATALOG.atsPlatform, 'zwayam-public-search')
  assert.equal(PRACTO_CATALOG.countryFilter, 'India')
  assert.equal(
    PRACTO_CATALOG.paginationStrategy,
    'official-careers-shell-plus-zwayam-search-pagination',
  )
  assert.equal(
    PRACTO_CATALOG.extractionStrategy,
    'verified-careers-shell+zwayam-search+zwayam-jobs-service-detail',
  )
  assert.equal(PRACTO_CATALOG.parser, 'custom-script')
  assert.equal(PRACTO_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(PRACTO_CATALOG.verifiedOn, '2026-08-01')
  assert.equal(PRACTO_CATALOG.officialSearchApiUrl, 'https://public.zwayam.com/jobs/search')
  assert.equal(PRACTO_CATALOG.zwayamCompanyId, 'MTYzMDI=')
  assert.equal(PRACTO_CATALOG.zwayamDetailCompanyId, '16302')
  assert.match(PRACTO_CATALOG.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(PRACTO_CATALOG.verifiedSurfaceSummary, /Practo \| Careers/i)
  assert.match(PRACTO_CATALOG.verifiedSurfaceSummary, /rendered current openings/i)
  assert.match(PRACTO_CATALOG.verifiedSurfaceSummary, /\b13 live India openings\b/i)
  assert.match(PRACTO_CATALOG.verifiedSurfaceSummary, /Creative Strategist Manager/i)
  assert.match(PRACTO_CATALOG.verifiedSurfaceSummary, /jobs-service\/v1\/jobs\/careersite/i)
  assert.match(PRACTO_CATALOG.modulePath, /scraper[\\/]practo[\\/]script\.js$/i)
  assert.match(PRACTO_CATALOG.dryRunFile, /practo[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Practo'), false)
})

test('getScraperCatalog exposes Practo as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'practo')
  const scraper = buildScrapers().find((item) => item.name === 'practo')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Practo')
  assert.equal(provider.companyCareerPage, 'https://careers.practo.com/practo/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Practo'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Practo\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Practo', 'practo', 'Practo']],
  )
})
