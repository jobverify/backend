import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createWorkablePublicApiScraper } from '../utils/workablePublicApi.js'

const folder = new URL('./fixtures/workableNativeCountryNames/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
const receipts = manifest.requests.map(row => {
  const body = gunzipSync(fs.readFileSync(new URL(row.filename, folder)))
  assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
  return { ...row, payload: JSON.parse(body) }
})
const hk = receipts.flatMap(row => row.payload.results).find(row => row.shortcode === 'EC74C80BF4')
assert.equal(hk.location.countryCode, 'HK')
assert.equal(hk.location.country, 'Hong Kong')

async function exercise(change) {
  const controller = new AbortController(), stop = Error('Stop before the first uncaptured native cursor page')
  let requests = 0, error
  try {
    await createWorkablePublicApiScraper({ source: 'interpathadvisory', company: 'Interpath Advisory',
      tenant: 'interpath-advisory', accountUid: manifest.accountUid, boardIdentityVerified: true }).run({
      signal: controller.signal, now: () => manifest.capturedAt,
      fetchJson: async (url, init) => {
        requests++
        const row = receipts.find(row => row.requestedURL === url && row.requestBody === init.body)
        if (!row) { controller.abort(stop); throw stop }
        const payload = structuredClone(row.payload)
        if (change) for (const record of payload.results) if (record.shortcode === hk.shortcode) {
          change(record.location)
          record.locations.forEach(change)
        }
        return payload
      },
    })
  } catch (failure) { error = failure }
  return { error, stop, requests }
}

test('accepts actual Workable HK country names before continuing the real native cursor inventory', async () => {
  const result = await exercise()
  assert.equal(result.error, result.stop)
  assert.equal(result.requests, receipts.length + 1)
})

for (const [label, change] of [
  ['India descriptor with HK code', location => { location.country = 'India' }],
  ['India code with Hong Kong descriptor', location => { location.countryCode = 'IN' }],
  ['unrecognized country descriptor', location => { location.country = 'Unqualified territory' }],
  ['missing country despite a known city', location => { location.country = null; location.city = 'Hong Kong' }],
]) test('Workable country-name support still rejects ' + label, async () => {
  const result = await exercise(change)
  assert.notEqual(result.error, result.stop)
  assert.match(result.error?.message || '', /country\/location scope/i)
})
