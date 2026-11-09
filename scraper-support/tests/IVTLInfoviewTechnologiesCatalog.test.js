import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/ivtlinfoviewtechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ivtlinfoviewtechnologies/catalog.js')
  } catch {
    assert.fail('Expected IVTL Infoview Technologies catalog module at ../../scraper/ivtlinfoviewtechnologies/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({ ...catalogEntry, modulePath })

test('IVTL Infoview Technologies local catalog captures the verified Works Applications India homepage handoff with no public careers surface', async () => {
  const { IVTL_INFOVIEW_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(IVTL_INFOVIEW_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, IVTL_INFOVIEW_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'ivtlinfoviewtechnologies')
  assert.equal(provider.companyName, 'IVTL Infoview Technologies')
  assert.equal(provider.officialBrandName, 'Works Applications (India)')
  assert.equal(provider.companyCareerPage, 'https://india.worksap.co.jp/')
  assert.equal(provider.atsPlatform, 'official-homepage-no-public-careers')
  assert.equal(provider.paginationStrategy, 'single-first-party-homepage-contact-validation-return-empty')
  assert.equal(provider.extractionStrategy, 'verified-first-party-homepage+legacy-infoview-branding+contact-only-handoff+no-public-openings')
  assert.equal(provider.companyDomain, 'india.worksap.co.jp')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Works Applications \(India\)/i)
  assert.match(provider.verifiedSurfaceSummary, /wai-hr@worksap\.co\.jp/i)
  assert.equal(provider.modulePath, modulePath)
})

test('IVTL Infoview Technologies exact backlog row resolves from the local provider contract', async () => {
  const { IVTL_INFOVIEW_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'IVTL Infoview Technologies\n',
    catalog: [buildProvider(IVTL_INFOVIEW_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
