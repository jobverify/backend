import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { certifyAshbyRendererSource, inspectAshbyRendererManifest } from '../scraper-support/utils/ashbyRendererSourceCertificate20261111.js'

const compressed = fs.readFileSync(new URL('./fixtures/ashby-renderer-source-certificate-90c-20261111.json.gz', import.meta.url))
const raw = gunzipSync(compressed), fixture = JSON.parse(raw)
const manifest = JSON.parse(fs.readFileSync(new URL('./fixtures/ashby-renderer-source-certificate-90c-20261111.manifest.json', import.meta.url)))
const sha = body => createHash('sha256').update(body).digest('hex')
const sri = body => 'sha384-' + createHash('sha384').update(body).digest('base64')
const enumAddition = 'surveySequenceEnrollmentNotADraft=`SURVEY_SEQUENCE_ENROLLMENT_NOT_A_DRAFT`,e.'
const text = (value, kind) => value.packets[kind].body.toString('utf8')
const graph = () => ({ declaration: structuredClone(fixture.declaration), packets: Object.fromEntries(Object.entries(fixture.packets).map(([kind, row]) => [kind, {
  requestedURL: row.requestedURL, finalURL: row.finalURL, status: row.status,
  headers: structuredClone(row.headers), body: Buffer.from(row.bodyBase64, 'base64'),
}])) })

test('actual90c fixture retains all five complete original opening packets without closing claims', () => {
  assert.equal(sha(compressed), '5e165b5f47c8388a70a64ae41d89a53cd0b128c463087a0b4b589e4dffd7206f')
  assert.equal(sha(compressed), manifest.gzipSHA256); assert.equal(sha(raw), manifest.decodedSHA256)
  assert.equal(fixture.openingOnly, true); assert.equal(fixture.closingPacketsAcquired, false)
  assert.equal(fixture.freshOpeningClosingTransaction, false); assert.equal(fixture.sourceTransactionCompleted, false)
  assert.equal(Object.keys(fixture.packets).length, 5)
  for (const [kind, row] of Object.entries(fixture.packets)) {
    const bytes = Buffer.from(row.bodyBase64, 'base64'), receipt = row.provenance.originalReceipt
    assert.equal(sha(bytes), receipt.bodySHA256); assert.equal(bytes.length, receipt.bodyBytes)
    assert.equal(manifest.packets[kind].SHA256, receipt.bodySHA256)
    assert.equal(receipt.phase, 'opening'); assert.ok(receipt.requestedAt && receipt.completedAt)
    assert.deepEqual(row.headers, receipt.headers)
  }
  const value = graph(), inspected = inspectAshbyRendererManifest({ declaration: value.declaration, manifest: value.packets.manifest })
  assert.equal(inspected.kind, 'reviewed-manifest-declaration'); assert.equal(inspected.sourceBodiesQualified, false)
})

test('certifies actual90c complete exact source profile with only the existing13 typed slots', () => {
  const result = certifyAshbyRendererSource(graph())
  assert.equal(result.resources.entry.originalSHA256, 'e17bf53028a396a245fa1675c7875eda340345e8f354f00d91f137af8cf65162')
  assert.equal(result.resources.entry.decodedEntityBytes, 4274233)
  assert.equal(result.resources.entry.canonicalSHA256, 'aace3b1785fc2b71bf5c53354dd52986a5bdc66f428dee58bc00c32f9507b56f')
  assert.equal(result.typedSourceSlots.length, 13)
  assert.deepEqual(result.typedSourceSlots.filter(row => row.resource === 'entry').map(row => [row.name, row.byteStart]), [
    ['DD_DEBUG_UUID', 284], ['ASSET_DEPLOYMENT', 1389587], ['RECORDER_FILENAME', 1391354],
    ['PROFILER_FILENAME', 1393758], ['TELEMETRY_VERSION', 1401847], ['SOURCE_MAP_FILENAME', 4274218],
  ])
  assert.ok(result.typedSourceSlots.every(row => !row.name.toLowerCase().includes('survey')))
  assert.equal(result.resources.recorder.canonicalSHA256, 'd56a297119f530f306495a08a4b18270514db5fc5802e5266c7b9d41971b6de1')
  assert.equal(result.resources.profiler.canonicalSHA256, '3b7bfee8e18dcdcffa79b944443c025e6fa400201648a191584f454a990f94ed')
  assert.equal(result.resources.css.canonicalSHA256, '504da8fce5a071e314a4d1d13e6d815ccb220887457487b41d34793bc2ba23d7')
  for (const kind of ['entry', 'recorder', 'profiler']) {
    assert.equal(result.resources[kind].declaredIntegrity, sri(graph().packets[kind].body))
    assert.equal(result.resources[kind].computedIntegrity, result.resources[kind].declaredIntegrity)
  }
  assert.equal(result.limits.browserExecution, 'unqualified')
  assert.equal(result.limits.renderedUI, 'unqualified')
  assert.equal(result.resources.css.declaredIntegrity, null)
  assert.deepEqual(result.limits.unacquiredBytes, ['font stylesheet', 'fonts', 'favicon/media', 'declared SVG', 'source maps'])
  for (const key of ['jobs', 'inventory', 'zero', 'cleanupAllowed', 'sourceScopeComplete']) assert.equal(Object.hasOwn(result, key), false)
})

