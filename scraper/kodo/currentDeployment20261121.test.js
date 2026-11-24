import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {setImmediate as turn} from 'node:timers/promises'
import {createKodoScraper, run} from './currentNative.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog, createCatalogScraper} from '../../scraper-support/providers/index.js'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const compressed = readFileSync(new URL('./test-data/current-native-20261121.json.gz', import.meta.url))
assert.equal(sha(compressed), '4f3859736de94470c5c1612663b1b06ec957b412b594c08ba9615ac31872de1d')
const fixture = JSON.parse(gunzipSync(compressed))
const additionalCompressed = readFileSync(new URL('./test-data/current-native-additional-20261121.json.gz', import.meta.url))
assert.equal(sha(additionalCompressed), '545efe1f7970f8ae282e15b8a7637ecd9f2083c6f78087dceaec233d914af8ea')
const additional = JSON.parse(gunzipSync(additionalCompressed))
const profile = fixture.proposedDeployment
const now = fixture.observedAt
const homeURL = profile.currentCorporate[0].requestedURL
const boardURL = profile.nativeBoard.requestedURL
const roleURL = profile.knownCompletePublicRoleEnvelopes[0].currentRoleURL
const detailURL = id => 'https://api.pyjamahr.com/api/career/jobs/' + id + '/?company_uuid=FC3BF22FD8&is_careers_page=false'
const listURL = 'https://api.pyjamahr.com/api/career/jobs/?company_uuid=FC3BF22FD8&page=1&is_careers_page=true'
globalThis.fetch = async () => {throw Error('No HTTP during original-response regression replay')}

const clock = async (t, operation) => {
  t.mock.timers.enable({apis: ['Date', 'setTimeout'], now: Date.parse(now)})
  const perf = t.mock.method(performance, 'now', () => Date.now())
  let done = false, value, failure
  Promise.resolve().then(operation).then(result => {done = true; value = result}, error => {done = true; failure = error})
  try {
    for (let i = 0; !done && i < 5000; i++) {await turn(); t.mock.timers.tick(25)}
    assert.ok(done, 'Reduced original-response protocol replay must settle')
    if (failure) throw failure
    return value
  } finally {perf.mock.restore(); t.mock.timers.reset()}
}
const replay = (mutate = (_url, entity) => entity) => {
  const calls = [], audits = [], uses = new Map()
  return {calls, audits, options: {maxDetails: fixture.regressionMaxDetails, now: () => now,
    onAudit: audit => {audits.push(audit)}, fetchImpl: async (url, init) => {
      const address = String(url), packet = [...fixture.packets, ...additional.packets].find(packet => packet.requestedURL === address)
      const occurrence = uses.get(address) ?? 0
      uses.set(address, occurrence + 1)
      assert.equal(init.method, 'GET')
      assert.equal(init.body, undefined)
      assert.equal(init.credentials, 'omit')
      assert.equal(init.redirect, 'manual')
      assert.ok(packet, 'No unknown response or historical DTO may be substituted: ' + address)
      assert.ok(occurrence < 2, 'Only opening and explicitly repeated original closing protocol reads')
      const bytes = Buffer.from(packet.bodyBase64, 'base64')
      assert.equal(bytes.length, packet.bytes)
      assert.equal(sha(bytes), packet.sha256)
      const call = {url: address, occurrence, protocolRepeatedOriginal: occurrence === 1,
        originalSHA256: packet.sha256, independentClosingAcquisition: false}
      calls.push(call)
      let entity = {bytes, status: packet.status, url: packet.finalURL, redirected: packet.redirected,
        headers: {'content-type': packet.contentType}, call}
      entity = await mutate(address, entity) ?? entity
      const response = new Response(entity.bytes, {status: entity.status, headers: entity.headers})
      Object.defineProperties(response, {url: {value: entity.url}, redirected: {value: entity.redirected}})
      return response
    }}}
}
const collect = (t, r, extra = {}) => clock(t, () => run({...r.options, ...extra}))
const caught = async operation => {try {await operation()} catch (error) {return error} assert.fail('Unqualified model must remain held')}
const editJSON = (entity, mutate) => {
  const model = JSON.parse(entity.bytes); mutate(model)
  return {...entity, bytes: Buffer.from(JSON.stringify(model))}
}
const editHTML = (entity, mutate) => {
  const original = entity.bytes.toString(), altered = mutate(original)
  assert.notEqual(altered, original, 'Control must actually change the full current original')
  return {...entity, bytes: Buffer.from(altered)}
}
const editSSR = (entity, mutate) => editHTML(entity, html => {
  const carriers = readNativeDocument(html).nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__')
  assert.equal(carriers.length, 1)
  const model = JSON.parse(carriers[0].raw); mutate(model)
  return html.replace(carriers[0].raw, JSON.stringify(model))
})

