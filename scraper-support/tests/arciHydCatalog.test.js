import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes ARCI Hyderabad as an official-site scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'arcihyd')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'first-party-public-advertisement-pdf')
  assert.equal(provider.companyCareerPage, 'https://arci.res.in/careers/vacancies')
  assert.equal(provider.companyDomain, 'arci.res.in')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /arcihyd[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable ARCI Hyderabad scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'arcihyd')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://arci.res.in/careers/vacancies')
})
