import assert from 'node:assert/strict'
import test from 'node:test'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {createNetomiScraper, run} from './script.js'
import {admitNetomiEntityBytes, NETOMI_NATIVE_LIMITS} from './nativeText20261115.js'
import {getScraperCatalog, createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {plain} from '../../scraper-support/native-sources/declaredJobFeeds/nativeData.js'
import {fixture, replayNative, withReplayClock, ids, boardURL, feedURL, nativeFeed} from './fixtures/replayNative20261115.js'

const reviewed = JSON.parse(readFileSync(new URL('./reviewedNativeText20261115.json', import.meta.url)))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const original = url => Buffer.from(fixture.captures.find(row => row.bodyBase64 && (row.receipt.requestedUrl ?? row.receipt.requestedURL) === url).bodyBase64, 'base64')
const roleURL = boardURL + '/' + ids[0]
const collect = (t, replay, options = {}) => withReplayClock(t, () => run({...replay.options, ...options}))
const caught = async operation => {try {await operation()} catch (error) {return error} assert.fail('A held native observation must reject')}

globalThis.fetch = async () => {throw Error('Network is forbidden; genuine original full Responses only')}
for (const [name, start] of [
  ['factory', options => createNetomiScraper().run(options)],
  ['run', options => run(options)],
  ['registered', options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'netomi')).run(options)],
]) test(name + ' retains nine own-native India text observations in the explicitly labelled complete-pair protocol replay', async t => {
  const replay = replayNative({reuseMissingClosing: true})
  const jobs = await withReplayClock(t, () => start(replay.options))
  assert.equal(jobs.length, 9)
  assert.deepEqual(jobs.map(job => job.jobId), ids)
  assert.ok(jobs.every(job => job.sourceNativeDataIdentityQualified && job.sourceCorporateBindingQualified === false && job.sourceFormalLegalEntityQualified === false))
  assert.ok(jobs.every(job => job.sourceOwnDetailAPIVisited === false && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  assert.ok(replay.calls.every(call => !call.url.startsWith('https://api.lever.co/v0/postings/netomi/')))
  assert.ok(replay.calls.some(call => call.replayReuse), 'Missing historical closing is explicitly labelled replay reuse, never invented evidence')
  assert.equal(fixture.captures.filter(row => row.bodyBase64 === null).length, 2)
})

test('the genuine corpus retains all 98 original bodies and both actual failed attempts', () => {
  assert.equal(fixture.captures.length, 100)
  const entities = fixture.captures.filter(row => row.bodyBase64 !== null)
  assert.equal(entities.length, 98)
  for (const row of entities) assert.equal(sha(Buffer.from(row.bodyBase64, 'base64')), row.originalEntitySHA256, row.evidenceId)
  assert.equal(fixture.captures.filter(row => row.bodyBase64 === null).length, 2)
})

for (const [url, contract] of Object.entries(reviewed.htmlEntities)) test('the complete original segments admit every genuine observation only for ' + url, () => {
  const rows = fixture.captures.filter(row => row.bodyBase64 && (row.receipt.requestedUrl ?? row.receipt.requestedURL) === url)
  assert.ok(rows.length)
  for (const row of rows) assert.equal(admitNetomiEntityBytes(url, Buffer.from(row.bodyBase64, 'base64')), Buffer.from(row.bodyBase64, 'base64').toString('utf8'))
  assert.equal(contract.immutableRawSegments.length, 4)
  assert.equal(contract.slots.length, 3)
})

test('a canonical coupled CF data variation preserves every immutable byte without becoming a role date', async t => {
  const replay = replayNative({reuseMissingClosing: true, mutate: (url, entity) => {
    const contract = reviewed.htmlEntities[url]
    if (!contract) return entity
    const bytes = Buffer.from(entity.bytes), [r, time, mirrored] = contract.slots
    bytes.write('0123456789abcdef', r.byteOffset, 'ascii')
    bytes.write(Buffer.from('9999999999').toString('base64'), time.byteOffset, 'ascii')
    bytes.write('0123456789abcdef', mirrored.byteOffset, 'ascii')
    return {...entity, bytes}
  }})
  const jobs = await collect(t, replay, {maxJobs: 1})
  assert.equal(jobs[0].sourcePostingDate, nativeFeed.find(row => row.id === ids[0]).createdAt)
  assert.equal(jobs[0].closingDate, null)
  assert.equal(replay.calls.length, 6)
})

for (const [name, mutate] of [
  ['mismatched mirrored ray', (raw, slots) => raw.write('0123456789abcdef', slots[0].byteOffset, 'ascii')],
  ['uppercase ray', (raw, slots) => {raw.write('ABCDEF0123456789', slots[0].byteOffset, 'ascii'); raw.write('ABCDEF0123456789', slots[2].byteOffset, 'ascii')}],
  ['executable ray', (raw, slots) => raw.write("'+alert(1);//xxxx", slots[0].byteOffset, 'ascii')],
  ['noncanonical base64', (raw, slots) => raw.write('MTc5NDY3NTgxNx==', slots[1].byteOffset, 'ascii')],
  ['nondigit timing', (raw, slots) => raw.write(Buffer.from('abcdefghij').toString('base64'), slots[1].byteOffset, 'ascii')],
  ['invalid UTF8 timing', (raw, slots) => {raw[slots[1].byteOffset] = 0xff}],
  ['high byte ray', (raw, slots) => {raw[slots[0].byteOffset] |= 0x80; raw[slots[2].byteOffset] |= 0x80}],
  ['valid UTF8 masquerading as ASCII hex', (raw, slots) => {for (const slot of [slots[0], slots[2]]) Buffer.from([0xe1, 0xb1, 0xb2]).copy(raw, slot.byteOffset)}],
]) test('raw slot admission rejects ' + name, () => {
  const raw = original(roleURL)
  mutate(raw, reviewed.htmlEntities[roleURL].slots)
  assert.throws(() => admitNetomiEntityBytes(roleURL, raw), /coverage gap/i)
})

for (const [name, edit] of [
  ['BOM', bytes => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes])],
  ['truncation', bytes => bytes.subarray(0, bytes.length - 1)],
  ['same-size original byte change', bytes => {const raw = Buffer.from(bytes); raw[400] ^= 1; return raw}],
  ['invalid original UTF8', bytes => {const raw = Buffer.from(bytes); raw[400] = 0xff; return raw}],
  ['new external program', bytes => Buffer.from(bytes.toString().replace('</body>', '<script src="https://other.invalid/current.js"></script></body>'))],
  ['changed static analytics program', bytes => Buffer.from(bytes.toString().replace('var gaCode = "";', 'var gaCode = "x";'))],
  ['changed nested CF program', bytes => Buffer.from(bytes.toString().replace('document.createElement(\'iframe\')', 'document.createElement(\'script\')'))],
  ['new inline style', bytes => Buffer.from(bytes.toString().replace('</head>', '<style>.content:after{content:"New mandatory qualification"}</style></head>'))],
  ['hidden criteria ancestor', bytes => Buffer.from(bytes.toString().replace('<body', '<body hidden'))],
  ['changed CSS activation', bytes => Buffer.from(bytes.toString().replace('<body', '<body class="invisible"'))],
  ['unknown template carrier', bytes => Buffer.from(bytes.toString().replace('</body>', '<template><b>Extra qualification</b></template></body>'))],
  ['application form carrier', bytes => Buffer.from(bytes.toString().replace('</body>', '<form><input name="requiredExperience" required></form></body>'))],
  ['closed notice', bytes => Buffer.from(bytes.toString().replace('</body>', '<p>This position is closed. We are no longer accepting applications.</p></body>'))],
  ['new expiry', bytes => Buffer.from(bytes.toString().replace(/"datePosted"\s*:/, '"validThrough":"2099-01-01","datePosted":'))],
  ['employer conflict', bytes => Buffer.from(bytes.toString().replace(/"name"\s*:\s*"Netomi"/, '"name":"Other Employer"'))],
  ['changed full authored AI disclosure', bytes => Buffer.from(bytes.toString().replace('We may use artificial intelligence', 'We always use artificial intelligence'))],
]) test('actual original Response holds ' + name + ' and retains company/cleanup uncertainty', async t => {
  let applied = false
  const replay = replayNative({reuseMissingClosing: true, mutate: (url, entity) => {
    if (url !== roleURL) return entity
    const bytes = edit(entity.bytes)
    assert.notDeepEqual(bytes, entity.bytes, name + ' must mutate an actual original')
    applied = true
    return {...entity, bytes}
  }})
  const error = await caught(() => collect(t, replay, {maxJobs: 1}))
  assert.ok(applied)
  assert.equal(error.sourceScopeComplete, false)
  assert.equal(error.lifecycleCleanupAllowed, false)
  assert.equal(error.nativeCollectionEvidence.nativeInventoryPairComplete, true)
  assert.equal(error.nativeCollectionEvidence.returnedNativeIndiaTextRecords, 0)
  assert.ok(error.nativeCollectionEvidence.issues.length)
})

