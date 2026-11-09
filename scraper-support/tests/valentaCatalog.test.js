import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Valenta as a public Zoho Recruit scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'valenta')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zoho-recruit')
  assert.equal(provider.companyCareerPage, 'https://www.valenta.io/join-us/careers')
  assert.equal(provider.companyDomain, 'valenta.io')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /valenta[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Valenta scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'valenta')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://www.valenta.io/join-us/careers')
})
