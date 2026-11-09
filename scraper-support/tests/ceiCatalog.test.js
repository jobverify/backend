import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes CEI as a Bullhorn/Novo careers scraper for CEI India coverage', () => {
  const catalog = getScraperCatalog()
  const cei = catalog.find((provider) => provider.source === 'cei')

  assert.ok(cei)
  assert.equal(cei.adapter, 'script')
  assert.equal(cei.atsPlatform, 'bullhorn-novo-career-portal')
  assert.equal(cei.companyCareerPage, 'https://cei.ai/about-us/careers/')
  assert.equal(cei.companyDomain, 'cei.ai')
  assert.equal(cei.countryFilter, 'India')
  assert.equal(cei.parser, 'custom-script')
  assert.match(cei.modulePath, /cei[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable CEI script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const cei = scrapers.find((scraper) => scraper.name === 'cei')

  assert.ok(cei)
  assert.equal(typeof cei.run, 'function')
  assert.equal(cei.provider.adapter, 'script')
  assert.equal(cei.provider.parser, 'custom-script')
  assert.equal(cei.provider.companyCareerPage, 'https://cei.ai/about-us/careers/')
  assert.equal(cei.provider.countryFilter, 'India')
})
