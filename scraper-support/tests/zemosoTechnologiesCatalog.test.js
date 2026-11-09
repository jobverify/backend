import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Zemoso Technologies as a script-backed official careers provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'zemosotechnologies')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Zemoso Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.zemosolabs.com/careers')
  assert.equal(provider.companyDomain, 'zemosolabs.com')
  assert.match(provider.modulePath, /zemosotechnologies[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Zemoso Technologies scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'zemosotechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /zemosotechnologies[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'zemosotechnologies')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
})
