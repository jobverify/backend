import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the ACS Network & Technologies scraper with recruiter-page metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'acsnetworktechnologies')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'placementindia')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.match(provider.companyCareerPage, /placementindia\.com\/job-recruiters\/acs-networks-technologies/i)
  assert.equal(provider.companyDomain, 'placementindia.com')
  assert.match(provider.verifiedSurfaceSummary, /UND_ERR_CONNECT_TIMEOUT/i)
  assert.match(provider.verifiedSurfaceSummary, /trusted public surface is reachable/i)
})

test('buildScrapers exposes a runnable ACS Network & Technologies scraper', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'acsnetworktechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /acsnetworktechnologies[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'acsnetworktechnologies')
  assert.equal(scraper.provider.adapter, 'script')
})
