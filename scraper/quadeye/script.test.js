import assert from 'node:assert/strict'
import test from 'node:test'

import { hasOfficialCareersPageSignal } from './script.js'

const careersHtml = (canonical) => `
  <title>Jobs | quadeye</title>
  <link rel="canonical" href="${canonical}" />
  <h2>Open Roles</h2><span>Loading roles…</span>
  <a href="/career">Beyond the Screens</a>
  <a href="/contact-us">Contact Us</a>
`

test('QuadEye recognizes its current official jobs page with the updated canonical URL', () => {
  assert.equal(hasOfficialCareersPageSignal(careersHtml('https://quadeye.cyralix.com//jobs')), true)
  assert.equal(hasOfficialCareersPageSignal(careersHtml('https://www.quadeye.com/jobs')), true)
  assert.equal(hasOfficialCareersPageSignal(careersHtml('https://unrelated.example/jobs')), false)
})
