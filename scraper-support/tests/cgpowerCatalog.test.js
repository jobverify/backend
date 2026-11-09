import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes CG Power as an official careers empty-state scraper', () => {
  const catalog = getScraperCatalog()
  const cgpower = catalog.find((provider) => provider.source === 'cgpower')

  assert.ok(cgpower)
  assert.equal(cgpower.adapter, 'script')
  assert.equal(cgpower.atsPlatform, 'official-company-careers')
  assert.equal(cgpower.companyCareerPage, 'https://www.cgglobal.com/career')
  assert.equal(cgpower.companyDomain, 'cgglobal.com')
  assert.equal(cgpower.parser, 'custom-script')
  assert.match(cgpower.modulePath, /cgpower[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable CG Power script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const cgpower = scrapers.find((scraper) => scraper.name === 'cgpower')

  assert.ok(cgpower)
  assert.equal(typeof cgpower.run, 'function')
  assert.equal(cgpower.provider.adapter, 'script')
  assert.equal(cgpower.provider.parser, 'custom-script')
  assert.equal(cgpower.provider.companyCareerPage, 'https://www.cgglobal.com/career')
})
