import assert from 'node:assert/strict'
import test from 'node:test'
import { run, HOMEPAGE_URL, CONTACT_URL, CAREERS_URL } from './script.js'

const home = '<title>BaaziGames</title><h1>Baazi Games</h1><p>Founded in 2014</p><p>talent.acquisition@moonshinetechnology.com</p>'
const contact = '<h1>Contact Us</h1><p>talent.acquisition@moonshinetechnology.com</p>'
const denied = '<?xml version="1.0"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>'

for (const status of [200, 401, 403, 429]) test('Baazi keeps a denied careers inventory unavailable after HTTP ' + status, async () => {
  const calls = []
  await assert.rejects(run({
    now: () => '2026-10-31T06:00:00.000Z',
    fetchPage: async url => {
      calls.push(url)
      if (url === HOMEPAGE_URL) return { status: 200, url, html: home }
      if (url === CONTACT_URL) return { status: 200, url, html: contact }
      assert.equal(url, CAREERS_URL, 'Stop on the denied published careers authority')
      return { status, url, html: denied }
    },
  }), error => {
    assert.equal(error.code, 'access_denied')
    assert.equal(error.failureKind, 'incomplete_listing')
    assert.equal(error.abortRetries, true)
    assert.equal(error.status, status)
    assert.match(error.primaryInventoryUnavailable, /inventory.*unavailable/i)
    assert.equal(error.inventoryEvidence.status, 'coverage-gap')
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    assert.equal(error.inventoryEvidence.indiaFacetCount, null)
    return true
  })
  assert.deepEqual(calls, [HOMEPAGE_URL, CONTACT_URL, CAREERS_URL])
})
