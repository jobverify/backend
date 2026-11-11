import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createIsocratesScraper,
  hasOfficialHomepageSignal,
  HOMEPAGE_URL,
  run,
} from '../scraper/isocrates/script.js'

// Constructed title/API protocols, not a genuine employer response or vacancy.
const homepage = suffix => `
  <title>Global Leader in MADTECH Resource Planning and Execution${suffix}</title>
  <h1>MADTECH (MarTech, AdTech &amp; DataTech) is complex, expensive, time-consuming, and hard to staff.</h1>
  <p>Picking the right business partner is crucial.</p>
  <a href="https://isocrates.com/careers/">Careers</a>
`

test('iSOCRATES accepts the literal trademark equivalent of its supported numeric entity', () => {
  assert.equal(hasOfficialHomepageSignal(homepage(String.fromCodePoint(0x2122))), true)
})

test('iSOCRATES retains its numeric trademark entity identity check', () => {
  assert.equal(hasOfficialHomepageSignal(homepage('&#x2122;')), true)
})

test('iSOCRATES retains its supported title without a trademark', () => {
  assert.equal(hasOfficialHomepageSignal(homepage('')), true)
})

test('iSOCRATES rejects the replacement character in its publisher title', () => {
  assert.equal(hasOfficialHomepageSignal(homepage(String.fromCodePoint(0xfffd))), false)
})

for (const [label, invoke] of [
  ['factory', options => createIsocratesScraper().run(options)],
  ['public export', options => run(options)],
]) {
  test(`iSOCRATES ${label} uses the supplied direct and browser transports`, async () => {
    const primary = new Error('Authored iSOCRATES transport failure')
    const calls = []
    const options = {
      fetchText: async url => {
        calls.push(['direct', url])
        throw primary
      },
      fetchBrowserText: async url => {
        calls.push(['browser', url])
        throw primary
      },
    }

    await assert.rejects(invoke(options), error => error === primary)
    assert.deepEqual(calls, [['direct', HOMEPAGE_URL], ['browser', HOMEPAGE_URL]])
  })
}
