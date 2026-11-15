import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {setImmediate as turn} from 'node:timers/promises'
import * as script from './script.js'
import {KODO_NATIVE_LIMITS, nativeKodoInstant} from './currentNative.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog, createCatalogScraper} from '../../scraper-support/providers/index.js'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const compressed = readFileSync(new URL('./test-data/current-native-20261114.json.gz', import.meta.url))
assert.equal(sha(compressed), '5ec6f50cc22b666b314c75b37b87975cd10a53f267e0ce060efe7ecc5a76a27a')
const fixture = JSON.parse(gunzipSync(compressed))
const profile = JSON.parse(readFileSync(new URL('./reviewedNative20261114.json', import.meta.url)))
const now = '2026-11-14T23:00:00.000Z'
globalThis.fetch = async () => {throw Error('No network during genuine original-response replay')}
const clock = async (t, operation) => {
  t.mock.timers.enable({apis: ['Date', 'setTimeout'], now: Date.parse(now)})
  const perf = t.mock.method(performance, 'now', () => Date.now())
  let done = false, value, failure
  Promise.resolve().then(operation).then(result => {done = true; value = result}, error => {done = true; failure = error})
  try {
    for (let i = 0; !done && i < 4000; i++) {await turn(); t.mock.timers.tick(25)}
    assert.ok(done, 'Bounded genuine replay must settle')
    if (failure) throw failure
    return value
  } finally {perf.mock.restore(); t.mock.timers.reset()}
}
const replay = (mutate = (_url, row) => row, {reuseSixMissingClosures = true} = {}) => {
  const calls = [], audits = [], uses = new Map()
  return {calls, audits, options: {now: () => now, onAudit: audit => {audits.push(audit)}, fetchImpl: async (url, init) => {
    assert.equal(init.method ?? 'GET', 'GET')
    assert.equal(init.body, undefined)
    const rows = fixture.packets.filter(row => row.originalReceipt.requestedURL === String(url))
    const occurrence = uses.get(String(url)) ?? 0
    uses.set(String(url), occurrence + 1)
    let row = rows[occurrence], syntheticClosingReplay = false
    if (!row && occurrence === 1 && rows.length === 1 && reuseSixMissingClosures) {row = rows[0]; syntheticClosingReplay = true}
    const call = {url: String(url), occurrence, init, syntheticClosingReplay, actualOriginal: row?.originalBody ?? null}
    calls.push(call)
    assert.ok(row, 'No unknown/unobserved response may be invented: ' + url)
    const bytes = Buffer.from(row.bodyBase64, 'base64')
    assert.equal(sha(bytes), row.sha256)
    let entity = {bytes, url: row.originalReceipt.finalURL, redirected: row.originalReceipt.redirected,
      status: row.originalReceipt.status, headers: {'content-type': row.originalReceipt.contentType}, call}
    entity = await mutate(String(url), entity) ?? entity
    if (entity.response) return entity.response
    const response = new Response(entity.bytes, {status: entity.status, headers: entity.headers})
    Object.defineProperties(response, {url: {value: entity.url}, redirected: {value: entity.redirected}})
    return response
  }}}
}

