import assert from 'node:assert/strict'
import test from 'node:test'
import { runNativeCargill } from './nativeRun.js'
import { HOME } from './nativeContract.js'

test('Cargill preserves HTTP stage, status and request/final URLs in the failure', async () => {
  await assert.rejects(runNativeCargill({ fetchImpl: async () => ({ status: 202, url: HOME }) }), error => {
    assert.equal(error.code, 'CARGILL_HTTP_HOME_202')
    assert.equal(error.status, 202)
    assert.equal(error.stage, 'home')
    assert.equal(error.requestUrl, HOME)
    assert.equal(error.finalUrl, HOME)
    assert.match(error.message, /HTTP 202/)
    assert.ok(error.message.includes(HOME))
    return true
  })
})

test('blocked Cargill corporate responses remain structured soft failures without an inventory', async () => {
  await assert.rejects(runNativeCargill({ fetchImpl: async () => ({ status: 403, url: HOME }) }), error => {
    assert.equal(error.status, 403)
    assert.equal(error.stage, 'home')
    assert.equal(error.requestUrl, HOME)
    assert.equal(error.finalUrl, HOME)
    assert.equal(error.softFailure, true)
    assert.equal(error.failureKind, 'blocked_or_access_denied')
    assert.equal(error.abortRetries, true)
    return true
  })
})
