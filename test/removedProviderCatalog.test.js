import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

test('removed backend scraper provider is not registered', () => {
  const catalog = getScraperCatalog()
  const scrapers = buildScrapers()
  const removedSource = ['rail', 'tel'].join('')

  assert.equal(catalog.some((provider) => provider.source === removedSource), false)
  assert.equal(scrapers.some((scraper) => scraper.name === removedSource), false)
})
