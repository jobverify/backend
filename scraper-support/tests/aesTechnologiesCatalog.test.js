import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes AES Technologies as a public careers-page scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'aestechnologies')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://careers.advanceecomsolutions.com/careers')
  assert.equal(provider.companyDomain, 'careers.advanceecomsolutions.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /aestechnologies[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable AES Technologies scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'aestechnologies')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://careers.advanceecomsolutions.com/careers')
})
