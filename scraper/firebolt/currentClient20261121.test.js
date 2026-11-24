import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { parse } from 'acorn'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261121/current-http.json.gz', import.meta.url))))
const prior = JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261107/current-http.json.gz', import.meta.url))))
const currentURL = 'https://www.comeet.com/common/careers.js?rc-315-10'
const concurrentBytes = gunzipSync(readFileSync(new URL('./test-data-20261121/current-concurrent-client.js.gz', import.meta.url)))
const concurrentReceipt = JSON.parse(readFileSync(new URL('./test-data-20261121/current-concurrent-client.receipt.json', import.meta.url)))
const account = 'https://www.comeet.com/jobs/firebolt/26.004'
const proof = Symbol.for('jobverify.official-ats-discovery')
const body = row => Buffer.from(row.bodyBase64, 'base64').toString('utf8')
const execute = async (t, change = row => row) => {
  let index = 0
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const original = capture.responses[index++]
    assert.ok(original, 'No uncaptured public request: ' + url)
    const packet = change({ ...original, body: body(original) }, index)
    assert.equal(url, packet.url); assert.equal(init.method, 'GET'); assert.equal(init.body, undefined)
    assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error')
    const response = new Response(packet.body, { status: packet.status, headers: packet.headers })
    Object.defineProperty(response, 'url', { value: packet.finalURL }); return response
  })
  const jobs = await run({ now: () => capture.capturedAt })
  return { jobs, reads: index }
}

test('current Firebolt rc-315-10 reconciles every original public role and holds unresolved country and publication scope', async t => {
  const { jobs, reads } = await execute(t), audit = jobs[proof], inventory = readInventoryEvidence(jobs)
  assert.equal(reads, 12); assert.equal(jobs.length, 0)
  assert.equal(audit.binding.nativeCompanyUid, '26.004')
  assert.equal(audit.nativeInventory.observedNativePostings, 3)
  assert.equal(audit.nativeInventory.locatedRolesWithFullContent, 2)
  assert.deepEqual(audit.nativeInventory.unresolvedCountryPostings, ['63.F1C'])
  assert.deepEqual(audit.nativeInventory.incompleteContentPostings, ['63.F1C'])
  assert.equal(audit.nativeInventory.selectedIndiaPostings, 0)
  assert.equal(inventory.status, 'coverage-gap'); assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null); assert.equal(inventory.indiaFacetCount, null)
})

test('new Comeet client changes only the reviewed referral-form normalization condition and release comment', () => {
  const current = body(capture.responses.find(row => row.url === currentURL))
  const before = Buffer.from(prior.entities['fcea099bc3113e6ea20e9baad0b9b35d70ec7a9c245a7472cb1420f859368d4c'], 'base64').toString('utf8')
  const prefix = '$scope.state.isReferFriendForm||$scope.normalizeDefaultConfig('
  assert.equal(current.split(prefix).length, 2)
  const clean = program => JSON.stringify(program, (key, value) => ['start', 'end', 'raw'].includes(key) ? undefined : value)
  const restored = current.replace(prefix, '$scope.normalizeDefaultConfig(')
  assert.equal(clean(parse(restored, { ecmaVersion: 'latest' })), clean(parse(before, { ecmaVersion: 'latest' })))
  for (const row of capture.responses) assert.equal(createHash('sha256').update(Buffer.from(row.bodyBase64, 'base64')).digest('hex'), row.bodySHA256)
})

test('independently captured concurrent current client differs only in its original release comment', () => {
  const current = body(capture.responses.find(row => row.url === currentURL)), concurrent = concurrentBytes.toString('utf8')
  assert.equal(concurrentReceipt.url, currentURL)
  assert.equal(createHash('sha256').update(concurrentBytes).digest('hex'), concurrentReceipt.bodySHA256)
  assert.equal(concurrentReceipt.bodySHA256, 'd11567c0662fae4372fcea166c0aa5915ba630a6caefb5590a058a80b3945625')
  assert.equal(concurrent.split('2026-11-18 04:14').length, 2)
  assert.equal(concurrent.replace('2026-11-18 04:14', '2026-11-18 04:15'), current)
})

