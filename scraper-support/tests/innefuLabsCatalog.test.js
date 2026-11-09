import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Innefu Labs with the verified official-careers metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'innefulabs')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Innefu Labs')
  assert.equal(provider.companyCareerPage, 'https://innefu.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyDomain, 'innefu.com')
  assert.match(provider.modulePath, /innefulabs[\\/]script\.js$/i)
})

test('buildScrapers exposes the Innefu Labs provider through the standard runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'innefulabs')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /innefulabs[\\/]jobs\.json$/i)
})
