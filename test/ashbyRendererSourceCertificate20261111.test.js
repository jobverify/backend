import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { verifyRenderer } from '../scraper/datafold/currentProgrammeRenderer.js'
import { certifyAshbyRendererSource, inspectAshbyRendererManifest } from '../scraper-support/utils/ashbyRendererSourceCertificate20261111.js'

const compressed = fs.readFileSync(new URL('./fixtures/ashby-renderer-source-certificate-20261111.json.gz', import.meta.url))
const raw = gunzipSync(compressed), fixture = JSON.parse(raw)
const fixtureManifest = JSON.parse(fs.readFileSync(new URL('./fixtures/ashby-renderer-source-certificate-20261111.manifest.json', import.meta.url)))
const sha = body => createHash('sha256').update(body).digest('hex')
const sri = body => 'sha384-' + createHash('sha384').update(body).digest('base64')
const recorderKey = 'node_modules/@datadog/browser-rum/esm/boot/datadogRecorder.mjs'
const profilerKey = 'node_modules/@datadog/browser-rum/esm/domain/profiling/datadogProfiler.mjs'
const graph = (label = 'current') => {
  const acquired = fixture.graphs.find(row => row.label === label)
  return {
    declaration: structuredClone(acquired.declaration),
    packets: Object.fromEntries(Object.entries(acquired.packets).map(([kind, row]) => [kind, {
      requestedURL: row.requestedURL, finalURL: row.finalURL, status: row.status,
      headers: structuredClone(row.headers), body: Buffer.from(row.bodyBase64, 'base64'),
    }])),
  }
}
const text = (value, kind) => value.packets[kind].body.toString('utf8')
const replaceOnce = (source, from, to) => {
  const start = source.indexOf(from)
  assert.ok(start >= 0 && source.indexOf(from, start + from.length) < 0, 'Mutation must reach one exact acquired value')
  assert.notEqual(from, to)
  return source.slice(0, start) + to + source.slice(start + from.length)
}
const setBody = (value, kind, body, updateSRI = true) => {
  const before = sha(value.packets[kind].body)
  value.packets[kind].body = Buffer.isBuffer(body) ? body : Buffer.from(body)
  assert.notEqual(sha(value.packets[kind].body), before, 'Acquired packet must actually change')
  if (updateSRI && ['entry', 'recorder', 'profiler'].includes(kind)) {
    const model = JSON.parse(text(value, 'manifest'))
    const key = { entry: 'index.html', recorder: recorderKey, profiler: profilerKey }[kind]
    const oldSRI = model[key].integrity, newSRI = sri(value.packets[kind].body)
    value.packets.manifest.body = Buffer.from(replaceOnce(text(value, 'manifest'), oldSRI, newSRI))
    assert.equal(JSON.parse(text(value, 'manifest'))[key].integrity, newSRI)
  }
}
const edit = (value, kind, from, to, updateSRI = true) => setBody(value, kind, replaceOnce(text(value, kind), from, to), updateSRI)
const hold = (value, reason) => assert.throws(() => certifyAshbyRendererSource(value), error => {
  assert.equal(error.code, 'ASHBY_SOURCE_CERTIFICATE_HOLD')
  if (reason) assert.equal(error.reason, reason)
  return true
})

test('fixture retains all ten original raw packets and independent mixed-phase provenance', () => {
  assert.equal(sha(compressed), '3f14a60771dce3aad14c77fc48cd4e08fdaf7a45852cb78f13bfac54ca6796ea')
  assert.equal(sha(compressed), fixtureManifest.gzipSHA256)
  assert.equal(sha(raw), fixtureManifest.decodedSHA256)
  assert.equal(fixture.historicalMixedPhases, true)
  assert.equal(fixture.freshOpeningClosingTransaction, false)
  const phases = new Set()
  for (const acquired of fixture.graphs) for (const [kind, row] of Object.entries(acquired.packets)) {
    const body = Buffer.from(row.bodyBase64, 'base64'), receipt = row.provenance.originalReceipt
    assert.equal(sha(body), receipt.bodySHA256)
    assert.equal(body.length, receipt.bodyBytes)
    assert.deepEqual(row.headers, receipt.headers)
    assert.equal(row.requestedURL, receipt.requestedURL)
    assert.equal(row.finalURL, receipt.finalURL)
    assert.ok(receipt.requestedAt && receipt.completedAt)
    assert.equal(fixtureManifest.graphs.find(value => value.label === acquired.label).packets[kind].SHA256, sha(body))
    phases.add(row.provenance.phaseFile)
  }
  assert.equal(phases.size, 4)
})