for (const [name, change] of [
  ['country missing', record => {delete record.country}],
  ['country foreign', record => {record.country = 'US'}],
  ['secondary unknown location', record => {record.categories.allLocations.push('Unspecified')}],
  ['changed own native ID', record => {record.id = '00000000-0000-4000-8000-000000000000'}],
  ['parent employer application route', record => {record.applyUrl = 'https://jobs.lever.co/other/' + record.id + '/apply'}],
  ['new native status', record => {record.status = 'closed'}],
  ['new expiry date', record => {record.validThrough = '2099-01-01'}],
  ['changed native date', record => {record.createdAt++}],
  ['omitted rich criteria carrier', record => {record.descriptionBody = ''}],
  ['alternate criteria carrier', record => {record.descriptionPlain += ' New mandatory licensing requirement.'}],
]) test('full feed original byte contract rejects ' + name + ' before role qualification', async t => {
  const replay = replayNative({mutate: (url, entity) => {
    if (url !== feedURL) return entity
    const model = JSON.parse(entity.bytes)
    change(model.find(row => row.id === ids[0]))
    return {...entity, bytes: Buffer.from(JSON.stringify(model))}
  }})
  const error = await caught(() => collect(t, replay))
  assert.match(error.message, /raw full feed/)
  assert.equal(replay.calls.length, 2)
})

