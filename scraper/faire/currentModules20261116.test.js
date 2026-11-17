import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { faireAssets, faireBindings, runNativeFaire } from './native.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'

const records = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-http-20261116.json.gz', import.meta.url))))
const [primary, page, shared, employee, consultants] = records
const transport = (change = row => row) => async url => {
  const original = records.find(row => row.requestedURL === url)
  assert.ok(original, 'Only current official page-declared resources may be read: ' + url)
  const row = change(structuredClone(original))
  return { url: row.finalURL, status: row.status, headers: row.headers, body: Buffer.from(row.body), bodyComplete: true }
}

test('the localized current Faire page binds the advertised 30770 native module to both genuine inventories', () => {
  const assets = faireAssets(primary.body)
  assert.deepEqual(assets, { page: page.requestedURL, shared: shared.requestedURL })
  const bindings = faireBindings(page.body, shared.body, assets)
  assert.deepEqual(bindings.map(row => [row.nativeWorkType, row.boardToken]), [['EMPLOYMENT', 'faire'], ['CONSULTANT', 'faireconsultants']])
  assert.ok(bindings.every(row => row.bindingEvidence.evidenceURL === shared.requestedURL))
})

test('both current Faire inventories preserve discovery scope when all native roles are outside India', async () => {
  assert.equal(JSON.parse(employee.body).meta.total, 71)
  assert.equal(JSON.parse(consultants.body).meta.total, 0)
  const jobs = await runNativeFaire({ transport: transport() })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

for (const [name, change] of [
  ['a dormant module', body => body.replace('src="' + shared.requestedURL + '"', 'type="application/json" src="' + shared.requestedURL + '"')],
  ['an unrelated module host', body => body.replaceAll(shared.requestedURL, shared.requestedURL.replace('cdn.faire.com', 'unrelated.invalid'))],
  ['an additional active reviewed module', body => body + '<script src="https://cdn.faire.com/visitor/_next/static/chunks/18522-0000000000000000.js"></script>'],
]) test('current Faire discovery rejects ' + name, () => {
  const body = change(primary.body)
  assert.notEqual(body, primary.body)
  assert.throws(() => faireAssets(body), /shared careers module/)
})

for (const [name, before, after] of [
  ['a credentialed request', 'withCredentials:!1', 'withCredentials:!0'],
  ['an unrelated API', 'https://boards-api.greenhouse.io', 'https://unrelated.invalid'],
  ['a missing consultant scope', 'R.CY.CONSULTANT', 'R.CY.EMPLOYMENT'],
]) test('current Faire native dataflow rejects ' + name, () => {
  const body = shared.body.replaceAll(before, after)
  assert.notEqual(body, shared.body)
  assert.throws(() => faireBindings(page.body, body, { page: page.requestedURL, shared: shared.requestedURL }), /GET data flow|inventory hook/)
})

