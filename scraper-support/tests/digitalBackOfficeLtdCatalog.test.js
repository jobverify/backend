import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Digital Back Office Ltd as a verified empty-board script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'digitalbackoffice')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyName, 'Digital Back Office Ltd')
  assert.equal(provider.companyCareerPage, 'https://www.digitalbackoffice.com/')
  assert.equal(provider.companyDomain, 'digitalbackoffice.com')
  assert.match(provider.modulePath, /digitalbackoffice[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Digital Back Office Ltd scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'digitalbackoffice')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'digitalbackoffice')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site')
  assert.match(scraper.dryRunFile, /digitalbackoffice[\\/]jobs\.json$/i)
})