for (const target of [boardURL, feedURL, roleURL]) test('changed closing native record is held for ' + target, async t => {
  const replay = replayNative({reuseMissingClosing: true, mutate: (url, entity) => url === target && entity.call.occurrence === 1
    ? {...entity, bytes: Buffer.concat([entity.bytes, Buffer.from(' ')])} : entity})
  const error = await caught(() => collect(t, replay, {maxJobs: 1}))
  assert.equal(error.sourceScopeComplete, false)
  assert.ok(!error.nativeCollectionEvidence.nativeInventoryPairComplete || error.nativeCollectionEvidence.returnedNativeIndiaTextRecords === 0)
})

test('an actual historical failed closing pair yields eight observations and a held ninth, never a made-up closing', async t => {
  const replay = replayNative()
  const jobs = await collect(t, replay)
  assert.equal(jobs.length, 8)
  assert.ok(!jobs.some(row => row.jobId === fixture.historicalMissingIndiaClosingHTML))
  assert.ok(replay.calls.every(row => !row.replayReuse))
  assert.equal(jobs.sourceAudit.issues.length, 1)
  assert.equal(jobs.sourceAudit.nativeInventoryPairComplete, true)
  assert.equal(jobs.sourceAudit.observations.length, 21)
  assert.equal(jobs.sourceAudit.unhydratedNativeRecordCount, 13)
  assert.equal(jobs.sourceAudit.openingHydratedNativeRecordCount, 9)
  assert.equal(jobs.sourceAudit.qualifiedNativeRecordCount, 8)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('registered source counts a failed opening among unqualified native records instead of planned selection', async t => {
  const replay = replayNative({reuseMissingClosing: true, mutate: (url, entity) =>
    url === roleURL && entity.call.occurrence === 0 ? {...entity, status: 500} : entity})
  const source = createCatalogScraper(getScraperCatalog().find(row => row.source === 'netomi'))
  const jobs = await withReplayClock(t, () => source.run(replay.options))
  assert.equal(jobs.length, 8)
  assert.ok(!jobs.some(job => job.jobId === ids[0]))
  const audit = replay.audits.at(-1)
  assert.equal(audit.selectedNativeIds.length, 9)
  assert.equal(audit.observations.length, 21)
  assert.equal(audit.openingHydratedNativeRecordCount, 8)
  assert.equal(audit.qualifiedNativeRecordCount, 8)
  assert.equal(audit.unhydratedNativeRecordCount, 13)
  assert.equal(audit.unhydratedNativeRecordCount + audit.qualifiedNativeRecordCount, audit.observedRecordCount)
  assert.equal(audit.issues.length, 1)
  assert.ok(!audit.observations.find(row => row.id === ids[0]).sourceNativeDataIdentityQualified)
})

test('full original rich/plain/schema criteria and AI disclosure survive all nine outputs with exact native calendar fields', async t => {
  const replay = replayNative({reuseMissingClosing: true})
  const jobs = await collect(t, replay)
  for (const job of jobs) {
    const record = nativeFeed.find(row => row.id === job.jobId), row = jobs.sourceAudit.observations.find(row => row.id === job.jobId)
    assert.deepEqual(job.sourceNativeRecord, record)
    assert.deepEqual(job.sourceNativeJobPosting, row.opening.schema)
    const values = ['opening', 'descriptionBody', 'description', 'openingPlain', 'descriptionBodyPlain', 'descriptionPlain', 'additional', 'additionalPlain', 'salaryDescription', 'salaryDescriptionPlain'].map(key => record[key])
      .concat(record.lists.flatMap(section => [section.text, section.content])).filter(value => typeof value === 'string' && plain(value))
    assert.ok(values.length >= 11)
    for (const value of values) assert.ok(job.jobDescription.includes(plain(value)), job.jobId + ' original full carrier')
    assert.ok(job.jobDescription.includes(job.sourceAuthoredAIHiringNotice))
    assert.equal(job.sourceNativeJobPosting.jobLocation.address.addressCountry, null)
    assert.equal(job.sourcePostingDate, record.createdAt)
    assert.equal(job.postingDate, new Date(record.createdAt).toISOString())
    assert.equal(job.sourceNativeStructuredDatePosted, job.postingDate.slice(0, 10))
    assert.equal(job.closingDate, null)
    assert.equal(job.countryCode, 'IN')
    assert.equal(job.sourceUrl, record.hostedUrl)
    assert.equal(job.applyUrl, record.applyUrl)
    assert.equal(job.sourceApplicationQualificationComplete, false)
    assert.equal(job.sourceRenderedCriteriaComplete, false)
    assert.equal(job.sourceActivationComplete, false)
    assert.ok(row.opening.originalHTML.includes('ai-disclaimer'))
  }
  assert.equal(jobs.sourceAudit.physicalRequests, 22)
  assert.equal(jobs.sourceAudit.openingHydratedNativeRecordCount, 9)
  assert.equal(jobs.sourceAudit.qualifiedNativeRecordCount, 9)
  assert.equal(jobs.sourceAudit.unhydratedNativeRecordCount, 12)
  assert.equal(jobs.sourceAudit.originalEntityBytes, 14944124)
  assert.equal(readSourceObservationEvidence(jobs, 'netomi').observedVacancyCount, 21)
  assert.equal(readSourceObservationEvidence(jobs, 'netomi').companyIndiaTotal, null)
})

for (const [name, edit, pattern] of [
  ['prefollowed response', entity => ({...entity, redirected: true}), /prefollowed/],
  ['foreign response URL', entity => ({...entity, responseURL: 'https://other.invalid/netomi'}), /Response URL/],
  ['missing response URL', entity => ({...entity, responseURL: ''}), /Response URL/],
  ['HTML wrong MIME', entity => ({...entity, headers: {'content-type': 'application/json'}}), /MIME/],
  ['legacy charset', entity => ({...entity, headers: {'content-type': 'text/html; charset=ISO-8859-1'}}), /charset/],
  ['missing MIME', entity => ({...entity, headers: {}}), /MIME/],
  ['missing original stream', entity => ({...entity, bytes: null}), /stream unavailable/],
  ['ambiguous MIME parameters', entity => ({...entity, headers: {'content-type': 'text/html; charset=utf-8; charset=latin1'}}), /MIME/],
  ['manual redirect', entity => ({...entity, status: 307, headers: {...entity.headers, location: 'https://other.invalid/'}}), /HTTP 307/],
  ['denied public origin', entity => ({...entity, status: 403}), /HTTP 403/],
  ['rate limited public origin', entity => ({...entity, status: 429}), /HTTP 429/],
]) test('real Response transport rejects ' + name + ' after one physical read', async t => {
  const replay = replayNative({mutate: (_url, entity) => edit(entity)})
  const error = await caught(() => collect(t, replay))
  assert.match(error.message, pattern)
  assert.equal(replay.calls.length, 1)
  assert.equal(error.nativeCollectionEvidence.rawPages[0].status, ['manual redirect'].includes(name) ? 307 : name === 'denied public origin' ? 403 : name === 'rate limited public origin' ? 429 : 200)
})

test('original default wire headers, pacing, credentials and no application/extra API reads are retained', async t => {
  const starts = []
  const replay = replayNative({reuseMissingClosing: true, mutate: (url, entity) => {starts.push({origin: new URL(url).origin, at: performance.now()}); return entity}})
  await collect(t, replay)
  for (const {init} of replay.calls) {
    assert.equal(init.credentials, 'omit')
    assert.equal(init.headers['User-Agent'], 'Mozilla/5.0 (compatible; Jobverify scraper)')
    assert.equal(init.headers.Accept, 'text/html,application/json,*/*;q=0.5')
    assert.ok(!Object.keys(init.headers).some(key => /authorization|cookie/i.test(key)))
  }
  for (const [index, start] of starts.entries()) {
    const previous = starts.slice(0, index).findLast(row => row.origin === start.origin)
    if (previous) assert.ok(start.at - previous.at >= 500)
  }
})

for (const [options, expectedJobs, expectedReads] of [
  [{maxJobs: 0}, 0, 4], [{maxJobs: 1}, 1, 6], [{maxRequests: 6}, 1, 6],
  [{maxRequests: 4}, 0, 4], [{maxAggregateBytes: 6 * 1048576}, 1, 6],
  [{maxJobs: Infinity}, 9, 22],
]) test('reduced caller reservation ' + JSON.stringify(options), async t => {
  const replay = replayNative({reuseMissingClosing: true})
  if (expectedJobs === 0 && options.maxJobs !== 0) {
    const error = await caught(() => collect(t, replay, options))
    assert.match(error.message, /zero inventory unverified/)
  } else {
    const jobs = await collect(t, replay, options)
    assert.equal(jobs.length, expectedJobs)
    assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
  }
  assert.equal(replay.calls.length, expectedReads)
  assert.equal(replay.calls.at(-2).url, boardURL)
  assert.equal(replay.calls.at(-1).url, feedURL)
})

for (const [key, hard] of Object.entries(NETOMI_NATIVE_LIMITS).filter(([key]) => key !== 'pacingMs')) {
  for (const value of [0, -1, NaN, hard + 1]) test('caller cannot expand or invalidate ' + key + '=' + value, async t => {
    const replay = replayNative()
    await assert.rejects(() => collect(t, replay, {[key]: value}), /Invalid reduced/)
    assert.equal(replay.calls.length, 0)
  })
}

test('caller aggregate too small for opening/closing reservation fails before network', async t => {
  const replay = replayNative()
  await assert.rejects(() => collect(t, replay, {maxAggregateBytes: 1024}), /reservation/)
  assert.equal(replay.calls.length, 0)
})

test('unreviewed full body only injection fails before any fallback', async t => {
  const replay = replayNative()
  await assert.rejects(() => collect(t, replay, {fetchText: async () => original(boardURL).toString()}), /Full original Response/)
  assert.equal(replay.calls.length, 0)
})

for (const [name, options] of [['entity', {maxEntityBytes: 700000}], ['feed', {maxFeedBytes: 1000}]]) test('streaming reduced ' + name + ' cap stops physical acquisition', async t => {
  const replay = replayNative()
  const error = await caught(() => collect(t, replay, options))
  assert.match(error.message, /streaming byte bound/)
  assert.ok(replay.calls.length <= 2)
})

test('preaborted opaque caller reason wins without reads', async t => {
  const controller = new AbortController(), reason = Object.freeze({opaque: 'caller'})
  controller.abort(reason)
  const replay = replayNative()
  assert.equal(await caught(() => collect(t, replay, {signal: controller.signal})), reason)
  assert.equal(replay.calls.length, 0)
})

test('opaque cancellation while fetch ignores abort settles and cancels a late original body', async t => {
  const controller = new AbortController(), reason = Object.freeze({opaque: 'during-fetch'})
  let resolveFetch, cancelled = 0, reads = 0
  await withReplayClock(t, async () => {
    const pending = run({signal: controller.signal, fetchImpl: () => {reads++; return new Promise(resolve => {resolveFetch = resolve})}})
    await Promise.resolve(); await Promise.resolve()
    controller.abort(reason)
    assert.equal(await caught(() => pending), reason)
    const response = new Response(new ReadableStream({cancel() {cancelled++}}), {headers: {'content-type': 'text/html'}})
    resolveFetch(response)
    for (let turns = 0; turns < 10; turns++) await Promise.resolve()
  })
  assert.equal(reads, 1)
  assert.equal(cancelled, 1)
})

test('caller cancellation in original body read cancels/releases the reader and retains opaque reason', async t => {
  const controller = new AbortController(), reason = Symbol('during-read')
  let cancelled = 0, locked = true
  const response = {status: 200, url: boardURL, redirected: false, headers: new Headers({'content-type': 'text/html'}),
    body: {getReader: () => ({read: () => {controller.abort(reason); return new Promise(() => {})}, cancel: () => {cancelled++}, releaseLock: () => {locked = false}})}}
  const error = await caught(() => withReplayClock(t, () => run({signal: controller.signal, fetchImpl: async () => response})))
  assert.equal(error, reason)
  assert.equal(cancelled, 1)
  assert.equal(locked, false)
})

test('source deadline bounds an abort-ignoring transport without retries', async t => {
  let calls = 0
  const error = await caught(() => withReplayClock(t, () => run({sourceTimeoutMs: 1000, fetchImpl: () => {calls++; return new Promise(() => {})}})))
  assert.match(error.message, /deadline/)
  assert.equal(calls, 1)
})

test('request deadline bounds an abort-ignoring transport without expanding source timeout', async t => {
  let calls = 0
  const error = await caught(() => withReplayClock(t, () => run({requestTimeoutMs: 1000, fetchImpl: () => {calls++; return new Promise(() => {})}})))
  assert.match(error.message, /request deadline/)
  assert.equal(calls, 1)
})

test('observers receive detached complete originals and cannot alter the returned authoritative model', async t => {
  const replay = replayNative({reuseMissingClosing: true})
  const jobs = await collect(t, replay, {maxJobs: 1, onAudit: audit => {audit.observations[0].sourceNativeRecord.country = 'US'; audit.rawPages.length = 0},
    onRecords: rows => {rows[0].sourceNativeRecord.id = 'changed'}})
  assert.equal(jobs[0].sourceNativeRecord.country, 'IN')
  assert.equal(jobs.sourceAudit.rawPages.length, 6)
  assert.equal(jobs.sourceAudit.observations[0].sourceNativeRecord.id, nativeFeed[0].id)
})

test('a fully read unreviewed original remains in raw audit while its qualification fails closed', async t => {
  let altered
  const replay = replayNative({mutate: (url, entity) => {
    if (url !== boardURL) return entity
    altered = Buffer.concat([entity.bytes, Buffer.from('<p>Unreviewed native declaration</p>')])
    return {...entity, bytes: altered}
  }})
  const error = await caught(() => collect(t, replay))
  const receipt = error.nativeCollectionEvidence.rawPages[0]
  assert.equal(receipt.entityComplete, true)
  assert.equal(receipt.originalEntityReviewed, false)
  assert.equal(receipt.rawEntitySHA256, sha(altered))
  assert.deepEqual(Buffer.from(receipt.bodyBase64, 'base64'), altered)
})

test('the complete original feed cannot be substituted by an empty, truncated or error inventory', async t => {
  for (const body of ['[]', '{}', '{"error":"unavailable"}']) {
    const replay = replayNative({mutate: (url, entity) => url === feedURL ? {...entity, bytes: Buffer.from(body)} : entity})
    const error = await caught(() => collect(t, replay))
    assert.match(error.message, /raw full feed/)
    assert.equal(replay.calls.length, 2)
    assert.equal(error.sourceScopeComplete, false)
  }
})

for (const url of [boardURL, feedURL]) test('original response BOM on ' + url + ' is never removed before byte admission', async t => {
  const replay = replayNative({mutate: (candidate, entity) => candidate === url ? {...entity, bytes: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), entity.bytes])} : entity})
  const error = await caught(() => collect(t, replay))
  assert.match(error.message, /BOM/)
  const receipt = error.nativeCollectionEvidence.rawPages.at(-1)
  assert.deepEqual(Buffer.from(receipt.bodyBase64, 'base64').subarray(0, 3), Buffer.from([0xef, 0xbb, 0xbf]))
})

