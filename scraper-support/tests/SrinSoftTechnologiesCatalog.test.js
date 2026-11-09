import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/srinsofttechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/srinsofttechnologies/catalog.js')
  } catch {
    assert.fail('Expected SrinSoft Technologies catalog module at ../../scraper/srinsofttechnologies/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/srinsofttechnologies/script.js')
  } catch {
    assert.fail('Expected SrinSoft Technologies scraper module at ../../scraper/srinsofttechnologies/script.js')
  }
}

test('SrinSoft Technologies local catalog captures the verified first-party accordion careers page', async () => {
  const { SRINSOFT_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const srinsoft = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SRINSOFT_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, SRINSOFT_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'srinsofttechnologies')
  assert.equal(provider.companyName, 'SrinSoft Technologies')
  assert.equal(provider.officialBrandName, 'SrinSoft')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.srinsofttech.com/')
  assert.equal(provider.companyCareerPage, 'https://www.srinsofttech.com/career.html')
  assert.equal(provider.applyFormUrl, 'https://www.srinsofttech.com/career.html#form_sec')
  assert.equal(provider.contactEmail, 'tms@srinsofttech.com')
  assert.equal(provider.atsPlatform, 'official-first-party-accordion-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-accordion-list')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-accordion-jobs+common-apply-form+india-location-filter',
  )
  assert.equal(provider.companyDomain, 'srinsofttech.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Test Engineer - QA/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior DevOps Engineer/i)
  assert.equal(srinsoft.APPLY_FORM_URL, provider.applyFormUrl)
})

test('SrinSoft Technologies exact backlog row resolves from the local catalog without aliases', async () => {
  const { SRINSOFT_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SrinSoft Technologies\n',
    catalog: [hydrateProviderCatalogEntry(SRINSOFT_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
