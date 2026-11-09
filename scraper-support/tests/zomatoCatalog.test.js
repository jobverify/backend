import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes the Zomato referrals-only script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const zomato = catalog.find((provider) => provider.source === 'zomato')

  assert.ok(zomato)
  assert.equal(zomato.adapter, 'script')
  assert.equal(zomato.atsPlatform, 'official-company-careers')
  assert.match(zomato.companyCareerPage, /eternal\.com\/careers/i)
  assert.equal(zomato.companyDomain, 'eternal.com')
  assert.equal(zomato.parser, 'custom-script')
  assert.match(zomato.modulePath, /zomato[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Zomato script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const zomato = scrapers.find((scraper) => scraper.name === 'zomato')

  assert.ok(zomato)
  assert.equal(typeof zomato.run, 'function')
  assert.equal(zomato.provider.adapter, 'script')
  assert.equal(zomato.provider.parser, 'custom-script')
  assert.match(zomato.provider.companyCareerPage, /eternal\.com\/careers/i)
})