test('a controlled replay with the other retained exact current client reconciles every native role', async t => {
  // Only the two client responses change in this controlled replay. Their bytes
  // come from the independent retained GET; this is not a second live capture.
  const { jobs, reads } = await execute(t, row => row.url === currentURL ? { ...row, body: concurrentBytes.toString('utf8') } : row)
  assert.equal(reads, 12); assert.equal(jobs.length, 0)
  assert.equal(jobs[proof].nativeInventory.observedNativePostings, 3)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('closing cannot switch between reviewed bytes at the same declared client URL', async t => {
  let reads = 0
  await assert.rejects(execute(t, (row, ordinal) => {
    reads = ordinal
    return row.url === currentURL && ordinal > 6 ? { ...row, body: concurrentBytes.toString('utf8') } : row
  }), /closing reconciliation/)
  assert.equal(reads, 12, 'Both exact variants must qualify before closing rejects their mixed snapshot')
})

test('unreviewed executable code cannot use the current native client declaration', async t => {
  await assert.rejects(execute(t, row => row.url === currentURL ? { ...row, body: row.body + ';window.COMPANY_POSITIONS_DATA=[];' } : row), /client.*contract/)
})

test('registered recovery cannot turn a rejected current client and foreign native roles into jobs or empty authority', async t => {
  const retained = JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261121/registered-rejection-http.json.gz', import.meta.url))))
  let reads = 0
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const packet = retained.responses[reads++]
    assert.ok(packet, 'No uncaptured registered recovery request: ' + url)
    assert.equal(url, packet.url); assert.equal(init.method, 'GET'); assert.equal(init.body, undefined)
    const content = body(packet) + (url === currentURL ? ';window.COMPANY_POSITIONS_DATA=[];' : '')
    const response = new Response(content, { status: packet.status, headers: packet.headers })
    Object.defineProperty(response, 'url', { value: packet.finalURL }); return response
  })
  const provider = getScraperCatalog().find(provider => provider.source === 'firebolt')
  await assert.rejects(createCatalogScraper(provider).run({ now: () => retained.capturedAt }), error => {
    assert.match(error.message, /native client contract changed/)
    assert.equal(error.failureKind, 'coverage_gap'); assert.equal(error.softFailure, true)
    return true
  })
  assert.equal(reads, 7, 'The registered adapter must attempt the four retained recovery GETs and preserve rejection')
})

test('the current native client URL cannot carry another reviewed deployment', async t => {
  await assert.rejects(execute(t, row => row.url === currentURL ? { ...row,
    body: Buffer.from(prior.entities['fcea099bc3113e6ea20e9baad0b9b35d70ec7a9c245a7472cb1420f859368d4c'], 'base64').toString('utf8') } : row), /client.*contract/)
})

test('an invented current client declaration cannot inherit reviewed bytes', async t => {
  await assert.rejects(execute(t, row => ({ ...row, url: row.url.replace('rc-315-10', 'rc-315-11'),
    finalURL: row.finalURL.replace('rc-315-10', 'rc-315-11'), body: row.body.replaceAll('rc-315-10', 'rc-315-11') })), /client.*profile/)
})

test('the current full native snapshot still rejects a changed closing role criterion', async t => {
  await assert.rejects(execute(t, (row, ordinal) => {
    if (ordinal !== 11 || !row.url.startsWith(account + '/')) return row
    const script = readNativeDocument(row.body).nodes(node => node.tag === 'script' && /\bCOMPANY_DATA\s*=/.test(node.raw || ''))[0]
    const expression = parse(script.raw, { ecmaVersion: 'latest' }).body.map(statement => statement.expression)
      .find(expression => expression?.type === 'AssignmentExpression' && expression.left?.name === 'POSITION_DATA')
    const value = JSON.parse(script.raw.slice(expression.right.start, expression.right.end))
    value.custom_fields.details.find(field => /^description$/i.test(field.name)).value += '<p>An unreviewed required qualification.</p>'
    const offset = row.body.indexOf(script.raw), start = offset + expression.right.start, end = offset + expression.right.end
    return { ...row, body: row.body.slice(0, start) + JSON.stringify(value) + row.body.slice(end) }
  }), /description|content|changed|identity/)
})
