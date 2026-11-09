import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Raymond as a PeopleStrong script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'raymond')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Raymond')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'peoplestrong')
  assert.equal(provider.companyCareerPage, 'https://www.raymond.in/career')
  assert.equal(provider.companyDomain, 'raymondcareers.peoplestrong.com')
  assert.equal(provider.extractionStrategy, 'official-careers-shell+client-bundle-handoff+peoplestrong-jobs-api')
  assert.match(provider.modulePath, /raymond[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Raymond scraper without changing the runner contract', () => {
  const raymond = buildScrapers().find((scraper) => scraper.name === 'raymond')

  assert.ok(raymond)
  assert.equal(typeof raymond.run, 'function')
  assert.match(raymond.dryRunFile, /raymond[\\/]jobs\.json$/)
  assert.equal(raymond.provider.source, 'raymond')
  assert.equal(raymond.provider.atsPlatform, 'peoplestrong')
})