test('existing pinned validator still accepts actual07dd and holds actualb542 independently of new helper', () => {
  const legacy = label => Object.fromEntries(Object.entries(graph(label).packets).map(([kind, row]) => [kind, { text: row.body.toString('utf8'), hash: sha(row.body) }]))
  const old = legacy('old'), current = legacy('current')
  assert.doesNotThrow(() => verifyRenderer(old.manifest, old.entry))
  assert.throws(() => verifyRenderer(current.manifest, current.entry), /New or unreviewed manifest\/dependency graph/)
})

for (const [label, expected] of [
  ['old', { entry: '68315c039b15ae6e77fb1a91e06305229c7bd371e649488757a02e43b1050b3f', css: '996f2aac62e9ac0d7a06a186ea289dec566faacf13ecd0f35c7e09f4c564c595' }],
  ['current', { entry: '096f02e38c0c368bec5374f506df4ca729c1a665791adb303d17067c527b7faa', css: 'e703b7d6124a89df1cce3cfea6d9ba8bc7a14574d5a135988ced023d6170d22e' }],
]) test('certifies complete actual ' + label + ' graph while retaining deployed digests and limits', () => {
  const value = graph(label), result = certifyAshbyRendererSource(value)
  assert.equal(result.profileId, 'ashby-non-user-whole-source-20261111')
  assert.equal(result.declaration.version, value.declaration.version)
  assert.equal(result.resources.entry.originalSHA256, expected.entry)
  assert.equal(result.resources.css.originalSHA256, expected.css)
  const canonical = {
    entry: 'f854e1d2aba40bb7373c04d9680d1411cd90fec05f5107be78ba04a1235d82c4',
    recorder: 'd56a297119f530f306495a08a4b18270514db5fc5802e5266c7b9d41971b6de1',
    profiler: '3b7bfee8e18dcdcffa79b944443c025e6fa400201648a191584f454a990f94ed',
    css: '504da8fce5a071e314a4d1d13e6d815ccb220887457487b41d34793bc2ba23d7',
    manifest: '09ace57b3585eaa2e4488a9e8be340db119bc7796757e7f9070c9289f43eaee8',
  }
  for (const [kind, hash] of Object.entries(canonical)) assert.equal(result.resources[kind].canonicalSHA256, hash)
  assert.equal(result.typedSourceSlots.length, 13)
  for (const kind of ['entry', 'recorder', 'profiler']) {
    assert.equal(result.resources[kind].declaredIntegrity, sri(value.packets[kind].body))
    assert.equal(result.resources[kind].computedIntegrity, sri(value.packets[kind].body))
    assert.deepEqual(result.resources[kind].originalHeaders, value.packets[kind].headers)
  }
  assert.equal(result.resources.css.declaredIntegrity, null)
  assert.equal(result.resources.manifest.declaredIntegrity, null)
  assert.equal(result.limits.browserExecution, 'unqualified')
  assert.equal(result.limits.renderedUI, 'unqualified')
  assert.deepEqual(result.limits.unacquiredBytes, ['font stylesheet', 'fonts', 'favicon/media', 'declared SVG', 'source maps'])
  assert.match(result.limits.cors, /Origin.*unknown/)
  for (const key of ['jobs', 'inventory', 'zero', 'cleanupAllowed', 'sourceScopeComplete', 'listingComplete']) assert.ok(!Object.hasOwn(result, key))
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.resources.entry.originalHeaders))
  assert.throws(() => { result.resources.entry.originalHeaders['content-type'] = 'text/html' }, TypeError)
  const oldHeaders = structuredClone(result.resources.entry.originalHeaders)
  value.packets.entry.body.fill(0)
  value.packets.entry.headers['content-type'] = 'text/html'
  assert.equal(result.resources.entry.originalSHA256, expected.entry)
  assert.deepEqual(result.resources.entry.originalHeaders, oldHeaders)
})

