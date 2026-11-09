import assert from 'node:assert/strict'
import test from 'node:test'

import { getScraperCatalog } from '../providers/index.js'

test('Appknox is registered as a verified custom script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'appknox')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Appknox')
  assert.equal(provider.companyCareerPage, 'https://www.appknox.com/careers')
  assert.equal(provider.companyDomain, 'appknox.com')
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /appknox[\\/]script\.js$/i)
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.verifiedSurfaceSummary, /publicly exposed three openings/i)
})
