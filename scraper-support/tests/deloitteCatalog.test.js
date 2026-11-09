import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Deloitte India custom script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const deloitte = catalog.find((provider) => provider.source === 'deloitte')

  assert.ok(deloitte)
  assert.equal(deloitte.adapter, 'script')
  assert.equal(deloitte.atsPlatform, 'avature')
  assert.match(deloitte.companyCareerPage, /usijobs\.deloitte\.com/i)
  assert.equal(deloitte.companyDomain, 'usijobs.deloitte.com')
})

test('buildScrapers exposes a runnable Deloitte scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const deloitte = scrapers.find((scraper) => scraper.name === 'deloitte')

  assert.ok(deloitte)
  assert.equal(typeof deloitte.run, 'function')
  assert.match(deloitte.dryRunFile, /deloitte[\\/]jobs\.json$/)
  assert.equal(deloitte.provider.source, 'deloitte')
  assert.equal(deloitte.provider.atsPlatform, 'avature')
})
