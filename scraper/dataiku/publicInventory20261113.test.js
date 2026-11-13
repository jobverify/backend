import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'
import { decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'

const captured = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/current-public-20261113.json.gz', import.meta.url))))
const HOME = 'https://www.dataiku.com/company/careers'
const replay = async (mutate = () => {}, options = {}) => {
  const pending = [...captured.packets], provider = getScraperCatalog().find(row => row.source === 'dataiku')
  let callbackAudit
  const jobs = await createCatalogScraper(provider).run({ ...options, now: () => captured.completedAt,
    onAudit: async value => { callbackAudit = value; await options.onAudit?.(value) },
    fetchImpl: async url => {
      const at = pending.findIndex(row => row.url === url)
      assert.notEqual(at, -1, 'recorded current native request ' + url)
      const packet = structuredClone(pending.splice(at, 1)[0]), bytes = Buffer.from(packet.rawBodyBase64, 'base64')
      assert.equal(createHash('sha256').update(bytes).digest('hex'), packet.bodySHA256)
      assert.equal(bytes.length, packet.bodyBytes)
      packet.body = bytes.toString('utf8')
      mutate(packet)
      const response = new Response(packet.body, { status: packet.status, headers: packet.headers })
      Object.defineProperty(response, 'url', { value: packet.finalUrl })
      return response
    } })
  return { jobs, audit: jobs.nativeCollectionEvidence || callbackAudit, assessment: assessSoftFailureAcquisition(provider, jobs) }
}

test('Dataiku current declared board reconciles fifteen foreign roles independently of unreviewed company scope', async () => {
  const { jobs, audit, assessment } = await replay()
  assert.equal(jobs.length, 0)
  assert.equal(assessment.runnerOutcome.success, true)
  assert.equal(assessment.zeroJobEvidence, 'fetched-zero')
  assert.equal(assessment.inventoryEvidence.reportedTotal, 15)
  assert.equal(assessment.inventoryEvidence.lifecycleCleanupAllowed, false)
  assert.equal(assessment.cleanupOptions.replaceExisting, false)
  assert.equal(audit.details.length, 15)
  assert.equal(audit.publicInventoryScope.openingCountryProof.complete, true)
  assert.equal(audit.publicInventoryScope.openingCountryProof.indiaRoleIds.length, 0)
  assert.equal(audit.publicInventoryScope.openingScope.qualified, false)
  assert.ok(audit.publicInventoryScope.companyScopeReasons.includes('current-public-employer-scope-unreviewed'))
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(jobs.nativeCollectionEvidence.details.length, 15)
})

test('Dataiku full originally authored criteria displaced offscreen cannot certify a board zero', async () => {
  const { assessment, audit } = await replay(packet => {
    if (!packet.url.includes('/jobs')) return
    const payload = JSON.parse(packet.body)
    for (const row of payload.jobs || [payload]) if (row.id === 6236320004) {
      row.content = '<div style="position:fixed;left:-9999px">' + decodeNativeEntities(row.content) + '</div>'
    }
    packet.body = JSON.stringify(payload)
  })
  assert.equal(assessment.zeroJobEvidence, 'coverage-gap')
  assert.equal(assessment.inventoryEvidence.listingComplete, false)
  assert.ok(audit.publicInventoryScope.reasons.some(reason => /criteria/.test(reason)))
  assert.equal(assessment.cleanupOptions.replaceExisting, false)
})

test('Dataiku current board still requires the exact visible employer handoff', async () => {
  await assert.rejects(replay(packet => {
    if (packet.url === HOME) packet.body = packet.body.replaceAll('https://job-boards.greenhouse.io/dataiku', 'https://job-boards.greenhouse.io/another-employer')
  }), /handoff/i)
})

test('Dataiku caller cancellation bounds an ignoring terminal audit observer', async () => {
  const controller = new AbortController(), reason = { cancelled: 'dataiku-terminal-audit' }
  let notifyEntered, release
  const entered = new Promise(resolve => { notifyEntered = resolve })
  const held = new Promise(resolve => { release = resolve })
  const task = replay(() => {}, { signal: controller.signal, onAudit: () => { notifyEntered(); return held } })
    .then(() => null, error => error)
  await entered
  controller.abort(reason)
  const result = await Promise.race([task, new Promise(resolve => setTimeout(() => resolve('unbounded audit observer'), 60))])
  release()
  await task
  assert.equal(result, reason)
})