for (const [name, start] of [
  ['factory', options => script.createKodoScraper().run(options)],
  ['direct exported run', options => script.run(options)],
  ['registered native route', options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'kodo')).run(options)],
]) test(name + ' returns only the two genuine unexpired own native India roles', async t => {
  const r = replay(), jobs = await clock(t, () => start(r.options))
  assert.deepEqual(jobs.map(job => Number(job.jobId)), [415100, 408391])
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every(job => job.postingDate === null && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  assert.equal(r.calls.filter(row => row.syntheticClosingReplay).length, 6, 'Six original single reads are repeated only as explicitly labelled protocol replay')
})

const boardURL = profile.nativeBoard.requestedURL
const apiURL = 'https://api.pyjamahr.com/api/career/jobs/415100/?company_uuid=FC3BF22FD8&is_careers_page=false'
const roleURL = profile.knownCompletePublicRoleEnvelopes[0].currentRoleURL
const firstListURL = 'https://api.pyjamahr.com/api/career/jobs/?company_uuid=FC3BF22FD8&page=1&is_careers_page=true'
const caught = async operation => {try {await operation()} catch (error) {return error} assert.fail('Unqualified source must remain held')}
const collect = (t, r, options = {}) => clock(t, () => script.run({...r.options, ...options}))
const editJSON = (entity, change) => {const value = JSON.parse(entity.bytes); change(value); return {...entity, bytes: Buffer.from(JSON.stringify(value))}}
const editHTML = (entity, change) => {
  const original = entity.bytes.toString(), altered = change(original)
  assert.notEqual(original, altered, 'Boundary must change genuine original HTML')
  return {...entity, bytes: Buffer.from(altered)}
}
const editSSR = (entity, change) => editHTML(entity, html => {
  const carrier = readNativeDocument(html).nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__')[0]
  assert.ok(carrier)
  const value = JSON.parse(carrier.raw); change(value)
  return html.replace(carrier.raw, JSON.stringify(value))
})

test('registered source rechecks pacing after a timer wakes one millisecond early', async t => {
  t.mock.timers.enable({apis: ['Date', 'setTimeout'], now: Date.parse(now)})
  const perf = t.mock.method(performance, 'now', () => Date.now())
  const originalTimer = globalThis.setTimeout
  let earlyWakeups = 0
  const timers = t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    if (delay > 0 && delay <= 500) {
      earlyWakeups++
      return originalTimer(callback, Math.max(0, Math.ceil(delay) - 1), ...args)
    }
    return originalTimer(callback, delay, ...args)
  })
  const starts = new Map(), r = replay((url, entity) => {
    const origin = new URL(url).origin, previous = starts.get(origin)
    if (previous !== undefined) assert.ok(Date.now() - previous >= 500,
      'A timer notification must not start another same-origin request before500ms')
    starts.set(origin, Date.now())
    return entity
  })
  let settled = false, failure, jobs
  const source = createCatalogScraper(getScraperCatalog().find(row => row.source === 'kodo'))
  source.run({...r.options, maxDetails: 1}).then(value => {settled = true; jobs = value}, error => {settled = true; failure = error})
  try {
    for (let i = 0; !settled && i < 20000; i++) {await turn(); t.mock.timers.tick(1)}
    assert.ok(settled, 'Pacing recheck must finish within the original source budget')
    if (failure) throw failure
    assert.ok(earlyWakeups > 0, 'The actual pacing timer must be perturbed')
    assert.equal(r.calls.length, 20)
    assert.equal(jobs.length, 1)
  } finally {timers.mock.restore(); perf.mock.restore(); t.mock.timers.reset()}
})

for (const id of [415100, 408391]) for (const changedLocation of [
  'New York, New York, United States; Mumbai, Maharashtra, India',
  'London, United Kingdom; Mumbai, Maharashtra, India',
  'Pune, Maharashtra, India',
]) test('registered source holds a changed reviewed worksite for ' + id + ': ' + changedLocation, async t => {
  const detailURL = 'https://api.pyjamahr.com/api/career/jobs/' + id + '/?company_uuid=FC3BF22FD8&is_careers_page=false'
  const publicURL = profile.knownCompletePublicRoleEnvelopes.find(row => row.id === id).currentRoleURL
  let changedListing = false, changedDetail = false
  const r = replay((url, entity) => {
    if (url.startsWith('https://api.pyjamahr.com/api/career/jobs/?')) return editJSON(entity, page => {
      const row = page.results.find(row => row.id === id)
      if (row) {row.location = changedLocation; changedListing = true}
    })
    if (url === detailURL) return editJSON(entity, detail => {detail.location = changedLocation; changedDetail = true})
    if (url === publicURL) return editSSR(entity, model => {model.props.pageProps.job.location = changedLocation})
    return entity
  })
  const source = createCatalogScraper(getScraperCatalog().find(row => row.source === 'kodo'))
  const error = await caught(() => clock(t, () => source.run(r.options)))
  assert.ok(changedListing && changedDetail, 'Consistent original-response listing and full native detail mutations reached the guard')
  assert.match(error.message, /reviewed native role-specific worksite/)
  assert.ok(!r.calls.some(call => call.url === publicURL), 'Changed known worksite cannot reach public-role qualification')
})

