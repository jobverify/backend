import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes LatentView Analytics as an official-site Darwinbox script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'latentviewanalytics')

  assert.ok(provider)
  assert.equal(provider.companyName, 'LatentView Analytics')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyCareerPage, 'https://www.latentview.com/career/')
  assert.equal(provider.companyDomain, 'latentview.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(provider.extractionStrategy, 'darwinbox-alljobs-api-via-hosted-origin')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /latentviewanalytics[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve LatentView Analytics to the latentviewanalytics source without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'latentviewanalytics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /latentviewanalytics[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'latentviewanalytics')

  const report = generateCompanyCoverageReport({
    csvText: 'LatentView Analytics,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['LatentView Analytics', 'latentviewanalytics', 'LatentView Analytics']],
  )
})