test('accepts typed debug UUID variation without changing executable or graph bytes', () => {
  const value = graph()
  for (const kind of ['entry', 'recorder', 'profiler']) edit(value, kind, text(value, kind).slice(284, 320), '01234567-89ab-4cde-8fab-0123456789ab')
  assert.equal(certifyAshbyRendererSource(value).typedSourceSlots.filter(slot => slot.name === 'DD_DEBUG_UUID').length, 3)
})

for (const [label, names] of [
  ['old', ['index-CgFxg5GM.js', 'datadogRecorder-CJge9Hzn.js', 'datadogProfiler-B3qiKPEN.js', 'index-DRAVd863.css']],
  ['current', ['index-Qseyx2NI.js', 'datadogRecorder-e5kROC1R.js', 'datadogProfiler-CXV8l4S1.js', 'index-Dz10Tris.css']],
]) test('manifest-only inspection derives exactly four current declared URLs before body acquisition: ' + label, () => {
  const value = graph(label)
  const result = inspectAshbyRendererManifest({ declaration: value.declaration, manifest: value.packets.manifest })
  assert.equal(result.kind, 'reviewed-manifest-declaration')
  assert.equal(result.sourceBodiesQualified, false)
  assert.deepEqual(Object.keys(result.resources), ['entry', 'recorder', 'profiler', 'css'])
  for (const [index, kind] of ['entry', 'recorder', 'profiler', 'css'].entries()) {
    assert.equal(result.resources[kind].url, 'https://cdn.ashbyprd.com/frontend_non_user/' + value.declaration.version + '/assets/' + names[index])
    assert.equal(result.resources[kind].declaredIntegrity, kind === 'css' ? null : sri(value.packets[kind].body))
  }
  assert.equal(result.manifest.originalSHA256, sha(value.packets.manifest.body))
})

test('manifest-only inspection withholds unknown or duplicate graph before suggesting a URL', () => {
  for (const [from, to, expected] of [
    ['assets/index-Qseyx2NI.js', 'https://foreign.example/index-Qseyx2NI.js', 'manifest-graph'],
    ['"name": "index",', '"name": "other", "name": "index",', 'manifest-json'],
    ['"isEntry": true,', '"isEntry": true, "imports": ["index.html"],', 'manifest-graph'],
  ]) {
    const value = graph(); edit(value, 'manifest', from, to, false)
    assert.throws(() => inspectAshbyRendererManifest({ declaration: value.declaration, manifest: value.packets.manifest }), error => error.code === 'ASHBY_SOURCE_CERTIFICATE_HOLD' && error.reason === expected)
  }
})

for (const kind of ['manifest', 'entry', 'recorder', 'profiler', 'css']) {
  test('holds missing ' + kind + ' instead of accepting a partial graph', () => {
    const value = graph(); delete value.packets[kind]; hold(value, 'input-shape')
  })
  test('holds changed final route for ' + kind + ' despite matching bytes and SRI', () => {
    const value = graph(); value.packets[kind].finalURL += '?delivery=other'; hold(value, 'route')
  })
  test('holds non-UTF8 declaration on actual ' + kind + ' bytes', () => {
    const value = graph(); value.packets[kind].headers['content-type'] += '; charset=utf-16le'; hold(value, 'mime-encoding')
  })
}