test('all54 retained original packets are actual bytes; six missing live closures stay distinctly labelled', () => {
  assert.equal(fixture.packets.length, 54)
  for (const packet of fixture.packets) {
    const raw = Buffer.from(packet.bodyBase64, 'base64')
    assert.equal(raw.length, packet.bytes)
    assert.equal(sha(raw), packet.sha256)
  }
  assert.deepEqual(fixture.missingLiveClosingRoleIDs, [266750, 257809, 150023, 83391, 69042, 64563])
})

test('default native collection closes48physical reads/all14 full DTOs and excludes12 actual expired roles', async t => {
  const r = replay(), jobs = await collect(t, r), audit = r.audits[0]
  assert.equal(r.calls.length, 48)
  assert.equal(audit.pairedNativeDetailCount, 14)
  assert.equal(audit.pairedPublicRoleCount, 2)
  assert.equal(audit.unhydratedNativeRecordCount, 0)
  assert.equal(audit.observations.length, 14)
  assert.equal(audit.exclusions.length, 12)
  assert.equal(audit.closingReservation.kindCeilingBytes, 8912896)
  for (const observation of audit.observations) {
    const original = fixture.packets.find(packet => packet.originalReceipt.requestedURL === 'https://api.pyjamahr.com/api/career/jobs/' + observation.id + '/?company_uuid=FC3BF22FD8&is_careers_page=false')
    assert.deepEqual(observation.opening.originalNativeDetail, JSON.parse(Buffer.from(original.bodyBase64, 'base64')))
    assert.deepEqual(observation.opening.originalNativeDetail, observation.closing.originalNativeDetail)
    assert.equal(Object.keys(observation.opening.originalNativeDetail).length, 35)
  }
  for (const job of jobs) {
    assert.ok(job.jobDescription.startsWith(job.sourceNativeRecord.description))
    for (const criterion of job.sourceNativeRecord.skill) assert.ok(job.jobDescription.includes(criterion))
    assert.deepEqual(job.sourceNativeRecord, job.sourceNativeSSR.props.pageProps.job)
    assert.equal(job.postingDate, null)
    assert.equal(job.postedAt, null)
    assert.equal(job.sourceNativeCreatedAt, job.sourceNativeRecord.created_at)
    assert.equal(job.closingDate, job.sourceNativeRecord.valid_through)
    assert.equal(job.sourceUrl, profile.knownCompletePublicRoleEnvelopes.find(row => row.id === Number(job.jobId)).currentRoleURL)
    assert.equal(job.applyUrl, job.sourceUrl + '&apply_now=true')
    assert.equal(job.city, null)
    assert.equal(job.country, 'India')
    assert.equal(job.sourceFormalLegalEntityQualified, false)
    assert.equal(job.sourceActivationComplete, false)
    assert.equal(job.sourceRenderedCriteriaComplete, false)
    assert.equal(job.sourceApplicationQualificationComplete, false)
  }
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
  assert.ok(audit.observations.find(row => row.id === 331781).opening.originalNativeDetail.description.includes('5+'))
  assert.equal(audit.observations.find(row => row.id === 331781).opening.originalNativeDetail.min_experience, 3)
})

for (const [name, transform] of [
  ['true header', html => html.replaceAll('isHeaderVisible=false', 'isHeaderVisible=true')],
  ['missing header', html => html.replaceAll('isHeaderVisible=false', '')],
  ['duplicate header', html => html.replaceAll('isHeaderVisible=false', 'isHeaderVisible=false&isHeaderVisible=false')],
  ['foreign UUID', html => html.replaceAll('FC3BF22FD8', 'AAAAAAAAAA')],
  ['foreign company', html => html.replace('company=\nKodo', 'company=\nOther')],
  ['hidden iframe owner', html => html.replace(/<iframe(?=[^>]*app\.pyjamahr\.com)/, '<iframe hidden')],
  ['changed kodo.in declaration', html => html.replaceAll('https://app.kodo.in/login', 'https://app.other.in/login')],
]) test('corporate raw authority rejects ' + name + ' before board or API reads', async t => {
  const r = replay((url, entity) => url === profile.currentCorporate[1].requestedURL ? editHTML(entity, transform) : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /whole original/)
  assert.equal(r.calls.length, 2)
})