for (const name of ['HTTP denied', 'bad charset', 'header exception']) test('original body is cancelled before content on ' + name, async t => {
  let cancelled = 0, read = 0
  const response = {status: name === 'HTTP denied' ? 403 : 200, url: boardURL, redirected: false,
    headers: {get() {if (name === 'header exception') throw Error('Original headers unavailable'); return 'text/html; charset=latin1'}},
    body: {cancel() {cancelled++}, getReader() {read++; throw Error('Body must not be read')}}}
  await caught(() => withReplayClock(t, () => run({fetchImpl: async () => response})))
  assert.equal(cancelled, 1)
  assert.equal(read, 0)
})

for (const name of ['oversized intrinsic bytes', 'nonbyte chunk']) test('original stream rejects ' + name + ' and disposes the reader', async t => {
  let cancelled = 0, released = 0
  const value = name === 'nonbyte chunk' ? 'text is not original bytes' : new Uint8Array(1048577)
  if (name !== 'nonbyte chunk') {
    Object.defineProperty(value, 'byteLength', {get() {throw Error('Spoofed length getter must never run')}})
    Object.defineProperty(value, 'buffer', {get() {throw Error('Spoofed backing-buffer getter must never run')}})
  }
  const response = {status: 200, url: boardURL, redirected: false, headers: new Headers({'content-type': 'text/html'}),
    body: {getReader: () => ({read: async () => ({done: false, value}), cancel: () => {cancelled++}, releaseLock: () => {released++}})}}
  const error = await caught(() => withReplayClock(t, () => run({fetchImpl: async () => response})))
  assert.match(error.message, name === 'nonbyte chunk' ? /byte chunk/ : /streaming byte bound/)
  assert.equal(cancelled, 1)
  assert.equal(released, 1)
})

