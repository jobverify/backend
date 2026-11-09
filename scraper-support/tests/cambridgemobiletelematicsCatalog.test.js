import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Cambridge Mobile Telematics as a Greenhouse apiPortal provider', () => {
  const catalog = getScraperCatalog()
  const cmt = catalog.find(
    (provider) => provider.source === 'cambridgemobiletelematics',
  )

  assert.ok(cmt)
  assert.equal(cmt.adapter, 'apiPortal')
  assert.equal(cmt.atsPlatform, 'greenhouse')
  assert.match(cmt.companyCareerPage, /cmtelematics\.com\/career-1-77\/?$/i)
  assert.equal(cmt.companyDomain, 'cmtelematics.com')
  assert.match(
    cmt.config.discovery.listingApiUrl,
    /boards-api\.greenhouse\.io\/v1\/boards\/cambridgemobiletelematics\/jobs/i,
  )
})

test('buildScrapers exposes a runnable Cambridge Mobile Telematics apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const cmt = scrapers.find(
    (scraper) => scraper.name === 'cambridgemobiletelematics',
  )

  assert.ok(cmt)
  assert.equal(typeof cmt.run, 'function')
  assert.match(cmt.dryRunFile, /cambridgemobiletelematics[\\/]jobs\.json$/)
  assert.equal(cmt.provider.source, 'cambridgemobiletelematics')
  assert.equal(cmt.provider.atsPlatform, 'greenhouse')
})
