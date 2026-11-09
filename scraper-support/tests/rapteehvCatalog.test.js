import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes RAPTEE HV as a verified Keka-backed provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rapteehv')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'RAPTEE HV')
  assert.equal(provider.companyCareerPage, 'https://www.rapteehv.com/careers')
  assert.equal(provider.companyDomain, 'rapteehv.com')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.match(provider.modulePath, /rapteehv[\\/]script\.js$/i)
  assert.equal(companyAliases['RAPTEE HV'], 'rapteehv')
  assert.equal(companyAliases['Raptee HV'], 'rapteehv')
  assert.equal(companyAliases['Raptee.HV'], 'rapteehv')
})

test('buildScrapers exposes a runnable RAPTEE HV scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'rapteehv')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'rapteehv')
  assert.equal(scraper.provider.atsPlatform, 'keka-embed-api')
  assert.match(scraper.dryRunFile, /rapteehv[\\/]jobs\.json$/)
})