for (const [name, mutate, reason] of [
  ['unknown input field', value => { value.fetch = () => assert.fail('No callbacks') }, 'input-shape'],
  ['unknown graph packet', value => { value.packets.svg = value.packets.css }, 'input-shape'],
  ['unknown packet field', value => { value.packets.entry.parsed = {} }, 'input-shape'],
  ['non-byte body', value => { value.packets.entry.body = text(value, 'entry') }, 'body-type'],
  ['uppercase deployment', value => { value.declaration.version = value.declaration.version.toUpperCase() }, 'declaration'],
  ['foreign declared origin', value => { value.declaration.manifestURL = value.declaration.manifestURL.replace('cdn.ashbyprd.com', 'cdn.example.com') }, 'declaration'],
  ['unrequested route', value => { value.packets.recorder.requestedURL = value.packets.recorder.requestedURL.replace('datadogRecorder-', 'datadogRecorder%2d') }, 'route'],
  ['HTTPredirect', value => { value.packets.entry.status = 302 }, 'status'],
  ['HTTPdenial', value => { value.packets.entry.status = 403 }, 'status'],
  ['wrong JS MIME', value => { value.packets.entry.headers['content-type'] = 'text/html' }, 'mime-encoding'],
  ['repeated charset', value => { value.packets.entry.headers['content-type'] += '; charset=utf-8; charset=utf-16' }, 'mime-encoding'],
  ['unknown MIME parameter', value => { value.packets.css.headers['content-type'] += '; execution=allowed' }, 'mime-encoding'],
  ['case header duplicate', value => { value.packets.entry.headers['Content-Type'] = 'text/html' }, 'headers'],
  ['CSP script denial', value => { value.packets.entry.headers['content-security-policy'] = "script-src 'none'" }, 'security-profile'],
  ['new report-only CSP', value => { value.packets.entry.headers['content-security-policy-report-only'] = "script-src 'none'" }, 'security-profile'],
  ['new CORS declaration', value => { value.packets.entry.headers['access-control-allow-origin'] = 'https://foreign.example' }, 'security-profile'],
  ['new CORP denial', value => { value.packets.css.headers['cross-origin-resource-policy'] = 'same-origin' }, 'security-profile'],
  ['new COEP declaration', value => { value.packets.manifest.headers['cross-origin-embedder-policy'] = 'require-corp' }, 'security-profile'],
  ['new download declaration', value => { value.packets.entry.headers['content-disposition'] = 'attachment' }, 'security-profile'],
  ['new response navigation', value => { value.packets.manifest.headers.refresh = '0; url=https://foreign.example' }, 'security-profile'],
  ['new challenge', value => { value.packets.entry.headers['cf-mitigated'] = 'challenge' }, 'security-profile'],
  ['new auth response', value => { value.packets.entry.headers['www-authenticate'] = 'Basic' }, 'security-profile'],
  ['new cookie state', value => { value.packets.entry.headers['set-cookie'] = 'challenge=1' }, 'security-profile'],
  ['missing HSTS', value => { delete value.packets.entry.headers['strict-transport-security'] }, 'security-profile'],
  ['changed HSTS', value => { value.packets.entry.headers['strict-transport-security'] = 'max-age=0' }, 'security-profile'],
  ['changed entity encoding', value => { value.packets.entry.headers['content-encoding'] = 'gzip' }, 'security-profile'],
]) test('holds ' + name, () => { const value = graph(); mutate(value); hold(value, reason) })

test('rejects header accessors without executing their code', () => {
  const value = graph(); let calls = 0
  Object.defineProperty(value.packets.entry.headers, 'x-custom', { enumerable: true, get() { calls++; return '1' } })
  hold(value, 'headers'); assert.equal(calls, 0)
})

test('accepts explicit quoted UTF8 for reviewed decoded entity bytes', () => {
  const value = graph()
  for (const row of Object.values(value.packets)) row.headers['content-type'] += '; charset="UTF-8"'
  assert.equal(certifyAshbyRendererSource(value).resources.entry.originalSHA256, '096f02e38c0c368bec5374f506df4ca729c1a665791adb303d17067c527b7faa')
})

test('rejects invalid UTF8 with recalculated matching SRI', () => {
  const value = graph(), changed = Buffer.from(value.packets.entry.body); changed[1] = 0xff
  setBody(value, 'entry', changed); hold(value, 'utf8')
})

