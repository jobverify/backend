import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { run } from '../scraper/bluebinaries/script.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../scraper-support/utils/sourceObservationEvidence.js'

const directory = new URL('../scraper/bluebinaries/test-data/current-react-contract-20261111/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', directory), 'utf8'))
const expected = JSON.parse(fs.readFileSync(new URL('derived-native-literal-models.json', directory), 'utf8'))
const hash = value => createHash('sha256').update(value).digest('hex')
const packets = manifest.packets.map(row => {
  const metadata = fs.readFileSync(new URL(row.metadata, directory))
  const body = fs.readFileSync(new URL(row.bodyFile, directory))
  assert.equal(hash(metadata), row.metadataSHA256)
  assert.equal(hash(body), row.bodySHA256)
  return { ...JSON.parse(metadata), body: body.toString('utf8') }
})
assert.equal(hash(JSON.stringify(expected.models)), expected.literalModelSHA256)
const [home, entry] = packets
const sequence = [home, entry, home, entry]

// Genuine retained opening packets are returned for separate logical closing reads.
// This is an offline replay, never a contemporaneous current closing acquisition.
const replay = (change = () => undefined) => {
  const reads = []
  const fetchPage = async (url, request) => {
    const index = reads.length
    reads.push({ url, method: request.method })
    assert.ok(index < sequence.length, 'No uncaptured native URL or extra request is admitted')
    assert.equal(url, sequence[index].url)
    const packet = sequence[index]
    const page = { url: packet.url, status: packet.status, body: packet.body, contentType: packet.contentType, headers: Object.fromEntries(packet.headers) }
    return (await change({ index, page, request })) ?? page
  }
  return { reads, fetchPage }
}
const currentError = error => error?.code === 'BLUEBINARIES_REACT_CONTRACT'
const reasonCases = [
  ['null', null], ['false', false], ['zero', 0], ['empty', ''],
  ['frozen', Object.freeze({ source: 'BlueBinaries caller' })], ['default', undefined],
]

