import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Arcelor Mittal as an Oracle Cloud script provider', () => {
  const catalog = getScraperCatalog()
  const arcelor = catalog.find((provider) => provider.source === 'arcelormittal')

  assert.ok(arcelor)
  assert.equal(arcelor.adapter, 'script')
  assert.equal(arcelor.atsPlatform, 'oracle-cloud')
  assert.match(arcelor.companyCareerPage, /corporate\.arcelormittal\.com\/careers/i)
  assert.equal(arcelor.companyDomain, 'emfg.fa.em4.oraclecloud.com')
  assert.match(arcelor.modulePath, /arcelormittal[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Arcelor Mittal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const arcelor = scrapers.find((scraper) => scraper.name === 'arcelormittal')

  assert.ok(arcelor)
  assert.equal(typeof arcelor.run, 'function')
  assert.match(arcelor.dryRunFile, /arcelormittal[\\/]jobs\.json$/)
  assert.equal(arcelor.provider.source, 'arcelormittal')
  assert.equal(arcelor.provider.atsPlatform, 'oracle-cloud')
})
