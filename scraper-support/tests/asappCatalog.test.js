import { checkCurrentReplay, assertCurrentProvider } from '../native-sources/declaredJobFeeds/legacyReplayControls.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('asapp: registered native reader clears historical source-coverage claims', () => assertCurrentProvider('asapp'))

test('buildScrapers exposes a runnable ASAPP apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const asapp = scrapers.find((scraper) => scraper.name === 'asapp')

  assert.ok(asapp)
  assert.equal(typeof asapp.run, 'function')
  assert.match(asapp.dryRunFile, /asapp[\\/]jobs\.json$/)
  assert.equal(asapp.provider.source, 'asapp')
  assert.equal(asapp.provider.atsPlatform, 'lever')
})
