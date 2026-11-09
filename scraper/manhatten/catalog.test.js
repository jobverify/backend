import assert from 'node:assert/strict'
import test from 'node:test'

import MANHATTEN_CATALOG from './catalog.js'

test('publishes registration metadata for the verified Manhattan Associates provider', () => {
  assert.equal(MANHATTEN_CATALOG.source, 'manhatten')
  assert.equal(MANHATTEN_CATALOG.companyName, 'Manhattan Associates')
  assert.equal(MANHATTEN_CATALOG.officialBrandName, 'Manhattan Associates')
  assert.equal(MANHATTEN_CATALOG.companyCareerPage, 'https://www.manh.com/en-in/about-us/careers')
  assert.equal(MANHATTEN_CATALOG.atsPlatform, 'workday-jobs-api')
  assert.equal(MANHATTEN_CATALOG.countryFilter, 'India')
  assert.equal(MANHATTEN_CATALOG.verifiedIndiaLocationName, 'Bangalore')
  assert.equal(MANHATTEN_CATALOG.verifiedIndiaLocationFacetId, 'ba9cd6cb4b2310c69665202f09dbe48e')
  assert.equal(MANHATTEN_CATALOG.verifiedOn, '2026-07-23')
  assert.match(MANHATTEN_CATALOG.modulePath, /manhatten[\\/]script\.js$/i)
})
