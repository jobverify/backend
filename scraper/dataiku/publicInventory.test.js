import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence, isCompleteScraperAttempt, isFreshCompleteInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'
import { createDataikuPublicRead, HOME, JOBS, OFFICES, LIMITS } from './publicRead.js'

// This test composes the retained20-response native cohort with two copies of
// the separately captured office protocol. It is not a new live observation.
const capture = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/current-native-20261101.json.gz', import.meta.url))))
const officeCapture = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/offices-20261101.json.gz', import.meta.url))))
const officeOriginal = JSON.parse(Buffer.from(officeCapture.rawBodyBase64, 'base64').toString('utf8'))
const target = capture.audit.openingRecords[0]
const indiaOffice = officeOriginal.offices.find(office => office.name === 'India, Remote')
const reference = ({ id, name, location, parent_id, child_ids }) => ({ id, name, location, parent_id, child_ids })
const clock = capture.completedAt

async function execute({ india = false, mutate, signal, onNativeResponse, now = () => clock } = {}) {
  const calls = [], requestOptions = [], occurrences = new Map()
  const future = row => { if (india && row?.id === target.id) { row.location = { name: 'Bengaluru, India' }; row.offices = [reference(indiaOffice)] } }
  const fetchImpl = async (url, init = {}) => {
    calls.push(url)
    requestOptions.push({ redirect: init.redirect, credentials: init.credentials })
    const occurrence = (occurrences.get(url) || 0) + 1; occurrences.set(url, occurrence)
    let packet, body
    if (url === OFFICES) {
      packet = officeCapture
      const model = structuredClone(officeOriginal)
      if (india) {
        let brief
        for (const office of model.offices) for (const department of office.departments) {
          for (const row of department.jobs) if (row.id === target.id) brief ||= structuredClone(row)
          department.jobs = department.jobs.filter(row => row.id !== target.id)
        }
        brief.location = { name: 'Bengaluru, India' }
        const office = model.offices.find(item => item.id === indiaOffice.id)
        office.departments.find(item => item.id === target.departments[0].id).jobs.push(brief)
      }
      body = JSON.stringify(model)
    } else {
      const matches = capture.packets.filter(item => item.url === url)
      assert.ok(matches.length, 'Unadvertised native test request ' + url)
      packet = matches[Math.min(occurrence - 1, matches.length - 1)]
      body = Buffer.from(packet.rawBodyBase64, 'base64').toString('utf8')
      if (url !== HOME) {
        const model = JSON.parse(body)
        for (const row of model.jobs || [model]) future(row)
        body = JSON.stringify(model)
      }
    }
    const observed = { url, occurrence, status: packet.status, finalUrl: packet.finalUrl, body, headers: { ...packet.headers } }
    mutate?.(observed)
    const response = new Response(observed.body, { status: observed.status, headers: observed.headers })
    Object.defineProperty(response, 'url', { value: observed.finalUrl })
    return response
  }
  let audit
  const provider = getScraperCatalog().find(item => item.source === 'dataiku')
  const jobs = await createCatalogScraper(provider).run({ fetchImpl, signal, now, onNativeResponse, onAudit: value => { audit = value } })
  return { jobs, audit, calls, requestOptions, evidence: readInventoryEvidence(jobs), provider }
}
const partial = result => {
  assert.equal(result.evidence.listingComplete, false)
  assert.equal(result.evidence.reportedTotal, null)
  assert.equal(result.evidence.indiaFacetCount, null)
  assert.equal(result.evidence.verifiedAt, null)
  for (const job of result.jobs) {
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
}

test('actual registered24-response capture replays with byte hashes and its original certification clock', async () => {
  const observed = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/registered-public-20261101.json.gz', import.meta.url))))
  assert.equal(observed.kind, 'actual-bounded-current-registered-public-source')
  const pending = new Map()
  for (const packet of observed.packets) {
    if (!pending.has(packet.url)) pending.set(packet.url, [])
    pending.get(packet.url).push(packet)
  }
  let count = 0
  const fetchImpl = async url => {
    const packet = pending.get(url)?.shift()
    assert.ok(packet, 'No extra or repeated native response')
    const body = Buffer.from(packet.rawBodyBase64, 'base64')
    assert.equal(body.length, packet.bodyBytes)
    assert.equal(createHash('sha256').update(body).digest('hex'), packet.bodySHA256)
    count++
    const response = new Response(body, { status: packet.status, headers: packet.headers })
    Object.defineProperty(response, 'url', { value: packet.finalUrl })
    return response
  }
  const expectedAt = observed.audit.publicInventoryScope.verifiedAt
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'dataiku')).run({ fetchImpl, now: () => expectedAt })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(count, 24)
  assert.ok([...pending.values()].every(values => values.length === 0))
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.reportedTotal, 16)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.verifiedAt, expectedAt)
})

