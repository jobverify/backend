import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Data Patterns with official careers metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'datapatterns')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.datapatternsindia.com/careers/current-openings.php')
  assert.equal(provider.companyDomain, 'datapatternsindia.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /datapatterns[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Data Patterns scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'datapatterns')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.companyName, 'Data Patterns')
})
