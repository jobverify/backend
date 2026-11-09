import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Wolters Kluwer on its official careers page backed by Workday', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'wolterskluwer')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Wolters Kluwer')
  assert.equal(provider.companyCareerPage, 'https://careers.wolterskluwer.com/en-in')
  assert.equal(provider.companyDomain, 'careers.wolterskluwer.com')
  assert.equal(provider.baseUrl, 'https://wk.wd3.myworkdayjobs.com/External')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(companyAliases['Wolters Kluwer'], 'wolterskluwer')
  assert.equal(companyAliases['Wolters Kluwer N.V.'], 'wolterskluwer')
})

test('buildScrapers exposes a runnable Wolters Kluwer Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'wolterskluwer')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /wolterskluwer.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'wolterskluwer')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})
