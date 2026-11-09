import assert from 'node:assert/strict'
import test from 'node:test'

import BLACKLINE_CATALOG from './catalog.js'

test('publishes registration metadata for the verified BlackLine Workday provider', () => {
  assert.equal(BLACKLINE_CATALOG.source, 'blackline')
  assert.equal(BLACKLINE_CATALOG.companyName, 'BlackLine')
  assert.equal(BLACKLINE_CATALOG.companyCareerPage, 'https://careers.blackline.com/careers-home/')
  assert.equal(BLACKLINE_CATALOG.atsPlatform, 'workday-jobs-api')
  assert.equal(BLACKLINE_CATALOG.countryFilter, 'India')
  assert.equal(BLACKLINE_CATALOG.verifiedIndiaLocationName, 'Bengaluru')
  assert.equal(BLACKLINE_CATALOG.verifiedIndiaLocationFacetId, '9574f3b33005100115a9633a90c20000')
  assert.equal(BLACKLINE_CATALOG.verifiedOn, '2026-07-23')
  assert.match(BLACKLINE_CATALOG.modulePath, /blackline[\\/]script\.js$/i)
})