test('opaque cancellation also owns a late asynchronous reader acquisition', async t => {
  const controller = new AbortController(), reason = Object.freeze({late: 'reader'})
  let openReader, cancelled = 0, released = 0
  const response = {status: 200, url: boardURL, redirected: false, headers: new Headers({'content-type': 'text/html'}),
    body: {getReader: () => new Promise(resolve => {openReader = resolve}), cancel: () => {cancelled++}}}
  await withReplayClock(t, async () => {
    const pending = run({signal: controller.signal, fetchImpl: async () => response})
    for (let turns = 0; !openReader && turns < 25; turns++) await Promise.resolve()
    assert.equal(typeof openReader, 'function')
    controller.abort(reason)
    assert.equal(await caught(() => pending), reason)
    openReader({cancel: () => {cancelled++}, releaseLock: () => {released++}})
    for (let turns = 0; turns < 12; turns++) await Promise.resolve()
  })
  assert.equal(cancelled, 2, 'Original response body and late reader are both disposed')
  assert.equal(released, 1)
})

test('opaque caller cancellation wins a concurrently rejected detached audit callback', async t => {
  const replay = replayNative(), controller = new AbortController(), reason = Symbol('audit caller')
  const error = await caught(() => collect(t, replay, {maxJobs: 1, signal: controller.signal,
    onAudit: () => {controller.abort(reason); return Promise.reject(Error('Concurrent observer failure'))}}))
  assert.equal(error, reason)
  assert.equal(replay.calls.length, 6)
})

