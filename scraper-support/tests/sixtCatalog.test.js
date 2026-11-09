import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sixt/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sixt/catalog.js')
  } catch {
    assert.fail('Expected Sixt catalog module at ../../scraper/sixt/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/sixt/script.js')
  } catch {
    assert.fail('Expected Sixt scraper module at ../../scraper/sixt/script.js')
  }
}

test('Sixt local catalog captures the verified first-party India jobs surface', async () => {
  const { SIXT_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sixt = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SIXT_CATALOG)

  assert.equal(defaultCatalog, SIXT_CATALOG)
  assert.equal(provider.source, 'sixt')
  assert.equal(provider.companyName, 'Sixt')
  assert.equal(provider.officialBrandName, 'SIXT')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sixt.jobs/in/about-us')
  assert.equal(provider.companyCareerPage, 'https://www.sixt.jobs/in/jobs?q=&country=IN')
  assert.equal(provider.officialCareersPageUrl, 'https://www.sixt.jobs/in/jobs?q=&country=IN')
  assert.equal(provider.detailPagePrefix, 'https://www.sixt.jobs/in/jobs/')
  assert.equal(provider.companyDomain, 'sixt.jobs')
  assert.equal(provider.atsPlatform, 'first-party-careers-site')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-india-listing-page+first-party-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-india-jobs-page+visible-job-links+first-party-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-27')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /sixt[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Monday, July 27, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sixt\.jobs\/in\/about-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sixt\.jobs\/in\/jobs\?q=&country=IN/i)
  assert.match(provider.verifiedSurfaceSummary, /\b9 public India roles\b/i)
  assert.match(provider.verifiedSurfaceSummary, /Security Engineer II \(AI\)/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Development Engineer II \(Golang\)/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Product Manager II \(Salesforce\)/i)
  assert.match(provider.verifiedSurfaceSummary, /Staff Data Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /About us section/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sixt'), false)

  assert.equal(sixt.PROVIDER_METADATA.source, SIXT_CATALOG.source)
  assert.equal(sixt.PROVIDER_METADATA.companyName, SIXT_CATALOG.companyName)
  assert.equal(sixt.PROVIDER_METADATA.companyCareerPage, SIXT_CATALOG.companyCareerPage)
})

test('Sixt exact backlog row matches directly from the local provider metadata without aliases', async () => {
  const { SIXT_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sixt\n',
    catalog: [hydrateProviderCatalogEntry(SIXT_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sixt', 'sixt', 'Sixt']],
  )
})