test('registered Dataiku uses the conditional public wrapper and reconciles both native protocols', async () => {
  const result = await execute()
  assert.match(result.provider.modulePath.replaceAll('\\', '/'), /\/dataiku\/publicInventory\.js$/)
  assert.equal(result.jobs.length, 0)
  assert.equal(result.calls.length, 24)
  assert.ok(result.requestOptions.every(init => init.redirect === 'manual' && init.credentials === 'omit'))
  assert.equal(result.evidence.status, 'complete-inventory')
  assert.equal(result.evidence.listingComplete, true)
  assert.equal(result.evidence.reportedTotal, 16, 'actual publisher meta.total')
  assert.equal(result.evidence.indiaFacetCount, 0)
  assert.equal(result.evidence.verifiedAt, clock)
  assert.equal(result.audit.openingRecords.length, 16)
  assert.equal(result.audit.details.length, 16)
  assert.equal(result.audit.publicInventoryScope.complete, true)
  assert.equal(result.audit.publicInventoryScope.privateApplicationActivation, null)
  assert.equal(isCompleteScraperAttempt({ success: true, completedAt: clock, inventoryEvidence: result.evidence,
    detailHealth: extractionDetailHealth(result.jobs) }), true)
  assert.equal(isFreshCompleteInventoryEvidence(result.evidence, { now: new Date(+new Date(clock) + 49 * 3600000) }), false)
})

test('future India role retains exact full native fields, paired detail and original publication', async () => {
  const result = await execute({ india: true })
  assert.equal(result.jobs.length, 1)
  const [job] = result.jobs
  assert.equal(job.sourceNativePayload.id, target.id)
  assert.equal(job.sourceDescription, target.content)
  assert.equal(job.sourceNativeDetailPayload.content, target.content)
  assert.equal(job.sourceNativePayload.first_published, target.first_published)
  assert.equal(Date.parse(job.postingDate), Date.parse(target.first_published))
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.sourceListingComplete, true, result.evidence.reason)
  assert.equal(job.sourceScopeComplete, true)
  assert.equal(job.lifecycleCleanupAllowed, true)
  assert.equal(result.evidence.indiaFacetCount, 1)
})

test('later office country drift preserves the fully validated opening India role', async () => {
  const result = await execute({ india: true, mutate: response => {
    if (response.url === OFFICES && response.occurrence === 2) {
      const model = JSON.parse(response.body)
      model.offices.find(office => office.name === 'United States, Remote').name = 'Unknown region'
      response.body = JSON.stringify(model)
    }
  } })
  partial(result)
  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].sourceDescription, target.content)
})

test('an incomplete native closing retains the already paired full India detail', async () => {
  const result = await execute({ india: true, mutate: response => {
    if (response.url === JOBS && response.occurrence > 1) {
      const model = JSON.parse(response.body); model.jobs.pop(); model.meta.total--
      response.body = JSON.stringify(model)
    }
  } })
  partial(result)
  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].sourceDescription, target.content)
  assert.equal(result.jobs[0].sourceDetailComplete, true)
  assert.equal(result.audit.openingRecords.length, 16)
  assert.equal(result.audit.details.length, 16)
})

test('new corporate recruiting control withdraws certification without losing verified India criteria', async () => {
  const result = await execute({ india: true, mutate: response => {
    if (response.url === HOME) response.body = response.body.replace('</body>', '<iframe srcdoc="&lt;a href=&quot;https://jobs.lever.co/dataiku&quot;&gt;Open roles&lt;/a&gt;"></iframe></body>')
  } })
  partial(result)
  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].sourceDescription, target.content)
})