test('caller cancellation while pacing starts no unreserved second read', async t => {
  const controller = new AbortController(), reason = Object.freeze({pacing: true})
  const replay = replayNative({mutate: (url, entity) => {
    if (url === roleURL) setTimeout(() => controller.abort(reason), 100)
    return entity
  }})
  const error = await caught(() => collect(t, replay, {maxJobs: 1, signal: controller.signal}))
  assert.equal(error, reason)
  assert.equal(replay.calls.filter(row => row.url === roleURL).length, 1)
})

test('a closing explicit denial stops the denied origin without additional selection or retry', async t => {
  const replay = replayNative({mutate: (url, entity) => url === roleURL && entity.call.occurrence === 1 ? {...entity, status: 403} : entity})
  const error = await caught(() => collect(t, replay))
  assert.equal(error.status, 403)
  assert.equal(error.originDenied, true)
  assert.equal(replay.calls.length, 4)
  assert.equal(error.nativeCollectionEvidence.rawPages.at(-1).status, 403)
})

test('registered failure performs zero generic recovery reads despite supplied poison fallback transports', async t => {
  let fallbacks = 0
  const replay = replayNative({mutate: (_url, entity) => ({...entity, bytes: Buffer.concat([entity.bytes, Buffer.from('Unreviewed declaration')])})})
  const provider = getScraperCatalog().find(row => row.source === 'netomi')
  const result = await caught(() => withReplayClock(t, () => createCatalogScraper(provider).run({...replay.options,
    softFailureRecovery: {fetchImpl: async () => {fallbacks++; throw Error('No fallback')}},
    emptyOnlyRecovery: {fetchImpl: async () => {fallbacks++; throw Error('No empty fallback')}}})))
  assert.ok(result)
  assert.equal(fallbacks, 0)
  assert.equal(replay.calls.length, 1)
})

test('registered caller suppression performs zero generic empty recovery reads and retains inventory hold', async t => {
  let fallbacks = 0
  const replay = replayNative(), provider = getScraperCatalog().find(row => row.source === 'netomi')
  const jobs = await withReplayClock(t, () => createCatalogScraper(provider).run({...replay.options, maxJobs: 0,
    softFailureRecovery: {fetchImpl: async () => {fallbacks++; throw Error('No fallback')}},
    emptyOnlyRecovery: {fetchImpl: async () => {fallbacks++; throw Error('No empty fallback')}}}))
  assert.equal(jobs.length, 0)
  assert.equal(fallbacks, 0)
  assert.equal(replay.calls.length, 4)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