test('current genuine root and declared program retain nine held observations after separate closing reads', async () => {
  const transport = replay()
  let audit
  const jobs = await run({ fetchPage: transport.fetchPage, onAudit: value => { audit = value } })
  assert.equal(jobs.length, 0)
  assert.deepEqual(transport.reads.map(row => row.url), sequence.map(row => row.url))
  assert.ok(transport.reads.every(row => row.method === 'GET'))
  assert.deepEqual(audit.publicPages.map(row => row.phase), ['initial', 'initial', 'closing', 'closing'])
  assert.equal(audit.observedGlobalCount, 9)
  assert.equal(audit.closingReconciled, true)
  assert.equal(audit.scopeComplete, false)
  assert.equal(audit.cleanupEligible, false)
  assert.equal(audit.indiaJobCount, null)
  const native = jobs.nativeCurrentReactEvidence
  assert.deepEqual(native.observations.map(row => row.sourceNativeFields), expected.models)
  assert.deepEqual(audit.nativeJobs.map(row => row.sourceNativeFields), expected.models)
  assert.deepEqual(native.observations.map(row => row.country), [null, null, null, null, null, null, 'United Kingdom', 'United Kingdom', 'Austria'])
  assert.ok(native.observations.every(row => row.jobId === null && row.requisitionId === null && row.sourceIdentityComplete === false))
  assert.ok(native.observations.every(row => row.sourceDetailComplete === false && row.jobDescription === null && row.sourceDescription === null))
  assert.ok(native.observations.every(row => row.applyUrl === null && row.sourceCleanupEligible === false))
  assert.match(native.observations[0].sourceNativeFields.description, /MISRA-C/)
  assert.equal(native.closingEvidence.contemporaneousAcquisitionVerified, false)
  assert.equal(native.sourceScopeComplete, false)
  assert.equal(native.companyScopeComplete, false)
  assert.equal(native.lifecycleCleanupAllowed, false)
  assert.deepEqual(readSourceObservationEvidence(jobs, 'bluebinaries'), { source: 'bluebinaries', recordKind: 'hiring-signals', observedRecordCount: 9, observedVacancyCount: 0, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'coverage-gap')
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
})

test('current output cap never truncates raw observations or creates an India count', async () => {
  const transport = replay()
  let audit
  const jobs = await run({ maxJobs: 1, fetchPage: transport.fetchPage, onAudit: value => { audit = value } })
  assert.equal(jobs.length, 0)
  assert.equal(jobs.nativeCurrentReactEvidence.observations.length, 9)
  assert.equal(audit.outputCapped, false)
  assert.equal(audit.indiaJobCount, null)
  assert.equal(transport.reads.length, 4)
})

for (const [name, mutate] of [
  ['changed root bytes', value => value + '\n'],
  ['foreign declared program origin', value => value.replace('./static/js/', 'https://example.invalid/static/js/')],
  ['duplicate declared program', value => value.replace('</head>', '<script src="./static/js/main.726414c5.js"></script></head>')],
]) test('current branch rejects ' + name + ' before entry or native observations', async () => {
  let audits = 0
  const transport = replay(({ index, page }) => index === 0 ? { ...page, body: mutate(page.body) } : undefined)
  await assert.rejects(run({ fetchPage: transport.fetchPage, onAudit: () => { audits++ } }), currentError)
  assert.equal(transport.reads.length, 1)
  assert.equal(audits, 0)
})

for (const [name, body] of [
  ['unknown complete program', entry.body + '\n'],
  ['mutated native model', entry.body.replace('Software Developer', 'Changed Native Title')],
  ['foreign employer document', packets[4].body],
  ['foreign SPA program document', packets[5].body],
]) test('current branch rejects ' + name + ' before facts or closing', async () => {
  let audits = 0
  const transport = replay(({ index, page }) => index === 1 ? { ...page, body } : undefined)
  await assert.rejects(run({ fetchPage: transport.fetchPage, onAudit: () => { audits++ } }), currentError)
  assert.equal(transport.reads.length, 2)
  assert.equal(audits, 0)
})

for (const [name, changed, message] of [
  ['entry final origin', { url: 'https://example.invalid/static/js/main.js' }, /URL identity changed/],
  ['entry public denial', { status: 403 }, /denied/i],
  ['entry invalid body', { body: null }, /invalid or oversized public response/],
]) test('current transport fails closed on ' + name, async () => {
  let audits = 0
  const transport = replay(({ index, page }) => index === 1 ? { ...page, ...changed } : undefined)
  await assert.rejects(run({ fetchPage: transport.fetchPage, onAudit: () => { audits++ } }), message)
  assert.equal(transport.reads.length, 2)
  assert.equal(audits, 0)
})

for (const [name, index] of [['closing root', 2], ['closing program', 3]]) {
  test('current branch refuses changed ' + name + ' before native observations', async () => {
    let audits = 0
    const transport = replay(value => value.index === index ? { ...value.page, body: value.page.body + '\n' } : undefined)
    await assert.rejects(run({ fetchPage: transport.fetchPage, onAudit: () => { audits++ } }), currentError)
    assert.equal(transport.reads.length, index + 1)
    assert.equal(audits, 0)
  })
  test('current branch preserves ordinary missing ' + name + ' failure identity', async () => {
    const primary = new Error('captured transport has no ' + name)
    let audits = 0
    const transport = replay(value => { if (value.index === index) throw primary })
    await assert.rejects(run({ fetchPage: transport.fetchPage, onAudit: () => { audits++ } }), error => error === primary)
    assert.equal(transport.reads.length, index + 1)
    assert.equal(audits, 0)
  })
}

for (const [label, reason] of reasonCases) {
  test('current pre-aborted caller retains ' + label + ' without a request', async () => {
    const controller = new AbortController()
    controller.abort(reason)
    const transport = replay()
    await assert.rejects(run({ signal: controller.signal, fetchPage: transport.fetchPage }), error => error === controller.signal.reason)
    assert.equal(transport.reads.length, 0)
  })
  for (const [stage, index] of [['opening entry', 1], ['closing entry', 3]]) test('current ' + stage + ' caller retains ' + label + ' through rejected producer', async () => {
    const controller = new AbortController()
    let audits = 0
    const transport = replay(value => {
      if (value.index !== index) return undefined
      controller.abort(reason)
      return Promise.reject(new Error('producer rejected after caller cancellation'))
    })
    await assert.rejects(run({ signal: controller.signal, fetchPage: transport.fetchPage, onAudit: () => { audits++ } }), error => error === controller.signal.reason)
    assert.equal(transport.reads.length, index + 1)
    assert.equal(audits, 0)
  })
}

test('current aggregate budget still bounds a noncooperative entry wait', async () => {
  const transport = replay(({ index }) => index === 1 ? new Promise(() => {}) : undefined)
  await assert.rejects(run({ collectionBudgetMs: 15, fetchPage: transport.fetchPage }), /deadline/i)
  assert.equal(transport.reads.length, 2)
})

test('current cancelled late entry rejection remains owned', async () => {
  const controller = new AbortController()
  let rejectLate
  const transport = replay(({ index }) => {
    if (index !== 1) return undefined
    controller.abort(false)
    return new Promise((_, reject) => { rejectLate = reject })
  })
  await assert.rejects(run({ signal: controller.signal, fetchPage: transport.fetchPage }), error => error === false)
  rejectLate(new Error('late retained transport rejection'))
  await nextTurn()
  assert.equal(transport.reads.length, 2)
})

test('current observation clock cancellation precedes audit and output', async () => {
  const controller = new AbortController()
  let audits = 0
  const transport = replay()
  await assert.rejects(run({ signal: controller.signal, fetchPage: transport.fetchPage, now: () => { controller.abort(null); return '2026-11-11T14:00:00Z' }, onAudit: () => { audits++ } }), error => error === null)
  assert.equal(audits, 0)
})

test('current audit preserves ordinary rejection identity', async () => {
  const primary = new Error('ordinary current audit failure')
  let audits = 0
  const transport = replay()
  await assert.rejects(run({ fetchPage: transport.fetchPage, onAudit: () => { audits++; throw primary } }), error => error === primary)
  assert.equal(audits, 1)
})

test('current audit cancellation retains caller identity through synchronous throw', async () => {
  const controller = new AbortController()
  const transport = replay()
  await assert.rejects(run({ signal: controller.signal, fetchPage: transport.fetchPage, onAudit: () => { controller.abort(0); throw new Error('audit replacement must lose') } }), error => error === 0)
})

test('current reentrant audits cannot share or replace native models', async () => {
  const outer = replay(), inner = replay()
  let nested
  const jobs = await run({ fetchPage: outer.fetchPage, onAudit: async value => {
    value.nativeJobs[0].sourceNativeFields.description = 'caller changed only its audit clone'
    nested = await run({ fetchPage: inner.fetchPage })
  } })
  assert.equal(outer.reads.length, 4)
  assert.equal(inner.reads.length, 4)
  assert.deepEqual(jobs.nativeCurrentReactEvidence.observations.map(row => row.sourceNativeFields), expected.models)
  assert.deepEqual(nested.nativeCurrentReactEvidence.observations.map(row => row.sourceNativeFields), expected.models)
})

test('current branch preserves invalid cap validation before transport', async () => {
  const transport = replay()
  await assert.rejects(run({ maxJobs: -1, fetchPage: transport.fetchPage }), /invalid output budget/)
  assert.equal(transport.reads.length, 0)
})


// These controls augment a genuine old homepage with authored widgets/examples;
// the augmented documents are compatibility models, not additional HTTP captures.
const oldPackets = JSON.parse(gunzipSync(fs.readFileSync(new URL('../scraper/bluebinaries/test-data/native-20261103.json.gz', import.meta.url))))
const oldHome = oldPackets.findLast(row => row.requestedUrl === home.url)
assert.equal(hash(oldHome.html), oldHome.sha256)
for (const [name, document] of [
  ['comment example', oldHome.html + '<!-- <div id="root"></div><script src="/static/js/main.inert.js"></script> -->'],
  ['template example', oldHome.html + '<template><div id="root"></div><script src="/static/js/main.inert.js"></script></template>'],
  ['encoded example', oldHome.html + '<pre>&lt;div id="root"&gt;&lt;/div&gt;&lt;script src="/static/js/main.inert.js"&gt;&lt;/script&gt;</pre>'],
  ['unrelated active root widget', oldHome.html + '<div id="root">Unrelated authored legacy widget</div>'],
  ['mixed React root with accepted legacy handoff', home.body.replace('<div id="root"></div>', '<div id="root"><title>BlueBinaries</title><a href="/become-a-bluebee/">Careers</a></div>')],
]) test('accepted legacy handoff keeps priority for ' + name, async () => {
  const stop = new Error('Stop before the next uncaptured legacy entity')
  const reads = []
  let audits = 0
  await assert.rejects(run({ fetchPage: async url => {
    reads.push(url)
    if (reads.length > 1) throw stop
    return { url: home.url, status: 200, body: document }
  }, onAudit: () => { audits++ } }), error => error === stop)
  assert.equal(reads.length, 2)
  assert.notEqual(reads[1], entry.url)
  assert.equal(audits, 0)
})

test('current synchronous genuine-program inspection honors the existing aggregate budget before closing or facts', async () => {
  const transport = replay()
  let audits = 0
  await assert.rejects(run({ collectionBudgetMs: 1, fetchPage: transport.fetchPage, onAudit: () => { audits++ } }), { name: 'TimeoutError', code: 'PUBLIC_NATIVE_COLLECTION_TIMEOUT', message: 'BlueBinaries native: collection deadline exceeded' })
  assert.equal(transport.reads.length, 2)
  assert.equal(audits, 0)
})
