import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {setImmediate as turn} from 'node:timers/promises'

export const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const compressed = readFileSync(new URL('./native-data-20261115.json.gz', import.meta.url))
assert.equal(sha(compressed), 'ef0df068378f86da545ce0a4227becaa11f2af56b71fac43919dfe05f2f7f783')
export const fixture = JSON.parse(gunzipSync(compressed))
export const profile = JSON.parse(readFileSync(new URL('../reviewedNativeData20261115.json', import.meta.url)))
export const NOW = '2026-11-15T00:00:00.000Z'
export const selectedIDs = [427400, 427353, 425673, 425392, 425389, 425354]
export const originalBytes = index => Buffer.from(fixture.entities[index].rawBodyBase64, 'base64')

// Test-only virtual time; every response below remains an actual Response built
// from a retained whole original entity. No network or publisher JS is run.
export const clock = async (t, operation, step = 25) => {
  t.mock.timers.enable({apis: ['Date', 'setTimeout'], now: Date.parse(NOW)})
  const perf = t.mock.method(performance, 'now', () => Date.now())
  let done = false, result, error
  Promise.resolve().then(operation).then(value => {done = true; result = value}, failure => {done = true; error = failure})
  try {
    for (let index = 0; !done && index < Math.ceil(300000 / step); index++) {await turn(); t.mock.timers.tick(step)}
    assert.ok(done, 'Finite original-response replay must settle within virtual source bounds')
    if (error) throw error
    return result
  } finally {perf.mock.restore(); t.mock.timers.reset()}
}

export const replay = (mutate = (_url, entity) => entity) => {
  const calls = [], audits = [], records = [], uses = new Map()
  return {calls, audits, records, options: {now: () => NOW,
    onAudit: value => {audits.push(value)}, onRecords: value => {records.push(value)},
    fetchImpl: async (url, init) => {
      url = String(url)
      assert.equal(init.method, 'GET')
      assert.equal(init.body, undefined)
      const occurrence = uses.get(url) ?? 0
      uses.set(url, occurrence + 1)
      const row = fixture.entities.filter(entity => entity.originalReceipt.requestedURL === url)[occurrence]
      const call = {url, occurrence, init, startedAt: performance.now(), originalReceiptIndex: row?.index ?? null}
      calls.push(call)
      assert.ok(row, 'Only a genuine retained response can be replayed: ' + url)
      const bytes = originalBytes(row.index), receipt = row.originalReceipt
      assert.equal(sha(bytes), receipt.sha256)
      assert.equal(bytes.length, receipt.bytes)
      let entity = {bytes, status: receipt.status, url: receipt.finalURL, redirected: receipt.redirected,
        headers: {'content-type': receipt.contentType}, call}
      entity = await mutate(url, entity) ?? entity
      if (entity.response) return entity.response
      const response = new Response(entity.bytes, {status: entity.status, headers: entity.headers})
      Object.defineProperties(response, {url: {value: entity.url}, redirected: {value: entity.redirected}})
      return response
    }}}
}

export const editJSON = (entity, change) => {
  const value = JSON.parse(entity.bytes)
  change(value)
  return {...entity, bytes: Buffer.from(JSON.stringify(value))}
}
export const editHTML = (entity, change) => {
  const text = entity.bytes.toString('utf8'), altered = change(text)
  assert.notEqual(altered, text, 'A negative must change the genuine entity')
  return {...entity, bytes: Buffer.from(altered)}
}
export const editSSR = (entity, change) => editHTML(entity, text => {
  const marker = '<script id="__NEXT_DATA__" type="application/json">'
  const start = text.indexOf(marker) + marker.length, end = text.indexOf('</script>', start)
  assert.ok(start >= marker.length && end > start)
  const value = JSON.parse(text.slice(start, end))
  change(value)
  return text.slice(0, start) + JSON.stringify(value) + text.slice(end)
})
export const caught = async operation => {
  try {await operation()} catch (error) {return error}
  assert.fail('An unqualified carrier must not release staged jobs')
}
