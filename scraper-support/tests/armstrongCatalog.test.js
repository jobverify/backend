import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Armstrong Fluid Technology scraper with official careers metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'armstrongfluidtechnology')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.companyCareerPage, /armstrongfluidtechnology\.com\/en\/about-armstrong\/careers/i)
})

test('buildScrapers exposes a runnable Armstrong Fluid Technology scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'armstrongfluidtechnology')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /armstrongfluidtechnology[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'armstrongfluidtechnology')
})
