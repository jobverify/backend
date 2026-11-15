import assert from 'node:assert/strict'
import test from 'node:test'
import * as script from './script.js'
import {getScraperCatalog, createCatalogScraper} from '../../scraper-support/providers/index.js'
import {clock, replay, selectedIDs, profile, fixture, originalBytes, caught, editJSON, editHTML, editSSR, NOW, sha} from './fixtures/replayNativeData20261115.js'
import {readInventoryEvidence, sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {setImmediate as turn} from 'node:timers/promises'

globalThis.fetch = async () => {throw Error('Network forbidden in saved-response tests')}

for (const [name, start] of [
  ['factory', options => {assert.equal(typeof script.createKukuFMScraper, 'function'); return script.createKukuFMScraper().run(options)}],
  ['exported run', options => script.run(options)],
  ['registered native route', options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'kukufm')).run(options)],
]) test(name + ' preserves all six genuine complete native India roles including Android questions', async t => {
  const r = replay(), jobs = await clock(t, () => start(r.options))
  assert.deepEqual(jobs.map(job => Number(job.jobId)), selectedIDs)
  assert.equal(r.calls.length, 48)
  assert.ok(jobs.every(job => job.applyUrl === null && job.link === null && job.postingDate === null))
  const android = jobs.find(job => job.jobId === '427353')
  assert.equal(android.sourceNativeQuestions.length, 3)
  assert.equal(android.sourceNativeQuestions[0].label, 'Yes/No')
  assert.deepEqual(android.sourceNativeQuestions[0].choices, [])
})

const run = (t, r, options = {}) => clock(t, () => script.run({...r.options, ...options}))
const first = profile.reviewedSelectedRoles[0], android = profile.reviewedSelectedRoles[1]
const boardURL = profile.nativeBoard.requestedURL
const apiURL = first.nativeAPIURL, roleURL = first.nativeLandingURL
const hold = async (t, mutate, pattern = /Kuku FM native data coverage gap/, options = {}) => {
  const r = replay(mutate), error = await caught(() => run(t, r, options))
  assert.match(error.message, pattern)
  assert.equal(error.sourceScopeComplete, false)
  assert.equal(error.lifecycleCleanupAllowed, false)
  assert.equal(r.audits.length, 0, 'Failed acquisition cannot deliver a success audit')
  return {r, error}
}

test('genuine fixture retains all48 originals and actual24 same-URL byte pairs', () => {
  assert.equal(fixture.entities.length, 48)
  assert.equal(fixture.entities.reduce((n, row) => n + originalBytes(row.index).length, 0), 2367918)
  for (let i = 0; i < 48; i++) {
    assert.equal(sha(originalBytes(i)), fixture.entities[i].originalReceipt.sha256)
    if (i < 24) {
      assert.deepEqual(originalBytes(i), originalBytes(i + 24))
      assert.equal(fixture.entities[i].originalReceipt.requestedURL, fixture.entities[i + 24].originalReceipt.requestedURL)
    }
  }
})

