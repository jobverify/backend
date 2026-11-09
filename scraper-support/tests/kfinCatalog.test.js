import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kfintechnologies/catalog.js')
  } catch {
    assert.fail('Expected KFin Technologies catalog module at ../../scraper/kfintechnologies/catalog.js')
  }
}

test('KFin exact-name is already represented by the KFin Technologies provider surface', async () => {
  const { KFIN_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(KFIN_TECHNOLOGIES_CATALOG)

  assert.equal(provider.source, 'kfintechnologies')
  assert.equal(provider.companyName, 'KFin Technologies')
  assert.equal(provider.officialBrandName, 'KFintech')
  assert.equal(provider.companyCareerPage, 'https://www.kfintech.com/career/')
  assert.equal(provider.officialJobsArchiveUrl, 'https://www.kfintech.com/jobs/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.kfintech\.com\/career\//i)
  assert.match(provider.verifiedSurfaceSummary, /8 public first-party job detail pages/i)
})

test('KFin exact-name coverage is satisfied through a KFin alias recommendation rather than a duplicate provider', async () => {
  const { KFIN_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'KFin\n',
    catalog: [hydrateProviderCatalogEntry(KFIN_TECHNOLOGIES_CATALOG)],
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['KFin', 'kfintechnologies', 'KFin Technologies']],
  )
  assert.equal(companyAliases.KFin, 'kfintechnologies')
})
