import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Quantiphi as a Workday provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const quantiphi = catalog.find((provider) => provider.source === 'quantiphi')

  assert.ok(quantiphi)
  assert.equal(quantiphi.adapter, 'workday')
  assert.equal(quantiphi.atsPlatform, 'workday')
  assert.match(quantiphi.companyCareerPage, /quantiphi\.wd1\.myworkdayjobs\.com\/en-US\/Careers_at_Quantiphi/i)
  assert.equal(quantiphi.companyDomain, 'quantiphi.wd1.myworkdayjobs.com')
  assert.match(quantiphi.baseUrl, /quantiphi\.wd1\.myworkdayjobs\.com\/en-US\/Careers_at_Quantiphi/i)
})

test('buildScrapers exposes a runnable Quantiphi Workday scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const quantiphi = scrapers.find((scraper) => scraper.name === 'quantiphi')

  assert.ok(quantiphi)
  assert.equal(typeof quantiphi.run, 'function')
  assert.match(quantiphi.dryRunFile, /quantiphi.workday[\\/]jobs\.json$/)
  assert.equal(quantiphi.provider.source, 'quantiphi')
  assert.equal(quantiphi.provider.atsPlatform, 'workday')
})
