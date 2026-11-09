import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes TensorGo Software Pvt Ltd as an official current jobs API provider without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tensorgosoftwarepvtltd')

  assert.ok(provider)
  assert.equal(provider.companyName, 'TensorGo Software Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-jobs-api')
  assert.equal(provider.companyCareerPage, 'https://tensorgo.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'current-client-single-api-inventory-with-completeness-guards')
  assert.equal(provider.extractionStrategy, 'verified-tensorgo-humain-shell+observed-current-bundle-api-binding+live-api-inventory+matching-full-details+explicit-india-filter')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tensorgo.com')
  assert.match(provider.modulePath, /tensorgosoftwarepvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'TensorGo Software Pvt Ltd'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'TensorGo'), false)
})

test('buildScrapers and company coverage resolve TensorGo Software Pvt Ltd directly from provider metadata', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tensorgosoftwarepvtltd')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tensorgosoftwarepvtltd[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'tensorgosoftwarepvtltd')

  const report = generateCompanyCoverageReport({
    csvText: 'TensorGo Software Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TensorGo Software Pvt Ltd', 'tensorgosoftwarepvtltd', 'TensorGo Software Pvt Ltd']],
  )
})