const replaceOnce = (source, before, after) => {
  const at = source.indexOf(before)
  assert.ok(at >= 0 && source.indexOf(before, at + before.length) < 0, 'Synthetic mutation must reach one acquired value')
  assert.notEqual(before, after)
  return source.slice(0, at) + after + source.slice(at + before.length)
}
const setEntry = (value, body) => {
  const original = sha(value.packets.entry.body)
  value.packets.entry.body = Buffer.isBuffer(body) ? body : Buffer.from(body)
  assert.notEqual(sha(value.packets.entry.body), original)
  const before = JSON.parse(text(value, 'manifest'))['index.html'].integrity
  const after = sri(value.packets.entry.body)
  value.packets.manifest.body = Buffer.from(replaceOnce(text(value, 'manifest'), before, after))
  assert.equal(JSON.parse(text(value, 'manifest'))['index.html'].integrity, after, 'Control recalculates publisher SRI; it must still fail complete source qualification')
}
const editEntry = (value, before, after) => setEntry(value, replaceOnce(text(value, 'entry'), before, after))
const hold = (value, expected) => assert.throws(() => certifyAshbyRendererSource(value), error => {
  assert.equal(error.code, 'ASHBY_SOURCE_CERTIFICATE_HOLD')
  assert.equal(error.reason, expected)
  return true
})

for (const [name, before, after] of [
  ['enum property', 'surveySequenceEnrollmentNotADraft', 'surveySequenceEnrollmentNotADrift'],
  ['enum value', 'SURVEY_SEQUENCE_ENROLLMENT_NOT_A_DRAFT', 'SURVEY_SEQUENCE_ENROLLMENT_NOT_A_DRIFT'],
  ['removed enum assignment padded at the same exact position', enumAddition, ' '.repeat(77)],
  ['enum assignment with side effect', enumAddition, 'surveySequenceEnrollmentNotADraft=(globalThis.x=1,`X`),e.'.padEnd(77, ' ')],
  ['unrelated error enum property', 'customCSSUploadError=', 'customCSSUploadErrox='],
  ['full criteria consumer', 'e.compensationPhilosophyHtml!=null&&(0,H.jsx)(`div`', 'e.compensationPhilosophyHtmL!=null&&(0,H.jsx)(`div`'],
  ['reachable telemetry setting', 'trackLongTasks:!0', 'trackLongTasks:!1'],
]) test('recalculated SRI cannot normalize new-profile ' + name, () => {
  const value = graph()
  assert.equal(Buffer.byteLength(before), Buffer.byteLength(after))
  editEntry(value, before, after)
  hold(value, 'source-bytes')
})

test('exact removal that reconstructs the entire approved original profile remains a known source profile', () => {
  const value = graph()
  editEntry(value, enumAddition, '')
  const result = certifyAshbyRendererSource(value)
  assert.equal(result.resources.entry.canonicalSHA256, 'f854e1d2aba40bb7373c04d9680d1411cd90fec05f5107be78ba04a1235d82c4')
  assert.equal(result.resources.entry.decodedEntityBytes, 4274156)
  assert.equal(result.typedSourceSlots.length, 13)
  assert.equal(result.limits.browserExecution, 'unqualified')
})