for (const [name, from, to, reason] of [
  ['unknown manifest field', '"isEntry": true,', '"isEntry": true, "unknown": true,', 'manifest-graph'],
  ['new static JS edge', '"isEntry": true,', '"isEntry": true, "imports": ["index.html"],', 'manifest-graph'],
  ['changed dynamic edge', '\n      "node_modules/@datadog/browser-rum/esm/boot/datadogRecorder.mjs",', '\n      "node_modules/@datadog/browser-rum/esm/boot/unknownRecorder.mjs",', 'manifest-graph'],
  ['extra stylesheet', '"assets/index-Dz10Tris.css"', '"assets/index-Dz10Tris.css", "assets/new.css"', 'manifest-graph'],
  ['foreign file URL', 'assets/index-Qseyx2NI.js', 'https://foreign.example/index-Qseyx2NI.js', 'manifest-graph'],
  ['JSON duplicate key', '"name": "index",', '"name": "other", "name": "index",', 'manifest-json'],
  ['escaped JSON duplicate', '"name": "index",', '"na\\u006de": "other", "name": "index",', 'manifest-json'],
  ['unreviewed JSON format', '\n  "index.html"', '\n   "index.html"', 'body-length'],
]) test('holds ' + name, () => { const value = graph(); edit(value, 'manifest', from, to, false); hold(value, reason) })

for (const [name, kind, from, to] of [
  ['native criteria consumer', 'entry', 'compensationPhilosophyHtml', 'compensationPhilosophyHtmL'],
  ['reachable telemetry', 'entry', 'trackLongTasks:!0', 'trackLongTasks:!1'],
  ['executable CDN origin', 'entry', 'https://cdn.ashbyprd.com/frontend_non_user/', 'https://cdn.evilhost.com/frontend_non_user/'],
  ['recorder DOM operation', 'recorder', 'flushMutations', 'flushMutationz'],
  ['profiler export', 'profiler', 'createRumProfiler', 'createRunProfiler'],
  ['stylesheet rule', 'css', 'display:flex', 'display:none'],
]) test('recalculated SRI cannot excuse changed ' + name, () => {
  const value = graph(), source = text(value, kind), start = source.indexOf(from)
  assert.ok(start >= 0, 'Exact acquired source marker missing')
  setBody(value, kind, source.slice(0, start) + to + source.slice(start + from.length))
  hold(value, name === 'executable CDN origin' ? 'slot-context' : 'source-bytes')
})

for (const [kind, start, length, replacement, reason] of [
  ['entry', 284, 36, '"1234567-89ab-4cde-8fab-0123456789ab', 'slot-shape'],
  ['entry', 1389510, 40, '0'.repeat(40), 'slot-binding'],
  ['entry', 1391277, 8, 'xxxxxxxx', 'slot-binding'],
  ['entry', 1393681, 8, 'xxxxxxxx', 'slot-binding'],
  ['entry', 1401770, 40, '0'.repeat(40), 'slot-binding'],
  ['entry', 4274141, 8, 'xxxxxxxx', 'slot-binding'],
  ['recorder', 284, 36, '01234567-89ab-0cde-8fab-0123456789ab', 'slot-shape'],
  ['recorder', 812, 8, 'xxxxxxxx', 'slot-binding'],
  ['recorder', 34157, 8, 'xxxxxxxx', 'slot-binding'],
  ['profiler', 284, 36, '01234567-89ab-4cde-0fab-0123456789ab', 'slot-shape'],
  ['profiler', 622, 8, 'xxxxxxxx', 'slot-binding'],
  ['profiler', 9571, 8, 'xxxxxxxx', 'slot-binding'],
  ['css', 84324, 40, '0'.repeat(40), 'slot-binding'],
]) test('rejects unqualified typed literal at ' + kind + ':' + start, () => {
  const value = graph(), body = value.packets[kind].body
  assert.equal(Buffer.byteLength(replacement), length)
  setBody(value, kind, Buffer.concat([body.subarray(0, start), Buffer.from(replacement), body.subarray(start + length)]))
  hold(value, reason)
})

for (const kind of ['entry', 'recorder', 'profiler', 'css']) test('rejects extra source bytes in ' + kind, () => {
  const value = graph(); setBody(value, kind, Buffer.concat([value.packets[kind].body, Buffer.from('\n')]))
  hold(value, 'body-length')
})