test('post-detail office denial ends native-host reads and preserves the earlier India role', async () => {
  let denied = false
  const result = await execute({ india: true, mutate: response => {
    if (response.url === OFFICES && response.occurrence === 2) {
      denied = true; response.status = 403; response.headers['content-length'] = String(LIMITS.bodyBytes + 1)
    } else if (denied && response.url.includes('boards-api')) assert.fail('Read after a denied native host')
  } })
  partial(result)
  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].sourceDescription, target.content)
})

for (const observerFailure of [false, true]) test('native closing denial retains paired India data' + (observerFailure ? ' despite observer failure' : ''), async () => {
  let denied = false
  const result = await execute({ india: true, mutate: response => {
    if (response.url === JOBS && response.occurrence === 2) {
      denied = true; response.status = 403; response.body = 'Denied'
    } else if (denied && response.url.includes('boards-api')) assert.fail('Native host read after closing denial')
  }, onNativeResponse: response => {
    if (observerFailure && response.status === 403) throw new Error('controlled observer failure')
  } })
  partial(result)
  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].sourceDescription, target.content)
  assert.equal(result.jobs[0].sourceDetailComplete, true)
  assert.equal(result.audit.closingPayload, null)
  assert.equal(result.audit.details.length, 16)
})

test('unsupported metadata remains present and cannot qualify a full detail', async () => {
  const result = await execute({ india: true, mutate: response => {
    if (!response.url.includes('boards-api') || response.url === OFFICES) return
    const model = JSON.parse(response.body)
    for (const row of model.jobs || [model]) if (row.id === target.id) row.mandatoryLicense = 'Controlled future licence criterion'
    response.body = JSON.stringify(model)
  } })
  partial(result)
  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].sourceNativePayload.mandatoryLicense, 'Controlled future licence criterion')
  assert.equal(result.jobs[0].sourceDetailComplete, false)
})

test('unreviewed office eligibility criteria remain raw and revoke affected detail qualification', async () => {
  const result = await execute({ india: true, mutate: response => {
    if (response.url !== OFFICES) return
    const model = JSON.parse(response.body)
    model.offices.find(office => office.id === indiaOffice.id).mandatoryLicense = 'Controlled office-specific licence criterion'
    response.body = JSON.stringify(model)
  } })
  partial(result)
  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].sourceDescription, target.content)
  assert.equal(result.jobs[0].sourceDetailComplete, false)
  assert.equal(result.audit.publicInventoryScope.openingOffices.offices.find(office => office.id === indiaOffice.id).mandatoryLicense,
    'Controlled office-specific licence criterion')
})

test('caller cancellation during the final proof preserves the exact reason', async () => {
  const controller = new AbortController(), reason = Object.freeze({ kind: 'controlled final Dataiku cancellation' })
  let officeReads = 0
  await assert.rejects(execute({ india: true, signal: controller.signal, onNativeResponse: response => {
    if (response.url === OFFICES && ++officeReads === 2) controller.abort(reason)
  } }), error => error === reason)
})

test('invalid proof clocks retain positive details with unknown inventory certification', async () => {
  const result = await execute({ india: true, now: () => null })
  partial(result)
  assert.equal(result.jobs.length, 1)
})

test('HTTP read count is bounded without issuing an extra request', async () => {
  let actual = 0
  const io = createDataikuPublicRead({ fetchImpl: async url => {
    actual++; const response = new Response('<html>Dataiku</html>', { headers: { 'Content-Type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: url }); return response
  } })
  try {
    for (let count = 0; count < LIMITS.requests; count++) await io.read(HOME)
    await assert.rejects(io.read(HOME), /budget/)
    assert.equal(actual, LIMITS.requests)
    assert.equal(io.audit.requests, LIMITS.requests)
  } finally { io.dispose() }
})

test('bytes consumed by failed streams still count against the aggregate source budget', async () => {
  const chunk = new Uint8Array(2 * 1024 * 1024)
  let actual = 0
  const io = createDataikuPublicRead({ fetchImpl: async url => {
    actual++; let parts = 0
    const response = new Response(new ReadableStream({ pull(controller) { controller.enqueue(chunk); if (++parts === 2) controller.close() } }))
    Object.defineProperty(response, 'url', { value: url }); return response
  } })
  try {
    for (let count = 0; count < 16; count++) await assert.rejects(io.read(HOME), /body exceeds/)
    await assert.rejects(io.read(HOME), /budget/)
    assert.equal(actual, 16)
    assert.equal(io.audit.totalBytes, LIMITS.totalBytes)
  } finally { io.dispose() }
})
