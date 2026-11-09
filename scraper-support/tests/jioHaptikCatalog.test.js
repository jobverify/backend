import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/haptik/catalog.js')
  } catch {
    assert.fail('Expected shared Haptik catalog module at ../../scraper/haptik/catalog.js')
  }
}

test('Jio Haptik is already represented by the integrated Haptik provider surface', async () => {
  const { HAPTIK_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(HAPTIK_CATALOG)
  const integratedProvider = getScraperCatalog().find((item) => item.source === 'haptik')

  assert.ok(integratedProvider)
  assert.equal(provider.source, 'haptik')
  assert.equal(provider.companyName, 'Haptik')
  assert.equal(provider.officialBrandName, 'Haptik')
  assert.equal(provider.companyCareerPage, 'https://www.haptik.ai/careers')
  assert.equal(provider.officialJobsBoardUrl, 'https://haptik.freshteam.com/jobs')
  assert.equal(provider.atsPlatform, 'freshteam')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.haptik\.ai\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/haptik\.freshteam\.com\/jobs/i)
  assert.equal(integratedProvider.companyName, 'Haptik')
  assert.equal(integratedProvider.companyCareerPage, provider.companyCareerPage)
  assert.equal(integratedProvider.atsPlatform, provider.atsPlatform)
})

test('Jio Haptik exact-name coverage is satisfied through the shared haptik alias rather than a duplicate provider', async () => {
  const { HAPTIK_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Jio Haptik\n',
    catalog: [hydrateProviderCatalogEntry(HAPTIK_CATALOG)],
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Jio Haptik', 'haptik', 'Haptik']],
  )
  assert.equal(companyAliases['Jio Haptik'], 'haptik')
})
