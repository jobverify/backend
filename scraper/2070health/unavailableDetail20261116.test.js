import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/unavailable-native-http-20261116.json.gz', import.meta.url))))

async function exercise(change = value => value) {
  let reads = 0, rows, error
  try {
    await run({ rateLimitMs: 0, onRecords: value => { rows = value }, fetchImpl: async (url, init) => {
      const packet = packets[reads++]
      assert.ok(packet, 'Only the three actual primary, redirect and canonical observations may be read')
      assert.equal(url, packet.requestedURL)
      assert.equal(init.redirect, 'manual')
      const response = new Response(reads === 3 ? change(packet.body) : packet.body,
        { status: packet.status, headers: packet.headers })
      Object.defineProperty(response, 'url', { value: packet.finalURL })
      return response
    } })
  } catch (cause) { error = cause }
  return { error, reads, rows }
}

test('current native no-data detail preserves all 32 listings and raw response evidence as unavailable coverage', async () => {
  const { error, reads, rows } = await exercise()
  assert.equal(error?.code, 'HEALTH2070_NATIVE_ROLE_UNAVAILABLE')
  assert.equal(error.softFailure, true)
  assert.equal(error.failureKind, 'coverage_gap')
  assert.equal(error.sourceScopeComplete, false)
  assert.equal(error.lifecycleCleanupAllowed, false)
  assert.equal(reads, 3)
  assert.equal(rows.length, 32)
  assert.equal(error.nativeEvidence.primary.records.length, 32)
  assert.equal(error.nativeEvidence.detailRecords[0].nativeAvailability.notice, 'No data found in results.')
  assert.equal(error.nativeEvidence.observations[0].sourceDetailFailureReason, 'native-role-unavailable')
  assert.equal(error.nativeEvidence.companyIndiaTotal, null)
  assert.equal(Buffer.from(error.nativeEvidence.rawResponses[2].response.rawBodyBase64, 'base64').toString(), packets[2].body)
  assert.ok(rows.every(row => row.sourceDetailComplete === false && row.company === null))
})

for (const [name, change] of [
  ['hidden no-data notice', body => body.replace('No data found in results.', '<span hidden>No data found in results.</span>')],
  ['script-only notice', body => body.replace('No data found in results.', '<script>"No data found in results."</script>')],
  ['unreviewed missing content', body => body.replace('No data found in results.', 'Temporary page text')],
]) test('2070Health keeps ' + name + ' as an unqualified identity response', async () => {
  const { error } = await exercise(change)
  assert.equal(error?.code, 'HEALTH2070_NATIVE_IDENTITY_CONFLICT')
  assert.notEqual(error.softFailure, true)
  assert.equal(error.nativeEvidence.primary.records.length, 32)
})
