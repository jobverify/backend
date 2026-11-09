import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Bull Machines with its official careers page metadata', () => {
  const catalog = getScraperCatalog()
  const bullmachines = catalog.find((provider) => provider.source === 'bullmachines')

  assert.ok(bullmachines)
  assert.equal(bullmachines.adapter, 'script')
  assert.equal(bullmachines.atsPlatform, 'official-company-careers')
  assert.equal(bullmachines.companyCareerPage, 'https://www.bullindia.com/career.php')
  assert.equal(bullmachines.companyDomain, 'bullindia.com')
})

test('buildScrapers exposes a runnable Bull Machines scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const bullmachines = scrapers.find((scraper) => scraper.name === 'bullmachines')

  assert.ok(bullmachines)
  assert.equal(typeof bullmachines.run, 'function')
  assert.match(bullmachines.dryRunFile, /bullmachines[\\/]jobs\.json$/)
  assert.equal(bullmachines.provider.source, 'bullmachines')
  assert.equal(bullmachines.provider.adapter, 'script')
})
