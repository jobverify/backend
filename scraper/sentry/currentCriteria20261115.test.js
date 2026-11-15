import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { createSentryScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'

// Exact public corporate/API and canonical role responses captured on 2026-11-15.
// The two publishers disagree on this role even across stable opening/closing reads.
const captured = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-criteria-20261115.json.gz', import.meta.url))))
const CAREERS = 'https://sentry.io/careers/'
const API = 'https://api.ashbyhq.com/posting-api/job-board/sentry'
const ID = 'ad10ec02-e439-4e2b-9f2b-d32b5a8a4b7a'
const ROLE = `${CAREERS}${ID}/`

async function collect({ changeRole = html => html, closingRole = null, india = false, controller = null, abortAt = null } = {}) {
  const model = structuredClone(captured)
  if (india) {
    const location = 'Bengaluru, Karnataka, India'
    for (const packet of model.packets) {
      if (packet.url === API) {
        const payload = JSON.parse(packet.body), record = payload.jobs.find(job => job.id === ID)
        record.location = location
        record.address = { postalAddress: { addressCountry: 'India', addressRegion: 'Karnataka', addressLocality: 'Bengaluru' } }
        record.secondaryLocations = []
        packet.body = JSON.stringify(payload)
      } else {
        packet.body = packet.body.replace(/(\bprops=")([^"]*)(")/, (_match, before, raw, after) => {
          const props = JSON.parse(decodeNativeEntities(raw)), row = props.jobs[1].find(tuple => tuple[1].id[1] === ID)[1]
          row.info[1].locationName = [0, location]
          return before + JSON.stringify(props).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') + after
        })
        const locationSpan = new RegExp('(<a\\b[^>]*href="/careers/' + ID + '/"[^>]*>[\\s\\S]*?<span\\b[^>]*class="[^"]*_jobLocation_[^"]*"[^>]*>)([\\s\\S]*?)(</span>)')
        packet.body = packet.body.replace(locationSpan, (_match, before, _location, after) => before + location + after)
      }
    }
    model.role.body = model.role.body.replace(/San Francisco, California(?=\s*<\/p>)/, location)
  }
  const calls = []
  let roleReads = 0
  const fetchImpl = async (url, options = {}) => {
    options.signal?.throwIfAborted()
    calls.push(url)
    if (calls.length === abortAt) controller.abort(new Error('Stop Sentry role confirmation'))
    assert.ok(calls.length <= 10, 'bounded complete cohort and role-page reads')
    const packet = url === ROLE ? model.role : model.packets.find(packet => packet.url === url)
    assert.ok(packet, `unexpected public request: ${url}`)
    const body = url === ROLE ? (++roleReads === 2 && closingRole ? closingRole(packet.body) : changeRole(packet.body)) : packet.body
    const response = new Response(body, { status: packet.status, headers: { 'content-type': url === API ? 'application/json' : 'text/html' } })
    Object.defineProperty(response, 'url', { value: packet.finalUrl })
    return response
  }
  const pending = createSentryScraper({ fetchImpl }).run({ signal: controller?.signal, totalBudgetMs: 20000, requestTimeoutMs: 3000 })
  return { pending, calls }
}

test('Sentry resolves stable current criteria disagreement with the exact canonical employer role at opening and closing', async () => {
  const { pending, calls } = await collect()
  const jobs = await pending
  assert.equal(jobs.length, 0, 'the captured inventory contains no qualified India role')
  assert.equal(calls.filter(url => url === ROLE).length, 2)
  assert.equal(calls.length, 10)
  const audit = jobs.nativeCollectionEvidence
  assert.equal(audit.nativeRecords.length, 39)
  assert.equal(audit.cohortAttempts, 2)
  assert.equal(audit.discardedCohorts.length, 1)
  assert.equal(audit.criteriaReconciliations.length, 1)
  assert.equal(audit.criteriaReconciliations[0].id, ID)
  assert.equal(audit.criteriaReconciliations[0].sourceUrl, ROLE)
  assert.equal(audit.criteriaReconciliations[0].descriptionSource, 'corporate-role')
  assert.equal(audit.opening.payload.jobs.find(job => job.id === ID).descriptionHtml,
    JSON.parse(captured.packets[1].body).jobs.find(job => job.id === ID).descriptionHtml)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
})

test('Sentry emits confirmed canonical criteria for a controlled India role while preserving the contradictory raw API record', async () => {
  const { pending } = await collect({ india: true })
  const jobs = await pending
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, ID)
  assert.equal(jobs[0].country, 'India')
  assert.match(jobs[0].sourceDescription, /A big part of the team/)
  assert.notEqual(jobs[0].sourceDescription, jobs[0].sourceNativeListingRecord.descriptionHtml)
  assert.equal(jobs[0].sourceDescription, jobs[0].sourceNativeCorporateRole.info.descriptionHtml)
  assert.equal(jobs[0].sourceCriteriaEvidence.sourceUrl, ROLE)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

for (const [label, changeRole] of [
  ['wrong title', html => html.replaceAll('Engineering Manager, Infrastructure', 'Different employer role')],
  ['wrong employer application identity', html => html.replaceAll(`https://jobs.ashbyhq.com/sentry/${ID}`, `https://jobs.ashbyhq.com/foreign/${ID}`)],
  ['hidden criteria', html => html.replace('class="job-description-content"', 'class="job-description-content" hidden')],
  ['explicit closed-role notice', html => html.replace('</body>', '<p>This role is closed.</p></body>')],
  ['third conflicting description', html => html.replace('A big part of the team', 'A mandatory unreviewed qualification is required. A big part of the team')],
]) test(`Sentry rejects canonical role evidence with ${label}`, async () => {
  const { pending } = await collect({ changeRole })
  await assert.rejects(pending, error => error.failureKind === 'parser_or_contract_error')
})

test('Sentry rejects a canonical role that changes between opening and closing', async () => {
  const { pending } = await collect({ closingRole: html => html.replace('A big part of the team', 'Changed mandatory requirements. A big part of the team') })
  await assert.rejects(pending, error => error.failureKind === 'parser_or_contract_error')
})

test('Sentry preserves caller cancellation during canonical role confirmation', async () => {
  const controller = new AbortController()
  const { pending, calls } = await collect({ controller, abortAt: 7 })
  await assert.rejects(pending, error => error === controller.signal.reason)
  assert.equal(calls.length, 7)
})
