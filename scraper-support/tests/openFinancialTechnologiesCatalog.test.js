import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Open Financial Technologies as a Keka-backed script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'openfinancialtechnologies')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.companyCareerPage, 'https://openfinancial.keka.com/careers/')
  assert.equal(provider.companyDomain, 'open.money')
  assert.match(provider.modulePath, /openfinancialtechnologies[\\/]script\.js$/i)
  assert.equal(companyAliases['Open Money'], 'openfinancialtechnologies')
})

test('buildScrapers exposes a runnable Open Financial Technologies scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'openfinancialtechnologies')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'keka-embed-api')
  assert.match(provider.dryRunFile, /openfinancialtechnologies[\\/]jobs\.json$/)
})