for (const client of profile.wholeCriticalClients) for (const bom of [false, true]) test('complete original client byte admission rejects ' + (bom ? 'BOM ' : 'same-size mutation ') + client.requestedURL, async t => {
  const r = replay((url, entity) => {
    if (url !== client.requestedURL) return entity
    const bytes = Buffer.from(entity.bytes)
    if (bom) return {...entity, bytes: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes])}
    bytes[bytes.length - 10] ^= 1
    return {...entity, bytes}
  })
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /BOM|whole original/)
  assert.ok(!r.calls.some(row => row.url.startsWith('https://api.pyjamahr.com/')))
})

for (const [name, edit] of [
  ['new style', html => html.replace('</head>', '<style>.criteria:after{content:"New requirement"}</style></head>')],
  ['hidden ancestor', html => html.replace('<body', '<body hidden')],
  ['new activation class', html => html.replace('<body', '<body class="d-none"')],
  ['new public question', html => html.replace('</body>', '<form><label>Mandatory experience<input required></label></form></body>')],
  ['unknown native schema', html => html.replace('</head>', '<script type="application/ld+json">{"@type":"JobPosting"}</script></head>')],
  ['duplicate JSON owner', html => html.replace('</body>', '<script id="__NEXT_DATA__" type="application/json">{}</script></body>')],
]) test('finite original public carrier holds ' + name, async t => {
  const r = replay((url, entity) => url === roleURL ? editHTML(entity, edit) : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /public role envelope|JSON owner/)
  assert.equal(error.sourceScopeComplete, false)
  assert.equal(error.lifecycleCleanupAllowed, false)
})

for (const [name, change] of [
  ['new sibling criterion', model => {model.props.pageProps.requirements = 'New requirement'}],
  ['foreign company website', model => {model.props.pageProps.companyDetails.url = 'https://other.com'}],
  ['wrong account', model => {model.query.company_uuid = 'AAAAAAAAAA'}],
  ['wrong native country', model => {model.props.pageProps.job.country = 'US'}],
  ['new date carrier', model => {model.props.pageProps.job.posted_at = now}],
  ['omitted full criteria', model => {model.props.pageProps.job.description = '<p>Apply now</p>'}],
  ['new screening questions', model => {model.props.pageProps.job.job_screening_questions = [{question: 'New criterion'}]}],
]) test('complete SSR/native DTO equality holds ' + name, async t => {
  const r = replay((url, entity) => url === roleURL ? editSSR(entity, change) : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /DTO\/company\/query mismatch/)
})

test('consistent API/SSR criteria mutation cannot override contradictory complete fixed metadata criteria', async t => {
  const append = job => {job.description += '<p>Additional mandatory professional license required.</p>'}
  const r = replay((url, entity) => url === apiURL ? editJSON(entity, append)
    : url === roleURL ? editSSR(entity, model => append(model.props.pageProps.job)) : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /metadata\/native criteria conflict/)
})

for (const field of profile.nativeFullDetailFields) test('closing full native field remains authoritative: ' + field, async t => {
  const r = replay((url, entity) => url === apiURL && entity.call.occurrence === 1 ? editJSON(entity, job => {
    const value = job[field]
    job[field] = value === null ? 'New native field value' : typeof value === 'boolean' ? !value : typeof value === 'number' ? value + 1
      : Array.isArray(value) ? [...value, 'Changed native criterion'] : value + ' changed'
  }) : entity)
  const error = await caught(() => collect(t, r))
  assert.equal(error.sourceScopeComplete, false)
  assert.equal(error.lifecycleCleanupAllowed, false)
  assert.ok(r.calls.length <= 33)
})

