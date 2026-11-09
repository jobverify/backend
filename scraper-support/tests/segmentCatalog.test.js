import assert from 'node:assert/strict'
import test from 'node:test'

import { getCompanyAliasMap } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('Segment is registered as a verified custom script provider on the Twilio jobs surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'segment')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Segment')
  assert.equal(provider.officialBrandName, 'Twilio Segment')
  assert.equal(provider.companyCareerPage, 'https://jobs.twilio.com/careers')
  assert.equal(provider.companyDomain, 'jobs.twilio.com')
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /segment[\\/]script\.js$/i)
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.verifiedSurfaceSummary, /jobs\.twilio\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /Segment/i)
})

test('Segment rebrand aliases resolve to the dedicated Segment provider', () => {
  const aliases = getCompanyAliasMap()

  assert.equal(aliases['Twilio Segment'], 'segment')
})
