import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes HSBC Technology India as an Eightfold apiPortal provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hsbctechnologyindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'eightfold')
  assert.equal(provider.companyCareerPage, 'https://portal.careers.hsbc.com/careers?location=India')
  assert.equal(provider.companyDomain, 'portal.careers.hsbc.com')
  assert.match(provider.config.discovery.listingApiUrl, /hsbc\.eightfold\.ai\/api\/pcsx\/search/i)
  assert.equal(provider.config.request.query.domain, 'hsbc.com')
  assert.equal(provider.config.request.query.location, 'India')
})

test('buildScrapers exposes a runnable HSBC Technology India apiPortal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hsbctechnologyindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /hsbctechnologyindia[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'hsbctechnologyindia')
  assert.equal(scraper.provider.atsPlatform, 'eightfold')
})