for (const [name, change] of [
  ['empty', payload => {payload.count = 0; payload.results = []}],
  ['different count', payload => {payload.count = 13}],
  ['changed order', payload => {payload.results.reverse()}],
  ['duplicate role', payload => {payload.results[1] = payload.results[0]}],
  ['foreign next', payload => {payload.next = 'https://other.com/page2'}],
  ['missing native country', payload => {delete payload.results[0].country}],
  ['city-only country', payload => {payload.results[0].country = ''; payload.results[0].location = 'Mumbai'}],
  ['mixed secondary worksite', payload => {payload.results[0].other_locations = ['United States']}],
]) test('closing full listing holds ' + name + ' without company zero', async t => {
  const r = replay((url, entity) => url === firstListURL && entity.call.occurrence === 1 ? editJSON(entity, change) : entity)
  const error = await caught(() => collect(t, r))
  assert.equal(error.sourceScopeComplete, false)
  assert.ok(!error.nativeCollectionEvidence.nativeInventoryPairComplete)
})

for (const [name, mutate] of [
  ['denied', entity => ({...entity, status: 403})],
  ['redirect', entity => ({...entity, status: 307, headers: {...entity.headers, location: 'https://other.com'}})],
  ['prefollowed', entity => ({...entity, redirected: true})],
  ['changed responseURL', entity => ({...entity, url: 'https://other.com'})],
  ['legacy charset', entity => ({...entity, headers: {'content-type': 'text/html; charset=latin1'}})],
  ['ambiguous MIME', entity => ({...entity, headers: {'content-type': 'text/html; charset=utf-8; charset=ascii'}})],
  ['missing original body', entity => ({...entity, bytes: null})],
  ['BOM', entity => ({...entity, bytes: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), entity.bytes])})],
  ['invalid UTF8', entity => {const bytes = Buffer.from(entity.bytes); bytes[300] = 0xff; return {...entity, bytes}}],
]) test('actual original Response boundary holds ' + name + ' without retries', async t => {
  const r = replay((_url, entity) => mutate(entity)), error = await caught(() => collect(t, r))
  assert.equal(error.sourceScopeComplete, false)
  assert.equal(r.calls.length, 1)
})

for (const [value, expectedJobs, expectedReads] of [
  [{maxJobs: 1}, 1, 46], [{maxJobs: 0}, 0, 44], [{maxDetails: 1}, 1, 20], [{maxRequests: 20}, 1, 20],
]) test('caller reductions preserve complete selected closure ' + JSON.stringify(value), async t => {
  const r = replay(), jobs = await collect(t, r, value)
  assert.equal(jobs.length, expectedJobs)
  assert.equal(r.calls.length, expectedReads)
  assert.equal(jobs.sourceAudit.nativeInventoryPairComplete, true)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
})

for (const [key, maximum] of Object.entries(KODO_NATIVE_LIMITS)) for (const value of [0, maximum + 1]) test('caller cannot expand/invalidate ' + key + '=' + value, async t => {
  const r = replay()
  await assert.rejects(() => collect(t, r, {[key]: value}), /Invalid reduced/)
  assert.equal(r.calls.length, 0)
})

for (const value of ['2026-02-30T17:16:44.236608+05:30', '2026-11-20T17:16:44.236+05:30', '2026-11-20T17:16:44.236608Z',
  '2026-11-20T17:16:44.236608+14:30', '2026-11-20T25:16:44.236608+05:30']) test('native exact calendar/fraction/offset rejects ' + value, () => {
  assert.throws(() => nativeKodoInstant(value), /date|calendar|offset/)
})
test('native expiry preserves precise microseconds rather than truncating to Date milliseconds', () => {
  assert.equal(nativeKodoInstant('2026-11-20T17:16:44.236608+05:30') - nativeKodoInstant('2026-11-20T17:16:44.236607+05:30'), 1n)
})
for (const [instant, count] of [['2026-11-20T17:16:44.236607+05:30', 2], ['2026-11-20T17:16:44.236608+05:30', 1], ['2026-11-20T17:16:44.236609+05:30', 1]]) test('actual native precise expiry boundary ' + instant, async t => {
  const r = replay(), jobs = await collect(t, r, {now: () => instant})
  assert.equal(jobs.length, count)
  assert.equal(jobs.some(job => job.jobId === '408391'), count === 2)
})
test('all expired native records remain audited and held without a false company empty result', async t => {
  const r = replay(), error = await caught(() => collect(t, r, {now: () => '2026-12-08T00:00:00.000Z'}))
  assert.match(error.message, /zero inventory remains unverified/)
  assert.equal(error.nativeCollectionEvidence.exclusions.length, 14)
  assert.equal(error.nativeCollectionEvidence.observations.length, 14)
  assert.equal(error.nativeCollectionEvidence.pairedNativeDetailCount, 14)
  assert.equal(r.calls.length, 44)
})

