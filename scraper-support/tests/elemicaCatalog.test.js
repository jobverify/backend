import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Elemica on the official careers page backed by Workday', () => {
  const catalog = getScraperCatalog()
  const elemica = catalog.find((provider) => provider.source === 'elemica')

  assert.ok(elemica)
  assert.equal(elemica.adapter, 'workday')
  assert.equal(elemica.atsPlatform, 'workday')
  assert.match(elemica.companyCareerPage, /elemica\.com\/why-elemica\/careers/i)
  assert.equal(elemica.companyDomain, 'elemica.com')
  assert.match(elemica.baseUrl, /elemica\.wd501\.myworkdayjobs\.com\/wday\/cxs\/elemica\/Elemica_Careers\/jobs/i)
})

test('buildScrapers exposes a runnable Elemica Workday scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const elemica = scrapers.find((scraper) => scraper.name === 'elemica')

  assert.ok(elemica)
  assert.equal(typeof elemica.run, 'function')
  assert.match(elemica.dryRunFile, /elemica.workday[\\/]jobs\.json$/)
  assert.equal(elemica.provider.source, 'elemica')
  assert.equal(elemica.provider.atsPlatform, 'workday')
})
