import assert from 'node:assert/strict'
import test from 'node:test'

import { getCompanyAliasMap } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('SendGrid is registered as a verified custom script provider on the Twilio jobs surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sendgrid')

  assert.ok(provider)
  assert.equal(provider.companyName, 'SendGrid')
  assert.equal(provider.companyCareerPage, 'https://jobs.twilio.com/careers')
  assert.equal(provider.companyDomain, 'jobs.twilio.com')
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /sendgrid[\\/]script\.js$/i)
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.verifiedSurfaceSummary, /twilio\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /SendGrid/i)
})

test('SendGrid rebrand aliases resolve to the dedicated SendGrid provider', () => {
  const aliases = getCompanyAliasMap()

  assert.equal(aliases['Twilio SendGrid'], 'sendgrid')
  assert.equal(aliases.Sendgrid, 'sendgrid')
})
