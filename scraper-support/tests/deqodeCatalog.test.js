import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/deqode/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/deqode/catalog.js')
  } catch {
    assert.fail('Expected Deqode catalog module at ../../scraper/deqode/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/deqode/script.js')
  } catch {
    assert.fail('Expected Deqode scraper module at ../../scraper/deqode/script.js')
  }
}

test('Deqode local catalog captures the verified first-party careers page and linked job detail surface', async () => {
  const { DEQODE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const deqode = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(DEQODE_CATALOG)

  assert.equal(defaultCatalog, DEQODE_CATALOG)
  assert.equal(provider.source, 'deqode')
  assert.equal(provider.companyName, 'Deqode')
  assert.equal(provider.officialBrandName, 'Deqode Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://deqode.com/')
  assert.equal(provider.companyCareerPage, 'https://www.deqode.com/career')
  assert.equal(provider.verifiedSampleJobUrl, 'https://deqode.com/career/python-developer-1')
  assert.equal(provider.verifiedSampleJobTitle, 'Python Developer')
  assert.equal(provider.companyDomain, 'deqode.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-with-linked-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+linked-detail-pages+inline-first-party-apply-flow',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.verifiedPublicJobCount, 1)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.deqode\.com\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/deqode\.com\/career\/python-developer-1/i)
  assert.match(provider.verifiedSurfaceSummary, /Python Developer/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /deqode[\\/]jobs\.json$/i)

  assert.equal(deqode.PROVIDER_METADATA.source, provider.source)
  assert.equal(deqode.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Deqode exact backlog row resolves from the local provider contract without aliases', async () => {
  const { DEQODE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Deqode\n',
    catalog: [hydrateProviderCatalogEntry(DEQODE_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Deqode', 'deqode', 'Deqode']],
  )
})
