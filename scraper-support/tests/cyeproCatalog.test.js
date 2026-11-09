import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('CyePro Solutions is registered against its official public site with both CSV aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cyepro')

  assert.ok(provider)
  assert.equal(provider.companyName, 'CyePro Solutions')
  assert.equal(provider.companyCareerPage, 'https://www.cyepro.com/')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyDomain, 'cyepro.com')
  assert.equal(companyAliases['CyePro Solutions'], 'cyepro')
  assert.equal(companyAliases['CyePro Solutions Bharat Moto Corp Pvt Ltd'], 'cyepro')
})

test('CyePro Solutions is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cyepro')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /cyepro[\\/]jobs\.json$/)
})