test('all12 current fixture originals retain whole bytes and honest repeated-closing provenance', () => {
  assert.equal(fixture.packets.length, 12)
  assert.equal(fixture.independentClosingAcquired, false)
  assert.equal(fixture.nativeObservedCandidates, 15)
  for (const packet of fixture.packets) {
    const raw = Buffer.from(packet.bodyBase64, 'base64')
    assert.equal(raw.length, packet.bytes)
    assert.equal(sha(raw), packet.sha256)
    assert.equal(packet.provenance.originalUnmodified, true)
    assert.deepEqual(packet.provenance.bodyRedactions, [])
  }
})

for (const [name, start] of [
  ['factory', options => createKodoScraper().run(options)],
  ['registered native route', options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'kodo')).run(options)],
]) test(name + ' recovers current Intern criteria and15 observed native India rows without certifying held scope', async t => {
  const r = replay(), jobs = await clock(t, () => start(r.options)), audit = r.audits[0]
  assert.equal(r.audits.length, 1, 'Use the forwarded observer because the registered wrapper copies the returned array')
  assert.deepEqual(jobs.map(job => Number(job.jobId)), [429015, 415100])
  const job = jobs.find(job => job.jobId === '415100'), native = JSON.parse(Buffer.from(fixture.packets.find(row => row.requestedURL === detailURL(415100)).bodyBase64, 'base64'))
  assert.deepEqual(job.sourceNativeRecord, native)
  assert.deepEqual(job.sourceNativeSSR.props.pageProps.job, native)
  assert.ok(job.jobDescription.startsWith(native.description))
  for (const skill of native.skill) assert.ok(job.jobDescription.includes(skill))
  assert.equal(job.postingDate, null)
  assert.equal(job.postedAt, null)
  assert.equal(job.sourceNativeCreatedAt, native.created_at)
  assert.equal(job.sourceNativeValidThrough, native.valid_through)
  assert.equal(job.country, 'India')
  assert.equal(job.location, native.location)
  assert.equal(job.city, null)
  assert.equal(job.state, null)
  assert.equal(job.sourceEvidenceScope, 'native-role-criteria-as-data-only')
  assert.equal(job.sourceDetailComplete, true)
  for (const flag of ['sourceFormalLegalEntityQualified', 'sourceActivationComplete', 'sourceRenderedCriteriaComplete',
    'sourceApplicationQualificationComplete', 'sourceScopeComplete', 'sourceListingComplete', 'lifecycleCleanupAllowed']) assert.equal(job[flag], false)
  assert.equal(audit.observedRecordCount, 15)
  assert.equal(audit.observedVacancyCount, 15)
  assert.equal(audit.pairedNativeDetailCount, 3)
  assert.equal(audit.pairedPublicRoleCount, 2)
  assert.equal(audit.unhydratedNativeRecordCount, 12)
  assert.ok(audit.exclusions.some(row => row.id === 408391 && row.reason === 'explicit-native-valid-through-expired'))
  assert.equal(audit.observations.find(row => row.id === 429015).opening.nativeReviewedWorksiteQualified, true)
  assert.equal(audit.observations.find(row => row.id === 429015).qualified, true)
  assert.equal(audit.observations.find(row => row.id === 60181).qualified, false)
  assert.equal(r.calls.length, 26)
  assert.equal(r.calls.filter(call => call.protocolRepeatedOriginal).length, 13)
  assert.ok(r.calls.every(call => call.independentClosingAcquisition === false))
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'coverage-gap')
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.lifecycleCleanupAllowed, false)
})

for (const paragraph of [
  'All positions currently advertised by Kodo are based in Canada and require Canadian residency.',
  'Applications for every advertised position are now closed.',
]) test('closing-only authored corporate authority changes reject: ' + paragraph, async t => {
  const r = replay((url, entity) => url === homeURL && entity.call.occurrence === 1
    ? editHTML(entity, html => html.replace('</body>', '<p>' + paragraph + '</p></body>')) : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /Changed whole original corporate\/board\/client bytes/)
  assert.equal(r.calls.length, 14, 'Known current opening must complete before the closing authority mutation')
})

test('current whole native client mutation stops before any listing/detail transport', async t => {
  const clientURL = profile.wholeCriticalClients[0].requestedURL
  const r = replay((url, entity) => url === clientURL ? {...entity, bytes: Buffer.concat([entity.bytes, Buffer.from('\n/* changed authority */')])} : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /Changed whole original corporate\/board\/client bytes/)
  assert.equal(r.calls.length, 4)
})

