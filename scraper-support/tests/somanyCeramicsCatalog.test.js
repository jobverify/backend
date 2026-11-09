import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/somanyceramics/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/somanyceramics/catalog.js')
  } catch {
    assert.fail('Expected Somany Ceramics catalog module at ../../scraper/somanyceramics/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/somanyceramics/script.js')
  } catch {
    assert.fail('Expected Somany Ceramics scraper module at ../../scraper/somanyceramics/script.js')
  }
}

test('Somany Ceramics local catalog captures the verified first-party careers page and Goodfit handoff', async () => {
  const { SOMANY_CERAMICS_CATALOG } = await loadCatalogModule()
  const somanyCeramics = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SOMANY_CERAMICS_CATALOG)

  assert.equal(provider.source, 'somanyceramics')
  assert.equal(provider.companyName, 'Somany Ceramics')
  assert.equal(provider.officialBrandName, 'Somany Ceramics Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.somanyceramics.com/work-with-us')
  assert.equal(provider.jobsBoardUrl, 'https://www.somanyceramics.com/work-with-us')
  assert.equal(provider.officialHandoffHost, 'https://v2.app.goodfit.so')
  assert.equal(
    provider.verifiedSampleApplyUrl,
    'https://v2.app.goodfit.so/jobs/somany-ceramics-tiles/Area-Sales-Manager-Agra?id=8e35b993-a160-4816-bb19-2414c5a518b4',
  )
  assert.equal(provider.companyDomain, 'somanyceramics.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-with-goodfit-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-careers-page-inline-job-cards',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-job-cards+goodfit-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-27')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /somanyceramics[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Monday, July 27, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.somanyceramics\.com\/work-with-us/i)
  assert.match(provider.verifiedSurfaceSummary, /Opportunities that grow with you/i)
  assert.match(provider.verifiedSurfaceSummary, /v2\.app\.goodfit\.so/i)
  assert.match(provider.verifiedSurfaceSummary, /Area Sales Manager/i)

  assert.equal(somanyCeramics.PROVIDER_METADATA.source, SOMANY_CERAMICS_CATALOG.source)
  assert.equal(somanyCeramics.CAREERS_URL, SOMANY_CERAMICS_CATALOG.companyCareerPage)
  assert.equal(somanyCeramics.GOODFIT_HOST, SOMANY_CERAMICS_CATALOG.officialHandoffHost)
})

test('Somany Ceramics exact-name backlog rows resolve directly from the local catalog without aliases', async () => {
  const { SOMANY_CERAMICS_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Somany Ceramics\n',
    catalog: [hydrateProviderCatalogEntry(SOMANY_CERAMICS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Somany Ceramics', 'somanyceramics', 'Somany Ceramics']],
  )
})
