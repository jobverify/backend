import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createCriblScraper } from './native20261107.js'
import { classifyScraperError } from '../../scraper-support/utils/failureClassification.js'

const original = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-unavailable-role-http-20261116.json.gz', import.meta.url))))

async function exercise(change = () => {}) {
  const records = structuredClone(original)
  change(records)
  let reads = 0, error
  try {
    await createCriblScraper().run({ rateLimitMs: 0, now: () => '2026-11-16T18:00:00.000Z', fetchImpl: async (url, init) => {
      const row = records[reads++]
      assert.ok(row, 'Only captured official opening inventory and own-role requests may be read')
      assert.equal(url, row.requestedURL)
      assert.equal(init.redirect, 'manual')
      const response = new Response(row.body, { status: row.status, headers: row.headers })
      Object.defineProperty(response, 'url', { value: row.finalURL })
      return response
    } })
  } catch (cause) { error = cause }
  return { error, reads }
}

test('the actual declared Cribl canonical role 404 retains all 79 listings and 22 full models as unavailable coverage', async () => {
  const { error, reads } = await exercise()
  assert.equal(error?.code, 'CRIBL_NATIVE_ROLE_UNAVAILABLE')
  assert.equal(error.status, 404)
  assert.equal(error.softFailure, true)
  assert.equal(error.failureKind, 'coverage_gap')
  assert.deepEqual(classifyScraperError(error), { softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap' })
  assert.equal(error.sourceScopeComplete, false)
  assert.equal(error.lifecycleCleanupAllowed, false)
  assert.equal(reads, 49)
  assert.equal(error.nativeEvidence.observedRecordCount, 79)
  assert.equal(error.nativeEvidence.ownNativeModels, 22)
  assert.equal(error.nativeEvidence.rawResponses.length, 49)
  const role = error.nativeEvidence.observations.find(row => row.nativeId === '6123159004')
  assert.equal(role.nativeAvailability.status, 'unavailable')
  assert.equal(role.nativeRecord, null)
  const receipt = error.nativeEvidence.rawResponses.at(-1).response
  assert.equal(receipt.url, 'https://cribl.io/job-detail/6123159004/')
  assert.equal(receipt.status, 404)
  assert.equal(Buffer.from(receipt.rawBodyBase64, 'base64').toString(), original.at(-1).body)
  assert.equal(error.nativeEvidence.companyIndiaTotal, null)
})

for (const [name, change, reads] of [
  ['primary 404', rows => { rows[0].status = 404 }, 1],
  ['renderer 404', rows => { rows[1].status = 404 }, 2],
  ['a different final URL on a role 404', rows => { rows.at(-1).finalURL = 'https://cribl.io/job-detail/other/' }, 49],
]) test('Cribl keeps ' + name + ' outside the declared-role unavailable contract', async () => {
  const result = await exercise(change)
  assert.equal(result.reads, reads)
  assert.notEqual(result.error?.code, 'CRIBL_NATIVE_ROLE_UNAVAILABLE')
  assert.notEqual(result.error?.softFailure, true)
  assert.notEqual(classifyScraperError(result.error).failureKind, 'coverage_gap')
  if (name.includes('different final URL')) assert.equal(classifyScraperError(result.error).softFailure, false)
  assert.equal(result.error.sourceScopeComplete, false)
  assert.equal(result.error.lifecycleCleanupAllowed, false)
})
