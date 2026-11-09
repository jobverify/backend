import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const native = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261102.json.gz', import.meta.url))))
const replay = ({ drift } = {}) => {
  const reads = new Map()
  return { fetchPage: async url => {
    const page = structuredClone(native.find(page => page.url === url) || assert.fail(url))
    const count = (reads.get(url) || 0) + 1
    reads.set(url, count)
    if (drift && url.includes('/job/Ingolstadt-Prinicipal-') && count > 1) page.bodyBase64 = Buffer.from(Buffer.from(page.bodyBase64, 'base64').toString('utf8').replaceAll('next-generation software', 'new-generation software')).toString('base64')
    return page
  } }
}

test('Cariad qualifies the declared6-role native German board only after repeating full own-role criteria and country models', async () => {
  let audit
  const jobs = await run({ ...replay(), onAudit: value => { audit = value } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 6)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  assert.equal(audit.ownModelStabilityQualified, true)
  assert.equal(audit.companyWideCoverageClaimed, false)
  assert.equal(audit.opening.reportedTotal, 6)
  assert.equal(audit.closing.reportedTotal, 6)
  assert.equal(audit.openingPass.observations.length, 6)
  assert.equal(audit.closingPass.observations.length, 6)
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.equal(audit.declaredBoardScopeComplete, true)
})

test('Cariad keeps a coverage gap when native full criteria change between its own complete passes', async () => {
  const jobs = await run(replay({ drift: true }))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

for (const callback of ['onRecords', 'onAudit']) test(`Cariad preserves caller cancellation while its final ${callback} callback remains pending`, async () => {
  const controller = new AbortController()
  let timer
  try {
    const operation = run({ ...replay(), signal: controller.signal, [callback]: () => {
      controller.abort(new Error(`caller-abort during ${callback}`))
      return new Promise(() => {})
    } })
    await assert.rejects(Promise.race([operation, new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('forwarded callback ignored caller cancellation')), 800)
    })]), /caller-abort/)
  } finally { clearTimeout(timer) }
})
