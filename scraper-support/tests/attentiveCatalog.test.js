import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Attentive.ai scraper with official metadata', () => {
  const catalog = getScraperCatalog()
  const attentiveai = catalog.find((provider) => provider.source === 'attentiveai')

  assert.ok(attentiveai)
  assert.equal(attentiveai.adapter, 'script')
  assert.equal(attentiveai.atsPlatform, 'beam-keka')
  assert.match(attentiveai.companyCareerPage, /ibeam\.ai\/careers/i)
  assert.equal(attentiveai.companyDomain, 'ibeam.ai')
})

test('buildScrapers exposes a runnable Attentive.ai scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const attentiveai = scrapers.find((scraper) => scraper.name === 'attentiveai')

  assert.ok(attentiveai)
  assert.equal(typeof attentiveai.run, 'function')
  assert.match(attentiveai.dryRunFile, /attentiveai[\\/]jobs\.json$/)
  assert.equal(attentiveai.provider.source, 'attentiveai')
  assert.equal(attentiveai.provider.adapter, 'script')
})
