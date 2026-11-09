import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Altera on the public Workday tenant linked from its careers site', () => {
  const catalog = getScraperCatalog()
  const altera = catalog.find((provider) => provider.source === 'altera')

  assert.ok(altera)
  assert.equal(altera.adapter, 'workday')
  assert.equal(altera.atsPlatform, 'workday')
  assert.match(altera.companyCareerPage, /altera\.com\/careers/i)
  assert.equal(altera.companyDomain, 'altera.com')
  assert.match(altera.baseUrl, /altera\.wd1\.myworkdayjobs\.com\/Altera/i)
})

test('buildScrapers exposes a runnable Altera Workday scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const altera = scrapers.find((scraper) => scraper.name === 'altera')

  assert.ok(altera)
  assert.equal(typeof altera.run, 'function')
  assert.match(altera.dryRunFile, /altera.workday[\\/]jobs\.json$/)
  assert.equal(altera.provider.source, 'altera')
  assert.equal(altera.provider.atsPlatform, 'workday')
})
