import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { collect, inspectCurrentRoleSummaries, inspectEmptyPage } from '../../scraper/buffer.workday/native.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'

const packet = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/buffer.workday/test-data/current-open-role-20261105.json.gz', import.meta.url))))

test('Buffer current nonempty native summaries reconcile with the visible employer links', () => {
  const proof = inspectCurrentRoleSummaries(packet.body)
  assert.equal(proof.nativeRoles.count, 1)
  assert.equal(proof.observations[0].title, 'Engineering Manager, Growth')
  assert.equal(proof.observations[0].departmentName, 'Engineering')
  assert.equal(proof.observations[0].country, null)
  assert.equal(proof.observations[0].sourceDetailComplete, false)
  assert.throws(() => inspectEmptyPage(packet.body), /explicit empty/)
})

test('a current Buffer opening remains a positive observation with unknown India inventory, never verified zero', async () => {
  let requests = 0
  const jobs = await collect({ fetchPage: async () => { requests++; return structuredClone(packet) } })
  assert.equal(requests, 1)
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /observed-vacancies=1/)
  assert.equal(readSourceObservationEvidence(jobs, 'buffer').observedVacancyCount, 1)
})

test('Buffer refuses a native summary whose visible title or public role identity disagrees', () => {
  const id = '7085c73e-c2a7-4b2f-9a36-49d780e03c2a'
  const changedLink = packet.body.replace('/journey/' + id, '/journey/00000000-0000-0000-0000-000000000000')
  assert.notEqual(changedLink, packet.body)
  assert.throws(() => inspectCurrentRoleSummaries(changedLink), /identity disagrees/)
  const hiddenRole = packet.body.replace('href="/journey/' + id + '"', 'hidden href="/journey/' + id + '"')
  assert.notEqual(hiddenRole, packet.body)
  assert.throws(() => inspectCurrentRoleSummaries(hiddenRole), /links disagree/)
})
