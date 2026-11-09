import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes SFO Technologies Pvt Ltd (NeST Group Company) as an official careers script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sfotechnologies')

  assert.ok(provider)
  assert.equal(provider.companyName, 'SFO Technologies Pvt Ltd (NeST Group Company)')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://sfotechnologies.net/about-us/careers/')
  assert.equal(provider.companyDomain, 'sfotechnologies.net')
  assert.match(provider.modulePath, /sfotechnologies[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable SFO Technologies scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sfotechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /sfotechnologies[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'sfotechnologies')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
})
