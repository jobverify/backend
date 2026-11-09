import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog } from '../providers/index.js'

test('Safran Data Systems records an observed native India employer subset without company completeness or zero claims', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'safrandatasystems')
  assert.ok(provider)
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.verifiedObservedIndiaSubsetCount, 6)
  assert.equal(provider.verifiedGroupIndiaListingRowCount, 176)
  assert.equal(provider.sourceListingComplete, false)
  assert.equal(provider.verificationDisposition, 'verified-native-india-employer-subset-global-inventory-unverified')
  assert.match(provider.verifiedSurfaceSummary, /(?=.*176)(?=.*group India)(?=.*9 pages)/i)
  assert.match(provider.verifiedSurfaceSummary, /6.*(?:SDS India|Safran Data Systems India)/i)
  assert.match(provider.verifiedSurfaceSummary, /company.*(?:global.*India|India.*global).*unknown/i)
  assert.match(provider.verifiedSurfaceSummary, /no.*(?:zero|expiry)/i)
  assert.match(provider.modulePath, /safrandatasystems[\\/]script\.js$/)
})
