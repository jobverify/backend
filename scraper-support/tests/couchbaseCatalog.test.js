import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const couchbaseModulePath = path.resolve(currentDir, '../../scraper/couchbase/script.js')

const loadCouchbaseModule = async () => {
  try {
    return await import('../../scraper/couchbase/script.js')
  } catch {
    assert.fail('Expected Couchbase scraper module at ../../scraper/couchbase/script.js')
  }
}

const buildCatalogReadyProvider = (couchbase) =>
  hydrateProviderCatalogEntry({
    source: couchbase.SOURCE,
    companyName: couchbase.COMPANY,
    adapter: 'script',
    atsPlatform: 'greenhouse',
    companyCareerPage: couchbase.CAREERS_URL,
    paginationStrategy: 'official-careers-page-inline-greenhouse-api',
    extractionStrategy: 'official-careers-page+inline-greenhouse-jobs-api+greenhouse-job-detail-pages',
    parser: 'custom-script',
    modulePath: couchbaseModulePath,
  })

test('Couchbase exposes catalog-ready official careers metadata for a Greenhouse-backed script scraper', async () => {
  const couchbase = await loadCouchbaseModule()
  const provider = buildCatalogReadyProvider(couchbase)

  assert.equal(provider.companyName, 'Couchbase')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.companyCareerPage, 'https://www.couchbase.com/careers/')
  assert.equal(provider.companyDomain, 'couchbase.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-inline-greenhouse-api')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page+inline-greenhouse-jobs-api+greenhouse-job-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /couchbase[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /couchbase[\\/]jobs\.json$/i)
})

test('Couchbase matches company coverage directly from provider metadata without aliases', async () => {
  const couchbase = await loadCouchbaseModule()
  const provider = buildCatalogReadyProvider(couchbase)

  const report = generateCompanyCoverageReport({
    csvText: 'Couchbase,\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'couchbase')
})
