import assert from 'node:assert/strict'
import test from 'node:test'
import metadata from '../../scraper/wingify/catalog.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Wingify catalog records the verified combined inventory and unresolved country gap', () => {
  const provider = getScraperCatalog().find((entry) => entry.source === 'wingify')
  for (const item of [metadata, provider]) {
    assert.ok(item)
    assert.equal(item.companyName, 'Wingify')
    assert.equal(item.companyCareerPage, 'https://wingify.com/company/careers/')
    assert.equal(item.atsPlatform, 'verified-first-party-keka-and-teamtailor-public-inventories')
    assert.equal(item.verifiedPublicJobCount, 31)
    assert.equal(item.verifiedIndiaJobCount, 16)
    assert.equal(item.sourceListingComplete, false)
    assert.deepEqual(item.unresolvedJobIds, ['136690'])
    assert.match(item.verifiedSurfaceSummary, /Latin America\/IN/)
    assert.match(item.modulePath, /wingify[\\/]script\.js$/)
  }
})

test('Wingify remains runnable through its dedicated provider folder', () => {
  const scraper = buildScrapers().find((entry) => entry.name === 'wingify')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.sourceListingComplete, false)
  assert.match(scraper.dryRunFile, /wingify[\\/]jobs\.json$/)
})