test('all original criteria and complete question models survive while every unproved scope stays held', async t => {
  const r = replay(), jobs = await run(t, r)
  assert.equal(r.audits.length, 1)
  const audit = r.audits[0]
  assert.equal(audit.recordKind, 'vacancy-rows')
  assert.equal(audit.observedRecordCount, 76)
  assert.equal(audit.observedVacancyCount, 76)
  assert.equal(audit.unhydratedNativeRecordCount, 70)
  assert.equal(audit.pairedNativeDetailCount, 6)
  assert.equal(audit.pairedPublicRoleCount, 6)
  assert.equal(audit.physicalRequests, 48)
  assert.equal(audit.originalEntityBytes, 2367918)
  assert.deepEqual(audit.closingReservation, {physicalReads: 24, kindCeilingBytes: 7602176, timeMs: 45000})
  assert.deepEqual(audit.opening, audit.closing)
  assert.equal(audit.observations.filter(row => row.qualified).length, 6)
  assert.equal(audit.rawPages.length, 48)
  assert.deepEqual(audit.rawPages.map(row => row.rawEntitySHA256), fixture.entities.map(row => row.originalReceipt.sha256))
  for (const job of jobs) {
    const expected = profile.reviewedSelectedRoles.find(row => String(row.id) === job.jobId)
    assert.deepEqual(job.sourceNativeRecord, expected.reviewedComplete35FieldNativeDTO)
    assert.deepEqual(job.sourceNativeSSR.props.pageProps.job, expected.reviewedComplete35FieldNativeDTO)
    assert.equal(Object.keys(job.sourceNativeRecord).length, 35)
    assert.ok(job.jobDescription.startsWith(expected.reviewedComplete35FieldNativeDTO.description))
    for (const question of expected.reviewedComplete35FieldNativeDTO.job_screening_questions) {
      assert.ok(job.jobDescription.includes(question.question.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')))
    }
    assert.deepEqual(job.sourceNativeQuestions, expected.reviewedComplete35FieldNativeDTO.job_screening_questions)
    assert.equal(job.sourceNativeCreatedAt, expected.reviewedComplete35FieldNativeDTO.created_at)
    assert.equal(job.closingDate, expected.reviewedComplete35FieldNativeDTO.valid_through)
    assert.equal(job.sourceUrl, expected.nativeLandingURL)
    assert.equal(job.nativeJobLandingURL, expected.nativeLandingURL)
    assert.equal(job.sourceNativeAPIURL, expected.nativeAPIURL)
    assert.equal(job.sourceNativeCompanyWebsite, profile.reviewedNativeCompany.url)
    assert.equal(job.applyUrl, null)
    assert.equal(job.link, null)
    assert.equal(job.postingDate, null)
    assert.equal(job.postedAt, null)
    assert.equal(job.schemaCountry, null)
    for (const key of ['sourceCorporateBindingQualified', 'sourceFormalLegalEntityQualified', 'sourceActivationComplete',
      'sourceRenderedCriteriaComplete', 'sourceApplicationQualificationComplete', 'sourceScopeComplete', 'sourceListingComplete', 'lifecycleCleanupAllowed']) assert.equal(job[key], false)
    assert.equal(job.sourceEvidenceScope, 'native-role-criteria-as-data-only')
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.sourceNativeTextComplete, true)
  }
  assert.ok(jobs.find(job => job.jobId === '425354').jobDescription.includes('/edit'))
  assert.ok(!r.calls.some(call => call.url.includes('google.com') || call.url.includes('apply_now')))
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.deepEqual(readSourceObservationEvidence(jobs, 'kukufm'), {
    source: 'kukufm', recordKind: 'vacancy-rows', observedRecordCount: 76, observedVacancyCount: 76,
    sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null})
})

for (const [name, change] of [
  ['foreign country', job => {job.country = 'United States'}],
  ['mixed-country literal worksite', job => {job.location = 'New York, United States; Bangalore Urban, Karnataka, India'}],
  ['another India worksite', job => {job.location = 'Pune, Maharashtra, India'}],
  ['secondary foreign worksite', job => {job.other_locations = ['London, United Kingdom']}],
  ['native internal status', job => {job.published_internally = true}],
  ['full criteria', job => {job.description += '<p>Unreviewed mandatory skill</p>'}],
  ['explicit closed criteria', job => {job.description = '<p>This position is closed. We are no longer accepting applications.</p>'}],
  ['employer email domain', job => {job.email_domain = 'different.example'}],
  ['new native publication carrier', job => {job.datePosted = NOW}],
  ['native date precision', job => {job.created_at = '2026-11-12T14:48:52.115+05:30'}],
  ['impossible native calendar', job => {job.valid_through = '2027-02-30T14:48:52.115237+05:30'}],
  ['native date changed', job => {job.valid_through = '2028-01-11T14:48:52.115237+05:30'}],
  ['structured criteria', job => {job.skill = []}],
  ['unknown complete DTO field', job => {job.descriptionV2 = 'Alternate criteria'}],
]) test('consistent API/public full native mutation stays held: ' + name, async t => {
  await hold(t, (url, entity) => {
    if (url === apiURL) return editJSON(entity, change)
    if (url === roleURL) return editSSR(entity, model => change(model.props.pageProps.job))
    return entity
  }, /Complete reviewed35-field|Native calendar|Native microsecond|Native chronology|worksite/)
})

for (const [name, change] of [
  ['invented yes-no choices', q => {q[0].choices = ['Yes', 'No']}],
  ['unreviewed question kind', q => {q[0].name = 'boolean'}],
  ['unreviewed label', q => {q[0].label = 'Multiple choice'}],
  ['removed required flag', q => {q[0].mandatory = false}],
  ['changed exact question', q => {q[0].question += ' Remotely allowed.'}],
  ['unreviewed numerical range', q => {q[0].minimum_range = 0}],
  ['missing question', q => {q.pop()}],
  ['duplicate question', q => {q.push(structuredClone(q[0]))}],
]) test('Android original question model is not widened: ' + name, async t => {
  await hold(t, (url, entity) => {
    if (url === android.nativeAPIURL) return editJSON(entity, job => change(job.job_screening_questions))
    if (url === android.nativeLandingURL) return editSSR(entity, model => change(model.props.pageProps.job.job_screening_questions))
    return entity
  }, /Complete reviewed35-field/)
})

for (const [name, change] of [
  ['count', page => {page.count = 77}], ['unknown schema', page => {page.jobs = []}],
  ['duplicate row', page => {page.results[1] = page.results[0]}],
  ['row order', page => {page.results.reverse()}], ['missing row', page => {page.results.pop()}],
  ['changed country', page => {page.results[0].country = 'Unknown'}],
  ['foreign next URL', page => {page.next = 'https://foreign.example/jobs'}],
  ['missing next page', page => {page.next = null}],
]) test('complete finite page and pagination contract rejects ' + name, async t => {
  await hold(t, (url, entity) => url === profile.listingPages[0].requestedURL ? editJSON(entity, change) : entity, /Complete ordered native page/)
})

for (const [name, mutate] of [
  ['extra script', text => text.replace('</head>', '<script src="https://example.com/criteria.js"></script></head>')],
  ['extra stylesheet', text => text.replace('</head>', '<link rel="STYLESHEET" href="https://example.com/criteria.css"></head>')],
  ['hidden criterion', text => text.replace('</head>', '<style>.c-title{display:none}</style></head>')],
  ['extra form question', text => text.replace('</body>', '<label>Mandatory new question<input required></label></body>')],
  ['unknown alternate data owner', text => text.replace('</body>', '<script type="application/json" id="other">{}</script></body>')],
  ['native JSON owner attributes', text => text.replace('id="__NEXT_DATA__"', 'id="__NEXT_DATA__" hidden')],
  ['prefix byte', text => text.replace('<!DOCTYPE html>', '<!doctype html>')],
  ['suffix byte', text => text + ' '],
]) test('complete public carrier raw envelope rejects ' + name, async t => {
  await hold(t, (url, entity) => url === roleURL ? editHTML(entity, mutate) : entity, /Complete original public carrier envelope|strict complete JSON|Trailing literal data/)
})

for (const [name, change] of [
  ['native company', model => {model.props.pageProps.companyDetails.name = 'Another employer'}],
  ['native account', model => {model.query.company_uuid = 'OTHER'}],
  ['role query', model => {model.query.job_id = '427353'}],
  ['new native data sibling', model => {model.props.pageProps.alternateDescription = '<p>Other criteria</p>'}],
  ['unknown application carrier', model => {model.props.pageProps.applyURL = 'https://example.com/apply'}],
]) test('full SSR non-job context rejects ' + name, async t => {
  await hold(t, (url, entity) => url === roleURL ? editSSR(entity, change) : entity, /Complete native API\/SSR\/company\/query/)
})

for (const [name, url] of [['board', boardURL], ...profile.wholeCriticalClients.map((row, index) => ['program' + index, row.requestedURL])]) {
  for (const [mutation, alter] of [['BOM', bytes => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes])],
    ['same-size byte', bytes => {const value = Buffer.from(bytes); value[value.length - 1] ^= 1; return value}]]) {
    test(name + ' admits authoritative original entity bytes, rejects ' + mutation, async t => {
      await hold(t, (current, entity) => current === url ? {...entity, bytes: alter(entity.bytes)} : entity, /Original BOM|Whole original board\/program/)
    })
  }
}

