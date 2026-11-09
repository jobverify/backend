import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Hyundai Motor India as an official SuccessFactors script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hyundaimotorindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Hyundai Motor India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyCareerPage, 'https://careers.hyundai.co.in/search/?createNewAlert=false&q=&locationsearch=')
  assert.equal(provider.companyDomain, 'careers.hyundai.co.in')
  assert.match(provider.modulePath, /hyundaimotorindia[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Hyundai Motor India scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hyundaimotorindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /hyundaimotorindia[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'hyundaimotorindia')
  assert.equal(scraper.provider.atsPlatform, 'successfactors')
})
