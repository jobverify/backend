import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {setImmediate as nextTurn} from 'node:timers/promises'

const compressed = readFileSync(new URL('./netomi20261115-native.json.gz', import.meta.url))
assert.equal(createHash('sha256').update(compressed).digest('hex'), 'ee54d1e4a6f1a666e85eb2dd01d72d41cff244ee4fd7f17a8bfdbf0978009db4')
export const fixture = JSON.parse(gunzipSync(compressed).toString('utf8'))
export const boardURL = 'https://jobs.lever.co/netomi'
export const feedURL = 'https://api.lever.co/v0/postings/netomi?mode=json&skip=0&limit=100'
export const ids = fixture.IndiaNativeIds
export const nativeFeed = JSON.parse(Buffer.from(fixture.captures.find(row => row.evidenceId === 'current-continuation-2').bodyBase64, 'base64'))
let clockSequence = 0
export const withReplayClock = async (t, operation) => {
  t.mock.timers.enable({apis: ['Date', 'setTimeout'], now: Date.now() + (++clockSequence * 3600000)})
  const clock = t.mock.method(performance, 'now', () => Date.now())
  let finished = false, result, failure
  Promise.resolve().then(operation).then(value => {result = value; finished = true}, error => {failure = error; finished = true})
  try {
    for (let steps = 0; !finished && steps < 3000; steps++) { await nextTurn(); t.mock.timers.tick(100) }
    assert.equal(finished, true, 'Replay must settle without network or an unbounded wait')
    if (failure) throw failure
    return result
  } finally {clock.mock.restore(); t.mock.timers.reset()}
}
export const replayNative = ({reuseMissingClosing = false, mutate, historical = false} = {}) => {
  const calls = [], audits = [], records = [], uses = new Map()
  const fetchImpl = async (url, init = {}) => {
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual')
    assert.ok(!String(url).endsWith('/apply'), 'Applications are not public role reads')
    const rows = fixture.captures.filter(row => row.evidenceId.startsWith('historical-') && (row.receipt.requestedUrl ?? row.receipt.requestedURL) === String(url))
    const occurrence = uses.get(String(url)) || 0
    uses.set(String(url), occurrence + 1)
    let row = rows[occurrence]
    assert.ok(row, 'Only genuine original URLs/phases are available: ' + url)
    let replayReuse = false
    if (row.bodyBase64 === null && reuseMissingClosing && String(url) === boardURL + '/fd6df307-38b8-4f0d-81e9-392216edcaa2') {row = rows[0]; replayReuse = true}
    const call = {url: String(url), occurrence, init, evidenceId: row.evidenceId, replayReuse, notAnObservedClosing: replayReuse}
    calls.push(call)
    if (row.bodyBase64 === null) throw Object.assign(Error(row.receipt.error || 'Genuine historical transport timeout'), {historicalTransportFailure: true})
    const bytes = Buffer.from(row.bodyBase64, 'base64')
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.originalEntitySHA256)
    let entity = {bytes, status: row.receipt.status, responseURL: row.receipt.url ?? row.receipt.responseURL, redirected: false,
      headers: {...(row.receipt.headers ?? row.receipt.responseHeaders)}, call, historicalRedirectedWasNotRecorded: historical}
    if (mutate) entity = await mutate(String(url), entity) ?? entity
    if (entity.response) return entity.response
    const response = new Response(entity.bytes, {status: entity.status, headers: entity.headers})
    Object.defineProperties(response, {url: {value: entity.responseURL}, redirected: {value: entity.redirected}})
    return response
  }
  return {calls, audits, records, options: {fetchImpl, onAudit: async audit => {audits.push(audit)}, onRecords: async value => {records.push(value)}}}
}
