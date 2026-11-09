import { checkCurrentReplay, assertCurrentProvider } from '../../scraper-support/native-sources/declaredJobFeeds/legacyReplayControls.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('dagster: registered native reader clears historical source-coverage claims', () => assertCurrentProvider('dagster'))

test('Dagster is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'dagster')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /dagster[\\/]jobs\.json$/)
})
