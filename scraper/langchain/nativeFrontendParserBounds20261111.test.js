import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { verifyNativeFrontend } from './nativeFrontendContract.js'

// Synthetic source text is parsed as data; it is never executed. Genuine full
// module and fingerprint acceptance remain covered by the existing fixture tests.
function verify(body, check = () => {}) {
  const entryURL = 'https://example.invalid/native-parser-control.js'
  const entrySRI = 'sha384-' + createHash('sha384').update(body).digest('base64')
  return verifyNativeFrontend({}, { entryURL, entrySRI }, { status: 200, url: entryURL, body }, check)
}
const queryMissing = error => error.failureKind === 'coverage_gap' && /program query binding changed/.test(error.message)

test('native parser observes cancellation during construction and preserves the exact reason', () => {
  const reason = new Error('synthetic construction cancellation')
  let checks = 0
  assert.throws(() => verify(';'.repeat(5000), () => {
    if (++checks >= 3) throw reason
  }), error => error === reason)
  assert.equal(checks, 4)
})

test('nested native verification retains the outer parser callback and node progress', () => {
  const innerReason = new Error('synthetic nested cancellation')
  let outerChecks = 0, innerChecks = 0, nested = 0
  assert.throws(() => verify(';'.repeat(5000), () => {
    if (++outerChecks === 3) {
      nested++
      assert.throws(() => verify(';'.repeat(5000), () => {
        if (++innerChecks >= 3) throw innerReason
      }), error => error === innerReason)
    }
  }), queryMissing)
  assert.equal(nested, 1)
  assert.equal(outerChecks, 7)
  assert.equal(innerChecks, 4)
})

test('native parser enforces the original construction bound independently on each attempt', () => {
  assert.throws(() => verify(';'.repeat(1500000)), error => error.failureKind === 'coverage_gap'
    && /program AST construction bound exceeded/.test(error.message))
  assert.throws(() => verify(';'.repeat(5000)), queryMissing)
})

test('native parser rejects syntax errors as an explicit coverage gap', () => {
  assert.throws(() => verify('const ='), error => error.failureKind === 'coverage_gap'
    && /program AST parse contract changed/.test(error.message))
})

test('native parser checks the unchanged body size and actual SRI before parsing', () => {
  assert.throws(() => verify(' '.repeat(8000001)), error => error.failureKind === 'coverage_gap'
    && /current manifest entry body unavailable/.test(error.message))
  assert.throws(() => verifyNativeFrontend({}, { entryURL: 'https://example.invalid/entry.js', entrySRI: 'sha384-invalid' },
    { status: 200, url: 'https://example.invalid/entry.js', body: ';' }, () => {}), error => error.failureKind === 'coverage_gap'
    && /actual entry SRI integrity mismatch/.test(error.message))
})
