import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {setImmediate as turn} from 'node:timers/promises'
import {run} from './currentNative.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const prior = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261121.json.gz', import.meta.url))))
const compressed = readFileSync(new URL('./test-data/current-native-additional-20261121.json.gz', import.meta.url))
assert.equal(sha(compressed), '545efe1f7970f8ae282e15b8a7637ecd9f2083c6f78087dceaec233d914af8ea')
const fixture = JSON.parse(gunzipSync(compressed)), packets = [...prior.packets, ...fixture.packets]
const now = fixture.assessedAt, founderID = 429015, productID = 60181
const detailURL = id => 'https://api.pyjamahr.com/api/career/jobs/' + id + '/?company_uuid=FC3BF22FD8&is_careers_page=false'
const envelope = id => fixture.knownCompletePublicRoleEnvelopes.find(row => row.id === id)
const firstURL = 'https://api.pyjamahr.com/api/career/jobs/?company_uuid=FC3BF22FD8&page=1&is_careers_page=true'
const secondURL = 'https://api.pyjamahr.com/api/career/jobs/?company_uuid=FC3BF22FD8&is_careers_page=true&page=2'
const originalJSON = url => JSON.parse(Buffer.from(packets.find(row => row.requestedURL === url).bodyBase64, 'base64'))
const originalRows = [...originalJSON(firstURL).results, ...originalJSON(secondURL).results]
globalThis.fetch = async () => {throw Error('No physical HTTP in additional current native original regression')}
const clock = async (t, operation) => {
  t.mock.timers.enable({apis: ['Date', 'setTimeout'], now: Date.parse(now)})
  const perf = t.mock.method(performance, 'now', () => Date.now())
  let done = false, value, failure
  Promise.resolve().then(operation).then(result => {done = true; value = result}, error => {done = true; failure = error})
  try {
    for (let i = 0; !done && i < 5000; i++) {await turn(); t.mock.timers.tick(25)}
    assert.ok(done, 'Additional current native protocol replay must settle')
    if (failure) throw failure
    return value
  } finally {perf.mock.restore(); t.mock.timers.reset()}
}
const replay = (mutate = (_url, entity) => entity) => {
  const calls = [], uses = new Map()
  return {calls, options: {now: () => now, maxDetails: 3, fetchImpl: async (value, init) => {
    const url = String(value), row = packets.find(row => row.requestedURL === url), occurrence = uses.get(url) ?? 0
    assert.ok(row, 'No undeclared current original may be invented: ' + url)
    assert.equal(init.method, 'GET'); assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'manual')
    assert.ok(occurrence < 2); uses.set(url, occurrence + 1)
    const bytes = Buffer.from(row.bodyBase64, 'base64')
    assert.equal(sha(bytes), row.sha256)
    const call = {url, occurrence, protocolRepeatedOriginal: occurrence === 1, independentClosingAcquisition: false}
    calls.push(call)
    const entity = await mutate(url, {bytes, call})
    const response = new Response(entity.bytes, {status: row.status, headers: {'content-type': row.contentType}})
    Object.defineProperties(response, {url: {value: row.finalURL}, redirected: {value: row.redirected}})
    return response
  }}}
}
const collect = (t, r, extra = {}) => clock(t, () => run({...r.options, ...extra}))
const caught = async operation => {try {await operation()} catch (error) {return error} assert.fail('Unqualified current data must remain held')}
const editJSON = (entity, mutate) => {const value = JSON.parse(entity.bytes); mutate(value); return {...entity, bytes: Buffer.from(JSON.stringify(value))}}
const editPublic = (entity, mutate) => {
  const html = entity.bytes.toString('utf8'), carrier = readNativeDocument(html).nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__')[0]
  const model = JSON.parse(carrier.raw); mutate(model)
  return {...entity, bytes: Buffer.from(html.replace(carrier.raw, JSON.stringify(model)))}
}
const productFirst = (url, entity) => {
  if (![firstURL, secondURL].includes(url)) return entity
  const ordered = [originalRows.find(row => row.id === productID), ...originalRows.filter(row => row.id !== productID)]
  entity.call.derivedControl = 'All15 actual original rows reordered, with unchanged complete criteria/country/status fields'
  return editJSON(entity, page => {page.results = ordered.slice(url === firstURL ? 0 : 10, url === firstURL ? 10 : 15)})
}

test('three additional originals preserve complete API/public model equality and explicit Product Manager expiry', () => {
  assert.equal(fixture.packets.length, 3)
  assert.equal(fixture.independentClosingAcquired, false)
  for (const packet of fixture.packets) {
    const bytes = Buffer.from(packet.bodyBase64, 'base64')
    assert.equal(bytes.length, packet.bytes); assert.equal(sha(bytes), packet.sha256)
    assert.equal(packet.provenance.originalUnmodified, true); assert.deepEqual(packet.provenance.bodyRedactions, [])
  }
  for (const id of [founderID, productID]) {
    const api = originalJSON(detailURL(id)), html = Buffer.from(packets.find(row => row.requestedURL === envelope(id).currentRoleURL).bodyBase64, 'base64').toString('utf8')
    const carrier = readNativeDocument(html).nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__')[0]
    assert.equal(Object.keys(api).length, 35)
    assert.deepEqual(JSON.parse(carrier.raw).props.pageProps.job, api)
    assert.equal(api.country, 'India'); assert.equal(api.location, 'Mumbai, Maharashtra, India')
  }
  assert.equal(originalJSON(detailURL(productID)).valid_through, '2023-12-11T23:22:34.378878+05:30')
})

