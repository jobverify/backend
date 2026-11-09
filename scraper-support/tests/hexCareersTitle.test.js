import assert from 'node:assert/strict'
import test from 'node:test'
import { hasVerifiedCareersLandingSignal } from '../../scraper/hex/script.js'

test('Hex accepts its current branded careers title while retaining location and company checks', () => {
  const html = '<title>Hex Careers - Join the Team | Hex</title><h1>Make everyone a data person</h1><p>It&#x27;s just &quot;Hex&quot;!</p><p>We&#x27;re hiring in San Francisco, New York, and remote.</p>'
  assert.equal(hasVerifiedCareersLandingSignal(html), true)
  assert.equal(hasVerifiedCareersLandingSignal(html.replace('Hex Careers - Join the Team | Hex', 'Unrelated company')), false)
  assert.equal(hasVerifiedCareersLandingSignal(html.replace('San Francisco, New York, and remote.', 'India.')), false)
})