test('source wire contracts keep manual/no-credentials/baseline UA/500ms pacing and no application calls', async t => {
  const starts = [], r = replay((url, entity) => {starts.push({origin: new URL(url).origin, time: performance.now()}); return entity})
  await collect(t, r)
  for (const {init, url} of r.calls) {
    assert.equal(init.redirect, 'manual')
    assert.equal(init.credentials, 'omit')
    assert.equal(init.headers['User-Agent'], 'Mozilla/5.0 (compatible; Jobverify careers inventory check)')
    assert.ok(!/apply_now|app\.kodo\.in/.test(url))
    assert.ok(!Object.keys(init.headers).some(key => /auth|cookie/i.test(key)))
  }
  for (const [index, entry] of starts.entries()) {
    const earlier = starts.slice(0, index).findLast(row => row.origin === entry.origin)
    if (earlier) assert.ok(entry.time - earlier.time >= 500)
  }
})

test('consistent API/public UUID cannot be numeric data disguised by regular-expression coercion', async t => {
  const change = job => {job.uuid = 1234567890}
  const r = replay((url, entity) => url === apiURL ? editJSON(entity, change)
    : url === roleURL ? editSSR(entity, model => change(model.props.pageProps.job)) : entity)
  const error = await caught(() => collect(t, r, {maxDetails: 1}))
  assert.equal(error.sourceScopeComplete, false)
})

test('intrinsic original byte offsets ignore spoofed public view properties', async t => {
  const r = replay((url, entity) => {
    if (url !== profile.currentCorporate[0].requestedURL) return entity
    const storage = new Uint8Array(entity.bytes.length + 31)
    storage.set(entity.bytes, 17)
    const view = new Uint8Array(storage.buffer, 17, entity.bytes.length)
    for (const property of ['buffer', 'byteLength', 'byteOffset']) Object.defineProperty(view, property, {get() {throw Error('Spoofed ' + property + ' must not run')}})
    let done = false
    return {...entity, response: {status: 200, url, redirected: false, headers: new Headers(entity.headers), body: {getReader: () => ({
      read: async () => done ? {done: true} : (done = true, {done: false, value: view}), releaseLock() {}, cancel() {},
    })}}}
  })
  const jobs = await collect(t, r, {maxDetails: 1})
  assert.equal(jobs.length, 1)
})

test('intrinsic streaming size enforces kind bounds before copying spoofed byte views', async t => {
  let cancelled = 0, released = 0
  const view = new Uint8Array(1048577)
  Object.defineProperty(view, 'byteLength', {value: 0})
  const response = {status: 200, url: profile.currentCorporate[0].requestedURL, redirected: false, headers: new Headers({'content-type': 'text/html'}),
    body: {getReader: () => ({read: async () => ({done: false, value: view}), cancel() {cancelled++}, releaseLock() {released++}})}}
  const error = await caught(() => clock(t, () => script.run({fetchImpl: async () => response})))
  assert.match(error.message, /Streaming kind/)
  assert.equal(cancelled, 1)
  assert.equal(released, 1)
})

for (const variant of ['denied', 'bad MIME', 'header error']) test('unqualified original ' + variant + ' cancels body before reading', async t => {
  let cancelled = 0, readers = 0
  const response = {status: variant === 'denied' ? 403 : 200, url: profile.currentCorporate[0].requestedURL, redirected: false,
    headers: {get() {if (variant === 'header error') throw Error('Original header failure'); return 'text/html; charset=latin1'}},
    body: {cancel() {cancelled++}, getReader() {readers++; throw Error('No body read allowed')}}}
  await caught(() => clock(t, () => script.run({fetchImpl: async () => response})))
  assert.equal(cancelled, 1)
  assert.equal(readers, 0)
})

