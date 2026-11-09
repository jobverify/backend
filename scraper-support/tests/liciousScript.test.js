import assert from 'node:assert/strict'
import test from 'node:test'
import * as licious from '../../scraper/licious/script.js'
import { liciousNativeOptions } from './fixtures/liciousNativeOptions.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('Licious exports the current corporate and MyNextHire endpoints', () => {
  assert.equal(licious.SOURCE, 'licious')
  assert.equal(licious.COMPANY, 'Licious')
  assert.equal(licious.VERIFIED_ON, '2026-10-26')
  assert.equal(licious.CAREERS_URL, 'https://www.licious.in/careers')
  assert.equal(licious.CURRENT_JOBS_URL, 'https://www.licious.in/careers/jobs')
  assert.equal(licious.PUBLIC_PORTAL_URL, 'https://licious.mynexthire.com/employer/jobs/careers')
  assert.equal(licious.LISTING_API_URL, 'https://licious.mynexthire.com/employer/careers/reqlist/get')
  assert.equal(licious.DETAIL_URL, 'https://licious.prod.in1.mynexthire.io/d17/careers/requisition/object')
})

test('Licious run wrapper forwards cancellation and native transport options', async () => {
  const options = liciousNativeOptions()
  const jobs = await licious.run({ ...options, maxJobs: 2 })
  assert.equal(jobs.length, 2)
  assert.equal(options.calls.filter(call => call.url.endsWith('/requisition/object')).length, 35)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Licious rejects a changed corporate handoff before requesting native inventory', async () => {
  await assert.rejects(licious.run({ fetchPage: async url => ({ status: 200, url, body: '<html><body>Unavailable</body></html>' }) }), /corporate careers handoff/i)
})
