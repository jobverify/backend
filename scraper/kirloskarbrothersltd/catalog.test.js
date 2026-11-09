import assert from 'node:assert/strict'
import test from 'node:test'

import { getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Kirloskar Brothers Ltd provider metadata reflects the verified outage-aware careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kirloskarbrothersltd')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Kirloskar Brothers Ltd')
  assert.equal(provider.companyCareerPage, 'https://www.kirloskarpumps.com/careers/')
  assert.equal(provider.jobsListingsUrl, 'https://www.kirloskarpumps.com/jobs-listings/')
  assert.equal(provider.applicationFormUrl, 'https://www.kirloskarpumps.com/job/apply/candidate/')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /503/i)
})
