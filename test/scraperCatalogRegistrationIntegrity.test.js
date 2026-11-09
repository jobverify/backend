import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const catalog = getScraperCatalog()
const scrapers = buildScrapers()

test('effective catalog retains exact source identities without duplicate registrations', () => {
  const sources = catalog.map(provider => provider.source)
  assert.ok(sources.every(source => typeof source === 'string' && source.length > 0 && source.trim() === source))
  assert.equal(new Set(sources).size, sources.length)
  for (const source of ['3pillarglobal', 'carrier', 'fidelity']) {
    assert.equal(catalog.filter(provider => provider.source === source).length, 1, source)
  }
})

test('runnable scrapers match every catalog source exactly once and expose the runner contract', () => {
  const names = scrapers.map(scraper => scraper.name)
  assert.equal(new Set(names).size, names.length)
  assert.deepEqual([...names].sort(), catalog.map(provider => provider.source).sort())
  for (const scraper of scrapers) {
    assert.equal(typeof scraper.run, 'function', scraper.name)
    assert.equal(scraper.provider.source, scraper.name)
  }
})
