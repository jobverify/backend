import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Sundaram Clayton against the verified TVS Holdings site', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sundaramclayton')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyName, 'TVS Holdings Limited')
  assert.equal(provider.companyCareerPage, 'https://www.tvsholdings.com/')
  assert.equal(provider.companyDomain, 'tvsholdings.com')
  assert.match(provider.modulePath, /sundaramclayton[\\/]script\.js$/i)
  assert.equal(companyAliases['Sundaram Clayton'], 'sundaramclayton')
  assert.equal(companyAliases['Sundaram-Clayton'], 'sundaramclayton')
  assert.equal(companyAliases['TVS Holdings'], 'sundaramclayton')
})

test('buildScrapers exposes a runnable Sundaram Clayton scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sundaramclayton')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sundaramclayton')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site')
  assert.match(scraper.dryRunFile, /sundaramclayton[\\/]jobs\.json$/i)
})
