import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Avantor current Paradox script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'avantor')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'paradox-careersites')
  assert.equal(provider.companyCareerPage, 'https://careers.avantorsciences.com/jobs/page/1?filter[country][0]=India')
})

test('buildScrapers exposes a runnable Avantor scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'avantor')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /avantor[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'avantor')
})
