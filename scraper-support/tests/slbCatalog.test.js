import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes SLB as its current company-careers apiPortal provider with Cameron and Schlumberger alias metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'slb')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'slb-current-company-careers')
  assert.equal(provider.companyName, 'SLB')
  assert.equal(provider.companyCareerPage, 'https://careers.slb.com/job-listing')
  assert.equal(provider.companyDomain, 'slb.com')
  assert.equal(provider.nativeCurrentCareerSurface, 'slb-current-public-coveo')
  assert.equal(provider.template, null)
  assert.equal(provider.config.rateLimit.minimumIntervalMs, 1000)
  assert.match(provider.extractionStrategy, /current-published-search-client/)
  assert.equal(companyAliases.Cameron, 'slb')
  assert.equal(companyAliases.Schlumberger, 'slb')
})

test('buildScrapers exposes a runnable SLB apiPortal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'slb')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /slb[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'slb')
  assert.equal(scraper.provider.atsPlatform, 'slb-current-company-careers')
})
