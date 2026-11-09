import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Boat retains its exact company registration and uses a custom native source adapter', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'boat')

  assert.ok(provider)
  assert.equal(provider.companyName, 'boAt Lifestyle')
  assert.equal(provider.companyCareerPage, 'https://www.boat-lifestyle.com/pages/boat-careers')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /boat[\\/]script\.js$/i)

  const scraper = buildScrapers().find((item) => item.name === 'boat')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})
