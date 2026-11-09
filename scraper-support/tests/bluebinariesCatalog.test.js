import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.fetch = async () => { throw new Error('OFFLINE network tripwire') }
const {
  buildScrapers,
  getScraperCatalog,
} = await import('../providers/index.js')

test('getScraperCatalog includes Blue Binaries with its official careers page metadata', () => {
  const catalog = getScraperCatalog()
  const bluebinaries = catalog.find((provider) => provider.source === 'bluebinaries')

  assert.ok(bluebinaries)
  assert.equal(bluebinaries.adapter, 'script')
  assert.equal(bluebinaries.atsPlatform, 'wordpress-native-accordion')
  assert.match(bluebinaries.companyCareerPage, /bluebinaries\.com\/become-a-bluebee/i)
  assert.equal(bluebinaries.companyDomain, 'bluebinaries.com')
})

test('buildScrapers exposes a runnable Blue Binaries scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const bluebinaries = scrapers.find((scraper) => scraper.name === 'bluebinaries')

  assert.ok(bluebinaries)
  assert.equal(typeof bluebinaries.run, 'function')
  assert.match(bluebinaries.dryRunFile, /bluebinaries[\\/]jobs\.json$/)
  assert.equal(bluebinaries.provider.source, 'bluebinaries')
  assert.equal(bluebinaries.provider.adapter, 'script')
})
