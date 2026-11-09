import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Accelero Corporation is registered against its official site', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'acceleroisa')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Accelero Corporation')
  assert.equal(provider.companyCareerPage, 'https://www.accelero-corp.com/')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.paginationStrategy, 'homepage-plus-missing-careers-routes')
  assert.equal(provider.extractionStrategy, 'official-site+404-careers-check')
  assert.equal(provider.companyDomain, 'accelero-corp.com')
  assert.equal(companyAliases['Accelero (ISA)'], 'acceleroisa')
  assert.match(provider.modulePath, /acceleroisa[\\/]script\.js$/i)
})

test('Accelero Corporation is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'acceleroisa')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /acceleroisa[\\/]jobs\.json$/)
})
