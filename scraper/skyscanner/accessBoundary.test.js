import test from 'node:test'
import assert from 'node:assert/strict'
import { run } from './script.js'
test('Skyscanner classifies a redirected CAPTCHA as denied public access without requesting a native board or retrying', async () => {
  let nativeCalls = 0
  await assert.rejects(run({
    fetchPage: async () => ({ status: 200, url: 'https://www.skyscanner.com/sttc/px/captcha-v2/index.html?url=abc', html: '<title>Skyscanner</title>' }),
    fetchJson: async () => { nativeCalls++; throw Error('Native feed cannot substitute for current employer proof') },
  }), error => error.abortRetries === true && error.softFailure === true && error.failureKind === 'public_access_denied')
  assert.equal(nativeCalls, 0)
})
