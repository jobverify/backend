import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Engineerminds as a no-public-host scraper', () => {
  const catalog = getScraperCatalog()
  const engineerminds = catalog.find((provider) => provider.source === 'engineerminds')

  assert.ok(engineerminds)
  assert.equal(engineerminds.adapter, 'script')
  assert.equal(engineerminds.atsPlatform, 'official-company-careers')
  assert.equal(engineerminds.companyCareerPage, 'https://engineerminds.com/')
  assert.equal(engineerminds.companyDomain, 'engineerminds.com')
  assert.equal(engineerminds.parser, 'custom-script')
  assert.match(engineerminds.modulePath, /engineerminds[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Engineerminds script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const engineerminds = scrapers.find((scraper) => scraper.name === 'engineerminds')

  assert.ok(engineerminds)
  assert.equal(typeof engineerminds.run, 'function')
  assert.equal(engineerminds.provider.adapter, 'script')
  assert.equal(engineerminds.provider.parser, 'custom-script')
  assert.equal(engineerminds.provider.companyCareerPage, 'https://engineerminds.com/')
})