for (const [label, mutate, pattern] of [
  ['foreign listing country', page => {page.results[0].country = 'Canada'}, /Native listing country\/publication\/identity\/criteria changed/],
  ['changed count', page => {page.count = 16}, /Unknown complete native listing schema\/count/],
  ['empty listing', page => {page.count = 0; page.results = []; page.next = null}, /Unknown complete native listing schema\/count/],
  ['unknown listing criterion', page => {page.results[0].residency_requirement = 'Canadian residency required'}, /Native listing country\/publication\/identity\/criteria changed/],
]) test(label + ' cannot be admitted as current DATA or verified empty', async t => {
  const r = replay((url, entity) => url === listURL ? editJSON(entity, mutate) : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, pattern)
  assert.equal(r.calls.length, 7)
  assert.equal(error.sourceScopeComplete, false)
  assert.equal(error.lifecycleCleanupAllowed, false)
})

for (const [label, mutate, pattern] of [
  ['foreign native country', job => {job.country = 'Canada'}, /Own native role\/country\/domain\/status conflict/],
  ['foreign native employer domain', job => {job.email_domain = 'foreign.example'}, /Own native role\/country\/domain\/status conflict/],
  ['unknown complete criterion', job => {job.residency_requirement = 'Canadian residency required'}, /Unknown complete35-field native DTO/],
  ['hidden native criteria', job => {job.description += '<p hidden>Canadian residency required.</p>'}, /Unknown native criteria markup\/visibility\/activation/],
]) test(label + ' stays held after reaching the current complete detail', async t => {
  const r = replay((url, entity) => url === detailURL(415100) ? editJSON(entity, mutate) : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, pattern)
  assert.equal(r.calls.length, 11)
  assert.ok(!r.calls.some(call => call.url === roleURL))
})

test('closing-only complete structured criterion change rejects before yielding the opening role', async t => {
  const r = replay((url, entity) => url === detailURL(415100) && entity.call.occurrence === 1
    ? editJSON(entity, job => {job.skill.push('mandatory-current-criterion')}) : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /Closing complete35-field native criterion\/date\/identity changed/)
  assert.equal(r.calls.length, 24)
  assert.equal(r.audits.length, 0)
})

test('current public JSON criteria must equal the entire current API model', async t => {
  const r = replay((url, entity) => url === roleURL
    ? editSSR(entity, model => {model.props.pageProps.job.skill.push('extra-public-only-criterion')}) : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /Whole native API\/public DTO\/company\/query mismatch/)
  assert.equal(r.calls.length, 12)
})

test('changed authored expiries exclude both known roles instead of fabricating current openings or empty inventory', async t => {
  const r = replay((url, entity) => [detailURL(415100), detailURL(429015)].includes(url) ? editJSON(entity, job => {job.valid_through = job.created_at}) : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /No paired unexpired native role; zero inventory remains unverified/)
  assert.ok(!r.calls.some(call => call.url === roleURL))
  assert.equal(r.calls.length, 22)
  assert.equal(error.nativeCollectionEvidence.exclusions.filter(row => row.reason === 'explicit-native-valid-through-expired').length, 3)
})

test('current board cannot be substituted into the old corporate release tuple', async t => {
  const old = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261114.json.gz', import.meta.url))))
  const legacy = old.packets.find(packet => packet.originalReceipt.requestedURL === homeURL)
  const r = replay((url, entity) => url === homeURL ? {...entity, bytes: Buffer.from(legacy.bodyBase64, 'base64')} : entity)
  const error = await caught(() => collect(t, r))
  assert.match(error.message, /Unreviewed corporate\/native release tuple/)
  assert.equal(r.calls.length, 3)
})

test('caller cancellation during a current role response preserves its exact reason and starts no closing read', async t => {
  const controller = new AbortController(), reason = Error('current-original-caller-cancel')
  const r = replay((url, entity) => {if (url === detailURL(415100)) controller.abort(reason); return entity})
  const error = await caught(() => collect(t, r, {signal: controller.signal}))
  assert.equal(error, reason)
  assert.equal(r.calls.length, 11)
})

test('reduced physical-read budget cannot certify zero when no complete paired role fits', async t => {
  const r = replay(), error = await caught(() => collect(t, r, {maxRequests: 18}))
  assert.match(error.message, /No paired unexpired native role; zero inventory remains unverified/)
  assert.ok(r.calls.length <= 18)
  assert.ok(!r.calls.some(call => call.url === roleURL))
  assert.equal(error.nativeCollectionEvidence.sourceScopeComplete, false)
  assert.equal(error.nativeCollectionEvidence.lifecycleCleanupAllowed, false)
})

test('pre-aborted current collection has zero physical reads', async () => {
  const controller = new AbortController(), reason = Error('cancel-before-current-native-acquisition')
  controller.abort(reason)
  const r = replay(), error = await caught(() => run({...r.options, signal: controller.signal}))
  assert.equal(error, reason)
  assert.equal(r.calls.length, 0)
})
