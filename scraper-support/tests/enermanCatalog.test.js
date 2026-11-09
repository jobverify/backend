import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes EnerMAN as an official no-public-listings scraper', () => {
  const catalog = getScraperCatalog()
  const enerman = catalog.find((provider) => provider.source === 'enerman')

  assert.ok(enerman)
  assert.equal(enerman.adapter, 'script')
  assert.equal(enerman.atsPlatform, 'official-company-site-no-public-job-listings')
  assert.match(enerman.companyCareerPage, /enerman\.in/i)
  assert.equal(enerman.companyDomain, 'enerman.in')
  assert.equal(enerman.parser, 'custom-script')
})

test('buildScrapers exposes a runnable EnerMAN script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const enerman = scrapers.find((scraper) => scraper.name === 'enerman')

  assert.ok(enerman)
  assert.equal(typeof enerman.run, 'function')
  assert.equal(enerman.provider.adapter, 'script')
  assert.equal(enerman.provider.parser, 'custom-script')
  assert.match(enerman.provider.companyCareerPage, /enerman\.in/i)
})
