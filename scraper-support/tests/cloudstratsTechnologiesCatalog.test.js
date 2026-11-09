import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/cloudstratstechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/cloudstratstechnologies/catalog.js')
  } catch {
    assert.fail('Expected Cloudstrats Technologies catalog module at ../../scraper/cloudstratstechnologies/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Cloudstrats Technologies local catalog captures the verified first-party careers and apply surfaces', async () => {
  const { CLOUDSTRATS_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(CLOUDSTRATS_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, CLOUDSTRATS_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'cloudstratstechnologies')
  assert.equal(provider.companyName, 'Cloudstrats Technologies')
  assert.equal(provider.officialBrandName, 'Cloudstrats')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://cloudstrats.ai/')
  assert.equal(provider.companyCareerPage, 'https://cloudstrats.ai/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+job-detail-pages+first-party-apply-forms',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'cloudstrats.ai')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/cloudstrats\.ai\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /Cloud Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/cloudstrats\.ai\/apply\/1\//i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /cloudstratstechnologies[\\/]jobs\.json$/i)
})

test('Cloudstrats Technologies exact backlog row resolves from the local provider contract without aliases', async () => {
  const { CLOUDSTRATS_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Cloudstrats Technologies\n',
    catalog: [buildCatalogReadyProvider(CLOUDSTRATS_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Cloudstrats Technologies', 'cloudstratstechnologies', 'Cloudstrats Technologies']],
  )
})
