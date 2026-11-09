import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Firstsource Solutions Limited as a SuccessFactors script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'firstsource')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyName, 'Firstsource Solutions Limited')
  assert.equal(provider.companyCareerPage, 'https://careers.firstsource.com/India/go/India-Jobs/655444/')
  assert.equal(provider.companyDomain, 'careers.firstsource.com')
  assert.match(provider.modulePath, /firstsource[\\/]script\.js$/i)
  assert.equal(companyAliases['First Source Ltd.'], 'firstsource')
})

test('buildScrapers exposes a runnable Firstsource scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'firstsource')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /firstsource[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'firstsource')
  assert.equal(scraper.provider.atsPlatform, 'successfactors')
})
