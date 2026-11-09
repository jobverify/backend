import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Marvell as a Workday provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const marvell = catalog.find((provider) => provider.source === 'marvell')

  assert.ok(marvell)
  assert.equal(marvell.adapter, 'workday')
  assert.equal(marvell.atsPlatform, 'workday')
  assert.match(marvell.companyCareerPage, /marvell\.wd1\.myworkdayjobs\.com\/en-US\/MarvellCareers/i)
  assert.equal(marvell.companyDomain, 'marvell.wd1.myworkdayjobs.com')
  assert.match(marvell.baseUrl, /marvell\.wd1\.myworkdayjobs\.com\/en-US\/MarvellCareers/i)
})

test('buildScrapers exposes a runnable Marvell Workday scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const marvell = scrapers.find((scraper) => scraper.name === 'marvell')

  assert.ok(marvell)
  assert.equal(typeof marvell.run, 'function')
  assert.match(marvell.dryRunFile, /marvell.workday[\\/]jobs\.json$/)
  assert.equal(marvell.provider.source, 'marvell')
  assert.equal(marvell.provider.atsPlatform, 'workday')
})
