import fs from 'node:fs'
import assert from 'node:assert/strict'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import http from 'node:http'
import https from 'node:https'

export const originalPacket = JSON.parse(gunzipSync(fs.readFileSync(new URL('./current-own-originals-20261121.json.gz', import.meta.url))).toString('utf8'))
for (const record of originalPacket.records) {
  const body = Buffer.from(record.bodyBase64, 'base64')
  assert.equal(body.length, record.bytes)
  assert.equal(createHash('sha256').update(body).digest('hex'), record.sha256)
}
export const originalText = record => Buffer.from(record.bodyBase64, 'base64').toString('utf8')
export function networkFences() {
  const saved = {fetch: globalThis.fetch, httpRequest: http.request, httpGet: http.get, httpsRequest: https.request, httpsGet: https.get}
  const denied = () => { throw new Error('Independent native original allowlist: unexpected live network') }
  globalThis.fetch = denied; http.request = denied; http.get = denied; https.request = denied; https.get = denied
  return () => { globalThis.fetch = saved.fetch; http.request = saved.httpRequest; http.get = saved.httpGet; https.request = saved.httpsRequest; https.get = saved.httpsGet }
}
export function replay(mutate = value => value) {
  const calls = [], legacyTextCalls = [], counts = new Map()
  return {
    calls, legacyTextCalls,
    evidenceTruth: 'Nine genuine opening-only originals. The second use of an original is a simulated offline closing response; it is not a captured closing observation.',
    fetchText: async url => {
      const record = originalPacket.records.find(value => value.method === 'GET' && value.requestedUrl === String(url))
      assert.ok(record, 'Exact saved GET body required for the real legacy seam: ' + url)
      legacyTextCalls.push({url: String(url), sha256: record.sha256, actualOriginal: true, metadataAvailableToLegacy: false})
      return originalText(record)
    },
    fetchImpl: async (url, init = {}) => {
      const requestedUrl = String(url), method = init.method ?? 'GET', key = method + ' ' + requestedUrl
      const original = originalPacket.records.find(value => value.method === method && value.requestedUrl === requestedUrl)
      assert.ok(original, 'Exact saved original method and URL allowlist: ' + key)
      assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit')
      if (method === 'POST') { assert.equal(init.body, '{}'); assert.equal(new Headers(init.headers).get('content-type'), 'application/json') }
      else assert.equal(init.body, undefined)
      const occurrence = counts.get(key) ?? 0; assert.ok(occurrence < 2, 'No third request or retry: ' + key); counts.set(key, occurrence + 1)
      const phase = occurrence === 0 ? 'opening' : 'simulated-closing'
      const input = {url: original.url, status: original.status, headers: structuredClone(original.headers), body: originalText(original)}
      const changed = mutate(input, {original, phase, key, occurrence, index: calls.length}) ?? input
      calls.push({url: requestedUrl, method, phase, originalSHA256: original.sha256, simulatedClosing: occurrence > 0, status: changed.status})
      const response = new Response(changed.body, {status: changed.status, headers: changed.headers})
      Object.defineProperties(response, {url: {value: changed.url}, redirected: {value: false}})
      return response
    },
  }
}
