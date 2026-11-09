import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const provider = hydrateProviderCatalogEntry({
  source: 'conviva',
  company: 'Conviva',
  adapter: 'script',
  companyCareerPage: 'https://www.conviva.ai/job-listings/',
  atsPlatform: 'greenhouse',
  paginationStrategy: 'official-careers-page-plus-embedded-greenhouse-board',
  extractionStrategy: 'verified-careers-page+embedded-greenhouse-jobs-api+first-party-gh_jid-detail-handoff',
  parser: 'custom-script',
  modulePath: new URL('../../scraper/conviva/script.js', import.meta.url).pathname,
})

test('hydrateProviderCatalogEntry preserves the verified Conviva Greenhouse metadata contract', () => {
  assert.equal(provider.source, 'conviva')
  assert.equal(provider.companyName, 'Conviva')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.conviva.ai/job-listings/')
  assert.equal(provider.companyDomain, 'conviva.ai')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-embedded-greenhouse-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+embedded-greenhouse-jobs-api+first-party-gh_jid-detail-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /conviva[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /conviva[\\/]jobs\.json$/i)
})

test('company coverage resolves Conviva directly from the hydrated catalog entry without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Conviva,\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Conviva', 'conviva', 'Conviva']],
  )
})