test('holds arbitrary changed source-map tail with matching SRI', () => {
  const value = graph(); edit(value, 'entry', 'sourceMappingURL=index-', 'sourceMappingURL=other-')
  hold(value, 'slot-context')
})

test('publisher SRI disagreement holds when full source otherwise matches', () => {
  const value = graph(), actual = JSON.parse(text(value, 'manifest'))['index.html'].integrity
  edit(value, 'manifest', actual, 'sha384-' + 'A'.repeat(64), false); hold(value, 'integrity')
})

// Body ownership controls change the actual supplied typed-array bytes. No
// conversion callback, shadowed geometry property or species participates in
// defining the source packet that gets certified.
for (const [name, configure, shouldAccept] of [
  ['own valueOf prefix substitution', (original, calls, changed) => {
    Object.defineProperty(changed, 'valueOf', { value() { calls.push('valueOf'); return original } })
    return changed
  }, false],
  ['inherited valueOf prefix substitution', (original, calls, changed) => {
    class Candidate extends Uint8Array { valueOf() { calls.push('inherited valueOf'); return original } }
    return new Candidate(changed)
  }, false],
  ...['valueOf', 'toString', Symbol.toPrimitive, 'length', 'byteLength', 'buffer', 'byteOffset', 'constructor'].map(property => [
    String(property) + ' accessor', (_original, calls, changed) => {
      Object.defineProperty(changed, property, { get() { calls.push(String(property)); throw Error('Caller callback must never execute') } })
      return changed
    }, false,
  ]),
  ['constructor/species accessor on otherwise valid source', (original, calls) => {
    const changed = new Uint8Array(original)
    const constructor = {}
    Object.defineProperty(constructor, Symbol.species, { get() { calls.push('species'); throw Error('Species must never execute') } })
    Object.defineProperty(changed, 'constructor', { get() { calls.push('constructor'); return constructor } })
    return changed
  }, true],
]) test('copies intrinsic bytes without caller ' + name, () => {
  const value = graph(), original = Buffer.from(value.packets.entry.body), calls = []
  const changed = new Uint8Array(Buffer.concat([original, Buffer.from('\n;globalThis.newCriteria=true;')]))
  const body = configure(original, calls, changed), before = sha(body)
  value.packets.entry.body = body
  let result, error
  try { result = certifyAshbyRendererSource(value) } catch (caught) { error = caught }
  assert.deepEqual(calls, [], 'Copying must never execute caller conversion/geometry/species code')
  assert.equal(sha(body), before, 'Original supplied bytes remain unchanged')
  if (shouldAccept) {
    assert.equal(error, undefined)
    assert.equal(result.resources.entry.originalSHA256, '096f02e38c0c368bec5374f506df4ca729c1a665791adb303d17067c527b7faa')
  } else {
    assert.equal(result, undefined, 'A byte tail cannot be replaced by a valid prefix')
    assert.equal(error?.code, 'ASHBY_SOURCE_CERTIFICATE_HOLD')
    assert.equal(error.reason, 'body-length')
  }
})

test('all genuine plain Uint8Array packet bodies retain exact original source bytes', () => {
  const value = graph(), before = {}
  for (const [kind, row] of Object.entries(value.packets)) { row.body = new Uint8Array(row.body); before[kind] = sha(row.body) }
  const result = certifyAshbyRendererSource(value)
  for (const [kind, row] of Object.entries(value.packets)) {
    assert.equal(result.resources[kind].originalSHA256, before[kind])
    assert.equal(sha(row.body), before[kind])
  }
})

test('native cross-realm Uint8Array is supported without source constructor or conversion', () => {
  const value = graph(), before = sha(value.packets.entry.body)
  value.packets.entry.body = runInNewContext('new Uint8Array(original.buffer, original.byteOffset, original.byteLength)', { original: value.packets.entry.body })
  assert.equal(value.packets.entry.body instanceof Uint8Array, false)
  const result = certifyAshbyRendererSource(value)
  assert.equal(result.resources.entry.originalSHA256, before)
  assert.equal(sha(value.packets.entry.body), before)
})
