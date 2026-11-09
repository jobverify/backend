import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Visa on the public Workday tenant linked from its official careers page', () => {
  const catalog = getScraperCatalog()
  const visa = catalog.find((provider) => provider.source === 'visa')

  assert.ok(visa)
  assert.equal(visa.adapter, 'workday')
  assert.equal(visa.atsPlatform, 'workday')
  assert.match(visa.companyCareerPage, /visa\.com\/en\/careers|jobs\.visa\.com/i)
  assert.equal(visa.companyDomain, 'corporate.visa.com')
  assert.match(visa.baseUrl, /visa\.wd5\.myworkdayjobs\.com\/Visa/i)
})

test('buildScrapers exposes a runnable Visa Workday scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const visa = scrapers.find((scraper) => scraper.name === 'visa')

  assert.ok(visa)
  assert.equal(typeof visa.run, 'function')
  assert.equal(visa.provider.adapter, 'workday')
  assert.equal(visa.provider.atsPlatform, 'workday')
  assert.match(visa.dryRunFile, /visa.workday[\\/]jobs\.json$/)
})
