import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const RESTORED_SHARED_COVERAGE_SOURCES = [
  'rephraseai',
  'remunanceservicespvtltd',
]

test('shared scraper catalog restores the excluded coverage sources when full-company dry runs need the complete shared set', () => {
  const catalog = getScraperCatalog()
  const scrapers = buildScrapers()

  for (const source of RESTORED_SHARED_COVERAGE_SOURCES) {
    assert.equal(
      catalog.some((provider) => provider.source === source),
      true,
      `Expected ${source} to be present in the shared provider catalog`,
    )
    assert.equal(
      scrapers.some((scraper) => scraper.name === source),
      true,
      `Expected ${source} to be runnable through buildScrapers()`,
    )
  }
})
