import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes EasyEcom as an official careers script provider with correct metadata', () => {
  const catalog = getScraperCatalog()
  const easyecom = catalog.find((provider) => provider.source === 'easyecom')

  assert.ok(easyecom)
  assert.equal(easyecom.adapter, 'script')
  assert.equal(easyecom.atsPlatform, 'official-company-careers')
  assert.match(easyecom.companyCareerPage, /easyecom\.io\/careers/i)
  assert.equal(easyecom.companyDomain, 'easyecom.io')
  assert.match(easyecom.modulePath, /easyecom[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable EasyEcom scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const easyecom = scrapers.find((scraper) => scraper.name === 'easyecom')

  assert.ok(easyecom)
  assert.equal(typeof easyecom.run, 'function')
  assert.match(easyecom.dryRunFile, /easyecom[\\/]jobs\.json$/)
  assert.equal(easyecom.provider.source, 'easyecom')
  assert.equal(easyecom.provider.atsPlatform, 'official-company-careers')
})