test('actual newly advertised Founder role is paired with whole current criteria rather than an old-ID hold', async t => {
  const r = replay(), jobs = await collect(t, r), native = originalJSON(detailURL(founderID))
  assert.deepEqual(jobs.map(job => Number(job.jobId)), [founderID, 415100])
  const job = jobs[0]
  assert.deepEqual(job.sourceNativeRecord, native)
  assert.deepEqual(job.sourceNativeSSR.props.pageProps.job, native)
  assert.ok(job.jobDescription.startsWith(native.description), 'Every authored prose criterion remains intact')
  assert.equal(job.experienceRequired, '2 - 5 years', 'Structured native experience remains intact alongside the complete authored prose')
  assert.equal(job.sourceNativeCreatedAt, '2026-11-17T10:55:17.584709+05:30')
  assert.equal(job.sourceNativeValidThrough, '2027-01-16T10:55:17.584709+05:30')
  assert.equal(job.postingDate, null); assert.equal(job.postedAt, null)
  assert.equal(job.sourceEvidenceScope, 'native-role-criteria-as-data-only')
  for (const flag of ['sourceFormalLegalEntityQualified', 'sourceActivationComplete', 'sourceRenderedCriteriaComplete',
    'sourceApplicationQualificationComplete', 'sourceScopeComplete', 'sourceListingComplete', 'lifecycleCleanupAllowed']) assert.equal(job[flag], false)
  assert.equal(jobs.sourceAudit.observedRecordCount, 15)
  assert.equal(jobs.sourceAudit.pairedPublicRoleCount, 2)
  assert.equal(jobs.sourceAudit.observations.find(row => row.id === founderID).opening.nativeReviewedWorksiteQualified, true)
  assert.equal(r.calls.length, 26)
  assert.equal(r.calls.filter(row => row.protocolRepeatedOriginal).length, 13)
})

test('derived ordering control checks original Product Manager complete model then excludes its exact2023 expiry', async t => {
  const r = replay(productFirst), jobs = await collect(t, r)
  assert.deepEqual(jobs.map(job => Number(job.jobId)), [founderID, 415100])
  assert.ok(jobs.sourceAudit.exclusions.some(row => row.id === productID && row.nativeValidThrough === '2023-12-11T23:22:34.378878+05:30'))
  assert.deepEqual(jobs.sourceAudit.observations.find(row => row.id === productID).opening.originalNativeDetail, originalJSON(detailURL(productID)))
  assert.ok(!r.calls.some(row => row.url === envelope(productID).currentRoleURL), 'Saved public success cannot override native expiry')
  assert.equal(r.calls.filter(row => row.derivedControl).length, 4)
})

test('new reviewed worksite remains exact even when listing/detail/public consistently advertise another India city', async t => {
  const r = replay((url, entity) => {
    if ([firstURL, secondURL].includes(url)) return editJSON(entity, page => {const row = page.results.find(row => row.id === founderID); if (row) row.location = 'Pune, Maharashtra, India'})
    if (url === detailURL(founderID)) return editJSON(entity, job => {job.location = 'Pune, Maharashtra, India'})
    if (url === envelope(founderID).currentRoleURL) return editPublic(entity, model => {model.props.pageProps.job.location = 'Pune, Maharashtra, India'})
    return entity
  })
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /Changed reviewed native role-specific worksite\/country tuple/)
  assert.ok(!r.calls.some(row => row.url === envelope(founderID).currentRoleURL))
})

test('new Founder public model cannot substitute or omit an original structured criterion', async t => {
  const r = replay((url, entity) => url === envelope(founderID).currentRoleURL
    ? editPublic(entity, model => {model.props.pageProps.job.skill = []}) : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /Whole native API\/public DTO\/company\/query mismatch/)
  assert.equal(r.calls.length, 10)
})

test('new Founder closing-only full criteria change stops every staged role', async t => {
  const r = replay((url, entity) => url === detailURL(founderID) && entity.call.occurrence === 1
    ? editJSON(entity, job => {job.description += '<p>Canadian residency is required.</p>'}) : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /Closing complete35-field native criterion\/date\/identity changed/)
  assert.equal(r.calls.length, 22)
})

test('existing one-public-detail budget admits only the first paired role and keeps later role held', async t => {
  const r = replay(), jobs = await collect(t, r, {maxPublicDetails: 1})
  assert.deepEqual(jobs.map(job => Number(job.jobId)), [founderID])
  assert.equal(jobs.sourceAudit.pairedPublicRoleCount, 1)
  assert.ok(jobs.sourceAudit.issues.some(row => row.id === 415100 && row.reason === 'Unqualified or budget-held public carrier'))
  assert.ok(!r.calls.some(row => row.url === prior.proposedDeployment.knownCompletePublicRoleEnvelopes[0].currentRoleURL))
  assert.equal(jobs.sourceAudit.sourceScopeComplete, false)
})

test('foreign original Product Manager detail remains a country failure before its expiry exclusion', async t => {
  const r = replay((url, entity) => url === detailURL(productID)
    ? editJSON(entity, job => {job.country = 'Canada'}) : productFirst(url, entity))
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /Own native role\/country\/domain\/status conflict/)
  assert.equal(r.calls.length, 9)
})