for (const [name, mutate, pattern] of [
  ['closing board', (url, e) => url === boardURL && e.call.occurrence === 1 ? {...e, bytes: Buffer.concat([e.bytes, Buffer.from(' ')])} : e, /Whole original/],
  ['closing last page', (url, e) => url === profile.listingPages[7].requestedURL && e.call.occurrence === 1 ? editJSON(e, value => {value.results.reverse()}) : e, /Complete ordered/],
  ['closing complete detail', (url, e) => url === apiURL && e.call.occurrence === 1 ? editJSON(e, value => {value.job_screening_questions = [] ; value.description += '<p>New skill</p>'}) : e, /Complete reviewed35-field/],
  ['closing public bytes', (url, e) => url === roleURL && e.call.occurrence === 1 ? {...e, bytes: Buffer.concat([e.bytes, Buffer.from(' ')])} : e, /Complete original public/],
]) test('all selected output is held on ' + name, async t => {await hold(t, mutate, pattern)})

for (const status of [301, 307, 401, 403, 404, 429, 451, 500]) test('native HTTP ' + status + ' stops all reads and retains physical status', async t => {
  const {r, error} = await hold(t, (_url, entity) => ({...entity, status}), new RegExp('Native HTTP ' + status))
  assert.equal(r.calls.length, 1)
  assert.equal(error.status, status)
  assert.equal(error.nativeCollectionEvidence.rawPages[0].status, status)
})
for (const [name, change] of [
  ['prefollow', e => ({...e, redirected: true})], ['URL', e => ({...e, url: 'https://other.example/'})],
  ['missing URL', e => ({...e, url: ''})], ['charset', e => ({...e, headers: {'content-type': 'text/html;charset=iso-8859-1'}})],
  ['missing MIME', e => ({...e, headers: {}})], ['unsupported MIME', e => ({...e, headers: {'content-type': 'application/json'}})],
]) test('full original Response authority rejects ' + name, async t => {
  await hold(t, (_url, e) => change(e), /authority|MIME/)
})

