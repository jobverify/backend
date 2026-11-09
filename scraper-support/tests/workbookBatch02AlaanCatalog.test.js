import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Alaan registered source reads its injected current document and cannot restore a historical empty success', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'alaan')
  const scraper = buildScrapers().find((item) => item.name === 'alaan')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'Alaan')
  assert.equal(provider.companyCareerPage, 'https://www.alaan.com/careers')
  assert.equal(provider.companyDomain, 'alaan.com')
  assert.match(provider.modulePath, new RegExp(`[\\\\/]${provider.source}[\\\\/]script\\.js$`, 'i'))

  assert.equal(scraper.provider.modulePath, provider.modulePath)
  const failure = Error('offline current document unavailable'), requests = []
  await assert.rejects(() => scraper.run({fetchPage:async (url, init) => {
    requests.push(url)
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'manual')
    assert.equal(init.credentials, 'omit')
    throw failure
  }}), error => {
    assert.equal(error, failure)
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    assert.equal(error.lifecycleCleanupAllowed, false)
    return true
  })
  assert.deepEqual(requests, ['https://www.alaan.com/careers'])
})
