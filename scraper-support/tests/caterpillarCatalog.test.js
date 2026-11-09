import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Caterpillar as a Workday provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const caterpillar = catalog.find((provider) => provider.source === 'caterpillar')

  assert.ok(caterpillar)
  assert.equal(caterpillar.adapter, 'workday')
  assert.equal(caterpillar.atsPlatform, 'workday')
  assert.match(caterpillar.companyCareerPage, /careers\.caterpillar\.com\/en\/jobs\/?$/i)
  assert.equal(caterpillar.companyDomain, 'careers.caterpillar.com')
  assert.match(caterpillar.baseUrl, /cat\.wd5\.myworkdayjobs\.com\/en-US\/CaterpillarCareers/i)
})

test('buildScrapers exposes a runnable Caterpillar Workday scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const caterpillar = scrapers.find((scraper) => scraper.name === 'caterpillar')

  assert.ok(caterpillar)
  assert.equal(typeof caterpillar.run, 'function')
  assert.match(caterpillar.dryRunFile, /caterpillar.workday[\\/]jobs\.json$/)
  assert.equal(caterpillar.provider.source, 'caterpillar')
  assert.equal(caterpillar.provider.atsPlatform, 'workday')
})