for (const [name, value] of [['maxRequests', 47], ['maxPages', 7], ['maxDetails', 5], ['maxJobs', 5]]) test('downward ' + name + ' cannot release an incomplete selected closure', async t => {
  const r = replay(), error = await caught(() => run(t, r, {[name]: value}))
  assert.match(error.message, /Complete48|complete selected/)
  assert.equal(r.calls.length, 0)
})
for (const [name, value] of [['maxRequests', 49], ['maxPages', NaN], ['maxDetails', -1], ['sourceTimeoutMs', 90001],
  ['requestTimeoutMs', Infinity], ['openingTimeoutMs', 0], ['maxEntityBytes', 0], ['maxAggregateBytes', 24000001], ['onAudit', true], ['onRecords', []]]) test('invalid input is rejected before physical reads: ' + name, async () => {
  const r = replay()
  await assert.rejects(() => script.run({...r.options, [name]: value}), /Invalid/)
  assert.equal(r.calls.length, 0)
})

test('all native roles expired is an explicit held coverage gap, never verified zero', async t => {
  const r = replay(), error = await caught(() => run(t, r, {now: () => '2027-02-01T00:00:00.000Z'}))
  assert.match(error.message, /No paired unexpired/)
  assert.equal(r.calls.length, 48)
  assert.equal(error.nativeCollectionEvidence.exclusions.length, 6)
  assert.equal(error.lifecycleCleanupAllowed, false)
})
test('native exact expiry excludes only unavailable roles after full physical closure', async t => {
  const r = replay(), jobs = await run(t, r, {now: () => '2027-01-06T00:00:00.000Z'})
  assert.deepEqual(jobs.map(job => Number(job.jobId)), [427400, 427353])
  assert.equal(r.calls.length, 48)
  assert.equal(r.audits[0].exclusions.length, 4)
})

