import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes the EPAM India script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const epam = catalog.find((provider) => provider.source === 'epam')

  assert.ok(epam)
  assert.equal(epam.adapter, 'script')
  assert.equal(epam.atsPlatform, 'official-company-careers')
  assert.match(epam.companyCareerPage, /careers\.epam\.com\/en\/jobs\/india/i)
  assert.equal(epam.companyDomain, 'careers.epam.com')
  assert.equal(epam.parser, 'custom-script')
  assert.match(epam.modulePath, /epam[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable EPAM script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const epam = scrapers.find((scraper) => scraper.name === 'epam')

  assert.ok(epam)
  assert.equal(typeof epam.run, 'function')
  assert.equal(epam.provider.adapter, 'script')
  assert.equal(epam.provider.parser, 'custom-script')
  assert.match(epam.provider.companyCareerPage, /careers\.epam\.com\/en\/jobs\/india/i)
})
