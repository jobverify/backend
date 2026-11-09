import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { run } from './script.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/retained-http-20261029.json.gz', import.meta.url))))
const bytes = Buffer.from(fixture.bodyBase64, 'base64')
assert.equal(createHash('sha256').update(bytes).digest('hex'), fixture.receipt.sha256)
const actual = () => JSON.parse(bytes.toString('utf8'))
const replay = (closing = payload => payload) => {
  const calls = []
  return { calls, async fetchJson(url, init) {
    assert.equal(url, fixture.receipt.url)
    calls.push({ url, signal: init.signal })
    const payload = actual()
    return calls.length === 2 ? closing(payload) : payload
  } }
}

test('actual27 native roles close twice without resolving seven secondary Remote scopes', async () => {
  assert.equal(fixture.provenance.currentHTTPProof, false)
  const transport = replay(), jobs = await run(transport)
  assert.equal(transport.calls.length, 2)
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.reportedTotal, 27, 'observed native count, not a company-wide total')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /remote.*scope/i)
  assert.deepEqual(jobs.nativeClosingEvidence.opening, actual())
  assert.deepEqual(jobs.nativeClosingEvidence.closing, actual())
  assert.equal(jobs.nativeClosingEvidence.companyGlobalTotal, null)
  assert.equal(jobs.nativeClosingEvidence.companyIndiaTotal, null)
  assert.equal(jobs.nativeClosingEvidence.lifecycleCleanupAllowed, false)
  assert.equal(jobs.nativeClosingEvidence.reconciled, true)
})

const changes = {
  'missing role': rows => rows.pop(),
  identity: rows => { rows[0].id = rows[1].id },
  title: rows => { rows[0].text += ' changed' },
  'plain criteria': rows => { rows[0].descriptionBodyPlain += ' Additional mandatory criterion.' },
  'HTML criteria': rows => { rows[0].descriptionBody += '<p>Additional mandatory criterion.</p>' },
  'list criterion': rows => { rows[0].lists[0].content += '<p>Additional qualification.</p>' },
  'additional criteria': rows => { rows[0].additionalPlain += ' Mandatory condition.' },
  'creation metadata': rows => { rows[0].createdAt++ },
  'publication field': rows => { rows[0].datePosted = '2026-10-29' },
  'country alternative': rows => { rows[0].categories.allLocations.push('Unknown additional location') },
  country: rows => { rows[0].country = 'CA' },
  'application identity': rows => { rows[0].applyUrl += '?changed=1' },
  'unknown nested schema': rows => { rows[0].lists[0].mandatoryLicense = { name: 'Actual schema drift counterfactual' } },
  'removed field': rows => { delete rows[0].openingPlain },
}
test('closing order alone preserves the same full native identity cohort and raw order', async () => {
  const transport = replay(rows => rows.reverse()), jobs = await run(transport)
  assert.equal(transport.calls.length, 2)
  assert.deepEqual(jobs.nativeClosingEvidence.opening, actual())
  assert.deepEqual(jobs.nativeClosingEvidence.closing, actual().reverse())
  assert.equal(jobs.nativeClosingEvidence.reconciled, true)
})
for (const [name, mutate] of Object.entries(changes)) test(`closing ${name} drift rejects the opening inventory`, async () => {
  // Counterfactual drift in an unchanged authentic cohort, not newly observed jobs.
  const transport = replay(rows => { mutate(rows); return rows })
  await assert.rejects(run(transport), /closing native inventory/i)
  assert.equal(transport.calls.length, 2)
})

test('closing transport failure propagates instead of returning the opening result', async () => {
  const error = Error('Offline closing transport failure')
  await assert.rejects(run(replay(() => { throw error })), candidate => candidate === error)
})

test('caller cancellation after closing transport cannot return inventory', async () => {
  const controller = new AbortController(), error = Error('Stop closing verification')
  const transport = replay(rows => { controller.abort(error); return rows })
  await assert.rejects(run({ ...transport, signal: controller.signal }), candidate => candidate === error)
})

test('current selected registered Finix producer performs both native reads', async () => {
  const row = getScraperCatalog().find(provider => provider.source === 'finix')
  assert.equal(row.adapter, 'script')
  assert.match(row.modulePath.replaceAll('\\', '/'), /\/scraper\/finix\/script\.js$/)
  const transport = replay(), jobs = await createCatalogScraper(row).run(transport)
  assert.equal(transport.calls.length, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('registered decoration preserves access to both raw arrays through source audit callback', async () => {
  const row = getScraperCatalog().find(provider => provider.source === 'finix')
  const audits = [], transport = replay()
  await createCatalogScraper(row).run({ ...transport, onAudit: audit => audits.push(audit) })
  assert.equal(audits.length, 1)
  assert.deepEqual(audits[0].opening, actual())
  assert.deepEqual(audits[0].closing, actual())
  assert.equal(audits[0].companyGlobalTotal, null)
  assert.equal(audits[0].companyIndiaTotal, null)
  assert.equal(audits[0].lifecycleCleanupAllowed, false)
})