test('a synchronous transport cannot outlive its request deadline while timer callbacks are delayed', async t => {
  let changed = false
  const r = replay((_url, entity) => {
    if (!changed) {
      changed = true
      const priorNow = performance.now.bind(performance)
      t.mock.method(performance, 'now', () => priorNow() + 16000)
    }
    return entity
  })
  const error = await caught(() => run(t, r))
  assert.match(error.message, /request.*deadline/i)
  assert.equal(r.calls.length, 1)
})
test('a synchronous observer cannot outlive its own caller-reduced deadline while timers are delayed', async t => {
  const r = replay()
  const error = await caught(() => run(t, r, {callbackTimeoutMs: 10, onAudit: () => {
    const priorNow = performance.now.bind(performance)
    t.mock.method(performance, 'now', () => priorNow() + 11)
  }}))
  assert.match(error.message, /observer.*deadline/i)
  assert.equal(r.calls.length, 48)
})

const streamResponse = (entity, body) => {
  const response = new Response(null, {status: entity.status, headers: entity.headers})
  Object.defineProperties(response, {url: {value: entity.url}, redirected: {value: entity.redirected}, body: {value: body}})
  return response
}
const scriptedBody = (values, stats, hooks = {}) => ({getReader() {
  if (hooks.getReader) return hooks.getReader()
  let index = 0
  return {read() {return hooks.read ? hooks.read(index++) : Promise.resolve(index < values.length
    ? {done: false, value: values[index++]} : {done: true, value: undefined})},
  cancel(reason) {stats.cancelled++; stats.reason = reason}, releaseLock() {stats.released++}}
}, cancel(reason) {stats.cancelled++; stats.reason = reason}})

test('expiry crossing during a bounded observer holds all staged output', async t => {
  const r = replay()
  const error = await caught(() => run(t, r, {now: () => '2027-01-04T09:25:11.246Z', onAudit: () => {
    const before = performance.now.bind(performance)
    t.mock.method(performance, 'now', () => before() + 60000)
  }}))
  assert.match(error.message, /expiry crossed/i)
  assert.equal(r.calls.length, 48)
})

test('whole genuine raw bytes survive misleading own typed-array length/offset/buffer properties', async t => {
  const stats = {cancelled: 0, released: 0}
  const r = replay((url, entity) => {
    if (url !== boardURL || entity.call.occurrence !== 0) return entity
    const backing = Buffer.concat([Buffer.from('padding'), entity.bytes, Buffer.from('trailing')])
    const view = new Uint8Array(backing.buffer, backing.byteOffset + 7, entity.bytes.length)
    Object.defineProperties(view, {byteLength: {value: 0}, byteOffset: {value: 0}, buffer: {value: new ArrayBuffer(0)}})
    return {...entity, response: streamResponse(entity, scriptedBody([view], stats))}
  })
  const jobs = await run(t, r)
  assert.equal(jobs.length, 6)
  assert.equal(stats.cancelled, 0)
  assert.equal(stats.released, 1)
  assert.equal(r.audits[0].rawPages[0].rawEntitySHA256, profile.nativeBoard.rawEntitySHA256)
})