test('reduced original entity bound aborts after first physical body', async t => {
  const r = replay(), error = await caught(() => collect(t, r, {maxEntityBytes: 700000}))
  assert.match(error.message, /Streaming/)
  assert.equal(r.calls.length, 1)
})
test('caller bytes must reserve complete opening/closing discovery before any HTTP', async t => {
  const r = replay()
  await assert.rejects(() => collect(t, r, {maxAggregateBytes: 1000000}), /reservation/)
  assert.equal(r.calls.length, 0)
})
test('caller listing page reduction cannot hide unenumerated second page or assert zero', async t => {
  const r = replay(), error = await caught(() => collect(t, r, {maxPages: 1}))
  assert.match(error.message, /listing pages/)
  assert.equal(r.calls.length, 7)
})
test('insufficient positive detail reservation closes inventories then reports held unknown zero', async t => {
  const r = replay(), error = await caught(() => collect(t, r, {maxRequests: 16}))
  assert.match(error.message, /zero inventory remains unverified/)
  assert.equal(r.calls.length, 16)
  assert.equal(error.nativeCollectionEvidence.observations.length, 14)
  assert.equal(error.nativeCollectionEvidence.unhydratedNativeRecordCount, 14)
})

test('opaque caller cancellation bounds an abort-ignoring fetch and cancels its late body', async t => {
  const controller = new AbortController(), reason = Object.freeze({opaque: 'late original fetch'})
  let resolveFetch, cancelled = 0, calls = 0
  await clock(t, async () => {
    const pending = script.run({signal: controller.signal, fetchImpl: () => {calls++; return new Promise(resolve => {resolveFetch = resolve})}})
    for (let i = 0; !resolveFetch && i < 20; i++) await Promise.resolve()
    controller.abort(reason)
    assert.equal(await caught(() => pending), reason)
    resolveFetch({body: {cancel() {cancelled++}}})
    for (let i = 0; i < 10; i++) await Promise.resolve()
  })
  assert.equal(calls, 1)
  assert.equal(cancelled, 1)
})
test('opaque caller cancellation in original stream cancels and releases the reader', async t => {
  const controller = new AbortController(), reason = Symbol('original read')
  let cancelled = 0, released = 0
  const response = {status: 200, url: profile.currentCorporate[0].requestedURL, redirected: false, headers: new Headers({'content-type': 'text/html'}),
    body: {getReader: () => ({read() {controller.abort(reason); return new Promise(() => {})}, cancel() {cancelled++}, releaseLock() {released++}})}}
  const error = await caught(() => clock(t, () => script.run({signal: controller.signal, fetchImpl: async () => response})))
  assert.equal(error, reason)
  assert.equal(cancelled, 1)
  assert.equal(released, 1)
})
test('opaque caller cancellation while pacing makes no additional origin request', async t => {
  const controller = new AbortController(), reason = Object.freeze({opaque: 'queued pacing'})
  const r = replay((url, entity) => {if (url === profile.currentCorporate[0].requestedURL) setTimeout(() => controller.abort(reason), 100); return entity})
  assert.equal(await caught(() => collect(t, r, {signal: controller.signal})), reason)
  assert.equal(r.calls.length, 1)
})
test('opaque caller cancellation wins a concurrently rejected audit observer', async t => {
  const r = replay(), controller = new AbortController(), reason = Symbol('audit aborted')
  const error = await caught(() => collect(t, r, {maxDetails: 1, signal: controller.signal,
    onAudit() {controller.abort(reason); return Promise.reject(Error('Concurrent detached callback error'))}}))
  assert.equal(error, reason)
  assert.equal(r.calls.length, 20)
})
test('whole source deadline includes awaited observer work', async t => {
  const r = replay(), error = await caught(() => collect(t, r, {maxDetails: 1, onAudit: () => new Promise(() => {})}))
  assert.match(error.message, /Source deadline/)
  assert.equal(r.calls.length, 20)
})
test('opening phase reserves closing45seconds and times out an abort-ignoring original request', async t => {
  let calls = 0
  const error = await caught(() => clock(t, () => script.run({fetchImpl: () => {calls++; return new Promise(() => {})}})))
  assert.match(error.message, /request deadline/)
  assert.equal(calls, 1)
})
test('opening work cannot consume the45second closing time reservation', async t => {
  const r = replay((_url, entity) => new Promise(resolve => setTimeout(() => resolve(entity), 10000)))
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /deadline|reservation/)
  assert.ok(r.calls.length <= 5)
})
test('a closing denial preserves staged originals and emits no jobs or subsequent requests', async t => {
  const r = replay((url, entity) => url === apiURL && entity.call.occurrence === 1 ? {...entity, status: 403} : entity)
  const error = await caught(() => collect(t, r))
  assert.equal(error.status, 403)
  assert.equal(r.calls.length, 33)
  assert.equal(error.nativeCollectionEvidence.observations.length, 14)
  assert.ok(!error.nativeCollectionEvidence.nativeInventoryPairComplete)
  assert.equal(r.audits.length, 0)
})
test('audit callbacks receive detached complete native originals', async t => {
  const r = replay(), jobs = await collect(t, r, {maxDetails: 1,
    onAudit(audit) {audit.observations[0].opening.originalNativeDetail.country = 'US'; audit.rawPages.length = 0},
    onRecords(rows) {rows[0].sourceNativeListingRecord.id = 1}})
  assert.equal(jobs[0].sourceNativeRecord.country, 'India')
  assert.equal(jobs.sourceAudit.rawPages.length, 20)
  assert.equal(jobs.sourceAudit.observations[0].sourceNativeListingRecord.id, 415100)
})

