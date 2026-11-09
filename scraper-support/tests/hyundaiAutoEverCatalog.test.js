import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Hyundai AutoEver as a zero-India GreetingHR script provider', () => {
  const catalog = getScraperCatalog()
  const hyundaiAutoEver = catalog.find((provider) => provider.source === 'hyundaiautoever')

  assert.ok(hyundaiAutoEver)
  assert.equal(hyundaiAutoEver.adapter, 'script')
  assert.equal(hyundaiAutoEver.atsPlatform, 'greetinghr')
  assert.match(hyundaiAutoEver.companyCareerPage, /career\.hyundai-autoever\.com\/en\/apply/i)
  assert.equal(hyundaiAutoEver.companyDomain, 'career.hyundai-autoever.com')
  assert.equal(hyundaiAutoEver.parser, 'custom-script')
})

test('buildScrapers exposes a runnable Hyundai AutoEver script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const hyundaiAutoEver = scrapers.find((scraper) => scraper.name === 'hyundaiautoever')

  assert.ok(hyundaiAutoEver)
  assert.equal(typeof hyundaiAutoEver.run, 'function')
  assert.equal(hyundaiAutoEver.provider.adapter, 'script')
  assert.equal(hyundaiAutoEver.provider.parser, 'custom-script')
  assert.match(hyundaiAutoEver.provider.companyCareerPage, /career\.hyundai-autoever\.com\/en\/apply/i)
})