for (const [name, url, size] of [
  ['board', boardURL, 1048577], ['program', profile.wholeCriticalClients[0].requestedURL, 1048577],
  ['JSON', apiURL, 131073], ['public role', roleURL, 262145],
]) test('streaming ' + name + ' kind cap uses intrinsic bytes before buffering', async t => {
  const stats = {cancelled: 0, released: 0}
  await hold(t, (current, entity) => {
    if (current !== url) return entity
    const bytes = new Uint8Array(size)
    Object.defineProperties(bytes, {byteLength: {value: 1}, byteOffset: {value: 0}, buffer: {value: new ArrayBuffer(1)}})
    return {...entity, response: streamResponse(entity, scriptedBody([bytes], stats))}
  }, /Streaming kind\/entity\/aggregate\/closing/)
  assert.equal(stats.cancelled, 1)
  assert.equal(stats.released, 1)
})

test('closing byte reservation is enforced on the first original stream before native parsing', async t => {
  const r = replay(), error = await caught(() => run(t, r, {maxAggregateBytes: 7602177}))
  assert.match(error.message, /closing byte reservation/)
  assert.equal(r.calls.length, 1)
  assert.equal(error.nativeCollectionEvidence.rawPages[0].entityComplete, false)
})
test('a caller can reduce time/entity/aggregate aliases while preserving the complete48 schedule', async t => {
  const r = replay(), jobs = await run(t, r, {collectionTimeoutMs: 60000, timeoutMs: 1000, maxResponseBytes: 900000, maxTotalBytes: 9000000})
  assert.equal(jobs.length, 6)
  assert.equal(r.calls.length, 48)
  assert.equal(r.audits[0].limits.sourceTimeoutMs, 60000)
  assert.equal(r.audits[0].limits.requestTimeoutMs, 1000)
  assert.equal(r.audits[0].limits.maxEntityBytes, 900000)
  assert.equal(r.audits[0].limits.maxAggregateBytes, 9000000)
  assert.equal(r.audits[0].closingReservation.timeMs, 30000)
})
for (const [name, options] of [
  ['entity', {maxEntityBytes: 20000}], ['entity alias', {maxBodyBytes: 20000}],
  ['aggregate alias', {maxSourceBytes: 7602177}],
]) test('downward ' + name + ' bytes are enforced during the original body stream', async t => {
  const r = replay(), error = await caught(() => run(t, r, options))
  assert.match(error.message, /Streaming kind\/entity\/aggregate\/closing/)
  assert.equal(r.calls.length, 1)
})

for (const [name, mutate] of [
  ['raw BOM', e => ({...e, bytes: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), e.bytes])})],
  ['invalid UTF8', e => ({...e, bytes: Buffer.concat([e.bytes, Buffer.from([0xff])])})],
  ['duplicate JSON keys', e => editHTML(e, text => text.replace('{', '{"id":427400,'))],
  ['truncated entity', e => ({...e, bytes: e.bytes.subarray(0, e.bytes.length - 5)})],
]) test('complete native API rejects ' + name, async t => {
  await hold(t, (url, entity) => url === apiURL ? mutate(entity) : entity, /BOM|UTF8|strict complete JSON/)
})

for (const [name, value] of [['non-byte chunk', 'not bytes'], ['nonboolean done', {done: 1}], ['nonempty completion', {done: true, value: new Uint8Array([1])}]]) test('strict original stream rejects ' + name, async t => {
  const stats = {cancelled: 0, released: 0}
  const r = replay((_url, entity) => ({...entity, response: streamResponse(entity, scriptedBody([], stats,
    {read: () => Promise.resolve(name === 'non-byte chunk' ? {done: false, value} : value)}))}))
  const error = await caught(() => run(t, r))
  assert.match(error.message, /original.*stream|Uint8Array/i)
  assert.equal(r.calls.length, 1)
  assert.equal(stats.cancelled, 1)
  assert.equal(stats.released, 1)
})