test('without explicit protocol reuse the six unobserved native closures prevent every staged output', async t => {
  const r = replay(undefined, {reuseSixMissingClosures: false}), error = await caught(() => collect(t, r))
  assert.match(error.message, /No unknown\/unobserved response may be invented/)
  assert.equal(r.calls.length, 43)
  assert.equal(error.nativeCollectionEvidence.physicalRequests, 43)
  assert.equal(r.audits.length, 0)
  assert.ok(!error.nativeCollectionEvidence.nativeInventoryPairComplete)
  assert.equal(error.nativeCollectionEvidence.observations.length, 14)
  assert.ok(r.calls.every(row => !row.syntheticClosingReplay))
})
test('actual registered coverage failure adds zero poisoned generic fallback physical reads', async t => {
  let extras = 0
  const r = replay((_url, entity) => ({...entity, bytes: Buffer.concat([entity.bytes, Buffer.from('Unreviewed declaration')])}))
  const p = getScraperCatalog().find(row => row.source === 'kodo')
  const error = await caught(() => clock(t, () => createCatalogScraper(p).run({...r.options,
    softFailureRecovery: {fetchImpl: async () => {extras++; throw Error('No fallback')}},
    emptyOnlyRecovery: {fetchImpl: async () => {extras++; throw Error('No empty fallback')}}})))
  assert.equal(error.sourceScopeComplete, false)
  assert.equal(extras, 0)
  assert.equal(r.calls.length, 1)
})
test('actual registered caller suppression adds zero poisoned empty-recovery reads', async t => {
  let extras = 0
  const r = replay(), p = getScraperCatalog().find(row => row.source === 'kodo')
  const jobs = await clock(t, () => createCatalogScraper(p).run({...r.options, maxJobs: 0, maxDetails: 1,
    softFailureRecovery: {fetchImpl: async () => {extras++; throw Error('No fallback')}},
    emptyOnlyRecovery: {fetchImpl: async () => {extras++; throw Error('No empty fallback')}}}))
  assert.equal(jobs.length, 0)
  assert.equal(extras, 0)
  assert.equal(r.calls.length, 18)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
})
test('complete pinned board rejects a new executable declaration outside its otherwise matching native data', async t => {
  const r = replay((url, entity) => url === boardURL ? editHTML(entity, html => html.replace('</head>', '<script src="https://other.invalid/current.js"></script></head>')) : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /whole original/)
  assert.equal(r.calls.length, 3)
})
for (const markup of ['<p hidden>Unreviewed mandatory criterion</p>', '<p class="modal">Unreviewed activation</p>', '<iframe src="https://other.invalid/requirements"></iframe>']) test('complete original native rich criteria holds unsupported markup ' + markup, async t => {
  const r = replay((url, entity) => url === apiURL ? editJSON(entity, job => {job.description += markup}) : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /criteria markup\/visibility\/activation/)
  assert.equal(r.calls.length, 9)
})
