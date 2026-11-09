import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes ANAPTY CodeEmy as a LinkedIn guest-search scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'anaptycodeemy')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'linkedin-guest-search')
  assert.equal(provider.companyCareerPage, 'https://in.linkedin.com/company/codeemy')
  assert.equal(provider.companyDomain, 'codeemy.in')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /anaptycodeemy[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable ANAPTY CodeEmy scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'anaptycodeemy')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://in.linkedin.com/company/codeemy')
})
