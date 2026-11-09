import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes TheMathCompany as a public Zwayam script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'themathcompany')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zwayam')
  assert.equal(provider.companyName, 'TheMathCompany')
  assert.equal(provider.companyCareerPage, 'https://careers.mathco.com/')
  assert.equal(provider.companyDomain, 'careers.mathco.com')
  assert.match(provider.modulePath, /themathcompany[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable TheMathCompany scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'themathcompany')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'themathcompany')
  assert.equal(scraper.provider.atsPlatform, 'zwayam')
  assert.match(scraper.dryRunFile, /themathcompany[\\/]jobs\.json$/)
})