for (const name of ['headers', 'HTTP status', 'authority']) test('failed original ' + name + ' cancels the acquired response body once', async t => {
  const stats = {cancelled: 0, released: 0}
  const r = replay((_url, entity) => {
    const response = streamResponse({...entity, ...(name === 'HTTP status' ? {status: 403} : {}),
      ...(name === 'authority' ? {url: 'https://foreign.example/'} : {})}, scriptedBody([], stats))
    if (name === 'headers') Object.defineProperty(response, 'headers', {value: {get() {throw Error('header acquisition failed')}}})
    return {...entity, response}
  })
  await caught(() => run(t, r))
  assert.equal(r.calls.length, 1)
  assert.equal(stats.cancelled, 1)
  assert.equal(stats.released, 0)
})

test('a never-resolving fetch stops at the reduced request deadline and cancels a late response', async t => {
  await clock(t, async () => {
    let release, calls = 0, cancelled = 0
    const pending = script.run({now: () => NOW, requestTimeoutMs: 50, fetchImpl: () => {
      calls++; return new Promise(resolve => {release = resolve})
    }})
    const error = await caught(() => pending)
    assert.match(error.message, /request deadline/)
    const entity = {status: 200, headers: {'content-type': 'text/html'}, url: boardURL, redirected: false}
    release(streamResponse(entity, {cancel() {cancelled++}}))
    await turn()
    assert.equal(calls, 1)
    assert.equal(cancelled, 1)
  })
})
for (const where of ['reader acquisition', 'read']) test('never-resolving body ' + where + ' is bounded, cancelled and released once', async t => {
  const stats = {cancelled: 0, released: 0}
  let release
  const r = replay((_url, entity) => ({...entity, response: streamResponse(entity, scriptedBody([], stats,
    where === 'read' ? {read: () => new Promise(() => {})} : {getReader: () => new Promise(resolve => {release = resolve})}))}))
  await clock(t, async () => {
    const error = await caught(() => script.run({...r.options, requestTimeoutMs: 50}))
    assert.match(error.message, /request|entity/)
    if (release) {
      release({cancel() {stats.cancelled++}, releaseLock() {stats.released++}})
      await turn()
    }
  })
  assert.equal(r.calls.length, 1)
  assert.equal(stats.cancelled, where === 'read' ? 1 : 2, 'Acquired body and separately late reader each have distinct cleanup')
  assert.equal(stats.released, 1)
})

for (const observer of ['onAudit', 'onRecords']) test('never-resolving ' + observer + ' respects its reduced callback deadline', async t => {
  const r = replay(), error = await caught(() => run(t, r, {callbackTimeoutMs: 50, [observer]: () => new Promise(() => {})}))
  assert.match(error.message, /observer deadline/)
  assert.equal(r.calls.length, 48)
})

for (const where of ['before', 'fetch', 'stream', 'pacing', 'onRecords', 'onAudit']) test('opaque caller cancellation remains exact during ' + where, async t => {
  const controller = new AbortController(), reason = Object.freeze({opaque: where}), originalKeys = Reflect.ownKeys(reason)
  const stats = {cancelled: 0, released: 0}
  if (where === 'before') controller.abort(reason)
  const r = replay((_url, entity) => {
    if (where === 'fetch') controller.abort(reason)
    if (where === 'pacing' && entity.call.originalReceiptIndex === 0) setTimeout(() => controller.abort(reason), 100)
    if (where === 'stream') return {...entity, response: streamResponse(entity, scriptedBody([], stats, {read: () => {
      controller.abort(reason); return Promise.resolve({done: false, value: entity.bytes})
    }}))}
    return entity
  })
  const options = {signal: controller.signal}
  if (where.startsWith('on')) options[where] = () => {controller.abort(reason)}
  const actual = await caught(() => run(t, r, options))
  assert.equal(actual, reason)
  assert.deepEqual(Reflect.ownKeys(reason), originalKeys)
  assert.equal(r.calls.length, where === 'before' ? 0 : where.startsWith('on') ? 48 : 1)
  if (where === 'stream') {assert.equal(stats.cancelled, 1); assert.equal(stats.released, 1)}
})

