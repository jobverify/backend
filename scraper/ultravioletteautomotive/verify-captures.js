import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const root = new URL('./fixtures/', import.meta.url)
const sha256 = body => createHash('sha256').update(body).digest('hex')
export async function verifyCapturedInventory() {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)))
  const responses = []
  for (const file of manifest.files) {
    const stored = readFileSync(new URL(file.path, root))
    assert.equal(sha256(stored), file.storedSHA256, file.path)
    const exact = file.path.endsWith('.gz') ? gunzipSync(stored) : stored
    assert.equal(sha256(exact), file.exactJSONSHA256, file.path)
    const parsed = JSON.parse(exact)
    responses.push(...(Array.isArray(parsed) ? parsed : [parsed]))
  }
  for (const capture of manifest.responses) {
    const response = responses.find(response => response.url === capture.url)
    assert.ok(response, capture.url)
    assert.equal(sha256(response.body), capture.bodySHA256, capture.url)
    assert.equal(response.finalUrl, capture.finalUrl)
    assert.equal(response.status, capture.status)
    assert.equal(response.capturedAt, capture.capturedAt)
  }
  return run({ fetchImpl: async url => {
    const capture = responses.find(response => response.url === url)
    assert.ok(capture, 'Uncaptured URL ' + url)
    return { url: capture.finalUrl, status: capture.status, text: async () => capture.body }
  } })
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = await verifyCapturedInventory()
  writeFileSync(new URL('./jobs.json', import.meta.url), JSON.stringify(jobs, null, 2))
  writeFileSync(new URL('./inventory-evidence.json', import.meta.url), JSON.stringify(readInventoryEvidence(jobs), null, 2))
  console.log(JSON.stringify({ jobs: jobs.length, evidence: readInventoryEvidence(jobs) }))
}
