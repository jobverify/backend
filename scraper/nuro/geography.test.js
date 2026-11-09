import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parseNativeInventory } from './script.js'

const original = JSON.parse(JSON.parse(readFileSync(new URL('./fixtures/jobs-response.json', import.meta.url))).body).jobs[0]
const role = (id, location) => ({ ...original, id, absolute_url: `https://nuro.ai/careersitem?gh_jid=${id}`, location: { name: location } })

test('Nuro excludes the observed Santa Clara California label without dropping India roles', () => {
  const result = parseNativeInventory({ jobs: [role(1001, 'California - Santa Clara'), role(1002, 'Bengaluru, Karnataka, India')], meta: { total: 2 } })
  assert.equal(result.total, 2)
  assert.deepEqual(result.jobs.map(job => [job.jobId, job.country]), [['1002', 'India']])
})

test('Nuro still rejects unproven or conflicting geography beside the California label', () => {
  for (const location of ['Santa Clara', 'California - Santa Clara, India', 'California - Santa Clara / Remote', 'California - Unknown']) {
    assert.throws(() => parseNativeInventory({ jobs: [role(1001, location)], meta: { total: 1 } }), /Nuro .*geography/)
  }
})