for (const [name, start, length, replacement] of [
  ['deployment from old source profile', 1389587, 40, 'b5428a08d3c1ba1dd3bbcd88b917eaa284bed83a'],
  ['recorder filename from old source profile', 1391354, 8, 'e5kROC1R'],
  ['profiler filename from old source profile', 1393758, 8, 'CXV8l4S1'],
  ['source-map filename from old source profile', 4274218, 8, 'Qseyx2NI'],
]) test('holds mixed profile ' + name, () => {
  const value = graph(), body = value.packets.entry.body
  setEntry(value, Buffer.concat([body.subarray(0, start), Buffer.from(replacement), body.subarray(start + length)]))
  hold(value, 'slot-binding')
})

test('an original old entry paired with current manifest metadata cannot bypass bindings', () => {
  const previous = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/ashby-renderer-source-certificate-20261111.json.gz', import.meta.url))))
  const value = graph()
  setEntry(value, Buffer.from(previous.graphs.find(row => row.label === 'current').packets.entry.bodyBase64, 'base64'))
  hold(value, 'slot-binding')
})

test('new entry does not admit extra executable tail despite matching recalculated SRI', () => {
  const value = graph(); setEntry(value, Buffer.concat([value.packets.entry.body, Buffer.from('\n;globalThis.extraCriterion=true;')]))
  hold(value, 'body-length')
})

test('typed debug UUID is still the same narrow metadata alphabet in the second profile', () => {
  const value = graph()
  editEntry(value, text(value, 'entry').slice(284, 320), '01234567-89ab-4cde-8fab-0123456789ab')
  assert.equal(certifyAshbyRendererSource(value).resources.entry.canonicalSHA256, 'aace3b1785fc2b71bf5c53354dd52986a5bdc66f428dee58bc00c32f9507b56f')
})

for (const [name, change, reason] of [
  ['current CSP denial', value => { value.packets.entry.headers['content-security-policy'] = "script-src 'none'" }, 'security-profile'],
  ['current CORS change', value => { value.packets.entry.headers['access-control-allow-origin'] = '*' }, 'security-profile'],
  ['current UTF16 declaration', value => { value.packets.entry.headers['content-type'] += '; charset=utf-16le' }, 'mime-encoding'],
  ['current ambiguous charset', value => { value.packets.css.headers['content-type'] += '; charset=utf-8; charset=utf-16' }, 'mime-encoding'],
  ['current final route change', value => { value.packets.profiler.finalURL += '?different=1' }, 'route'],
  ['current missing graph body', value => { delete value.packets.recorder }, 'input-shape'],
]) test('second profile still holds ' + name, () => { const value = graph(); change(value); hold(value, reason) })

test('second profile still requires the publisher SRI to match every original JS body', () => {
  const value = graph(), original = JSON.parse(text(value, 'manifest'))['index.html'].integrity
  value.packets.manifest.body = Buffer.from(replaceOnce(text(value, 'manifest'), original, 'sha384-' + 'A'.repeat(64)))
  hold(value, 'integrity')
})

test('second profile copies real appended bytes without valueOf prefix substitution', () => {
  const value = graph(), original = value.packets.entry.body, calls = []
  const body = new Uint8Array(Buffer.concat([original, Buffer.from('\n;globalThis.extraCriterion=true;')]))
  Object.defineProperty(body, 'valueOf', { value() { calls.push('valueOf'); return original } })
  const before = sha(body); value.packets.entry.body = body
  hold(value, 'body-length'); assert.deepEqual(calls, []); assert.equal(sha(body), before)
})

test('second profile never invokes own geometry or constructor/species accessors', () => {
  const value = graph(), calls = [], body = new Uint8Array(value.packets.entry.body), before = sha(body)
  for (const key of ['length', 'byteLength', 'byteOffset', 'buffer', 'constructor']) Object.defineProperty(body, key, { get() { calls.push(key); throw Error('Caller property must not run') } })
  value.packets.entry.body = body
  const result = certifyAshbyRendererSource(value)
  assert.deepEqual(calls, []); assert.equal(sha(body), before)
  assert.equal(result.resources.entry.originalSHA256, 'e17bf53028a396a245fa1675c7875eda340345e8f354f00d91f137af8cf65162')
})