test('source clock callback cannot consume the source/opening reservation before first physical read', async t => {
  const r = replay(), error = await caught(() => run(t, r, {sourceTimeoutMs: 1000, now: () => {
    const before = performance.now.bind(performance)
    t.mock.method(performance, 'now', () => before() + 501)
    return NOW
  }}))
  assert.match(error.message, /Opening deadline/)
  assert.equal(r.calls.length, 0)
})

test('observers receive detached full audit/question data and cannot alter released native records', async t => {
  const r = replay(), jobs = await run(t, r, {onRecords: rows => {
    rows.find(row => row.id === android.id).opening.originalNativeDetail.job_screening_questions[0].choices.push('Invented')
  }, onAudit: value => {value.sourceNativeCompany.name = 'Different'}})
  assert.deepEqual(jobs.find(job => job.jobId === '427353').sourceNativeQuestions[0].choices, [])
  assert.equal(jobs[0].sourceNativeCompany.name, 'Kuku FM')
})

test('same-origin pacing rechecks monotonic time after an actual one-millisecond early wakeup', async t => {
  let early = 0
  const r = replay()
  await clock(t, async () => {
    const timer = globalThis.setTimeout
    t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
      if (delay > 1 && delay <= 500) {early++; return timer(callback, Math.ceil(delay) - 1, ...args)}
      return timer(callback, delay, ...args)
    })
    await script.run(r.options)
  }, 1)
  assert.ok(early > 0)
  const starts = new Map()
  for (const call of r.calls) {
    const origin = new URL(call.url).origin, previous = starts.get(origin)
    if (previous !== undefined) assert.ok(call.startedAt - previous >= 500)
    starts.set(origin, call.startedAt)
    assert.equal(call.init.redirect, 'manual')
    assert.equal(call.init.credentials, 'omit')
    assert.equal(call.init.headers['User-Agent'], 'Mozilla/5.0 (compatible; Jobverify careers inventory check)')
    const kind = fixture.entities[call.originalReceiptIndex].originalReceipt.kind
    assert.equal(call.init.headers.Accept, kind === 'program' ? 'application/javascript' : kind === 'json' ? 'application/json' : 'text/html')
  }
})

test('registered route never enters generic corporate/empty recovery after an own native denial', async t => {
  let fallback = 0
  const r = replay((_url, entity) => ({...entity, status: 403}))
  const poison = async () => {fallback++; throw Error('Unapproved fallback must never execute')}
  const source = createCatalogScraper(getScraperCatalog().find(row => row.source === 'kukufm'))
  const error = await caught(() => clock(t, () => source.run({...r.options,
    softFailureRecovery: {fetchImpl: poison}, emptyOnlyRecovery: {fetchImpl: poison}})))
  assert.equal(error.status, 403)
  assert.equal(r.calls.length, 1)
  assert.equal(fallback, 0)
})
test('registered native module blocks explicitly supplied generic recovery on eligible changed-source coverage errors', async t => {
  let fallback = 0
  const r = replay((_url, entity) => ({...entity, bytes: Buffer.concat([entity.bytes, Buffer.from(' ')])}))
  const poison = async () => {fallback++; throw Error('Generic recovery transport must never execute')}
  const source = createCatalogScraper(getScraperCatalog().find(row => row.source === 'kukufm'))
  const error = await caught(() => clock(t, () => source.run({...r.options,
    softFailureRecovery: {fetchImpl: poison}, emptyOnlyRecovery: {fetchImpl: poison}})))
  assert.match(error.message, /Whole original board\/program/)
  assert.equal(r.calls.length, 1)
  assert.equal(fallback, 0)
})
