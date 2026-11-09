import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'

const careers = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/careers-response.json.gz', import.meta.url))))
const active = JSON.parse(readFileSync(new URL('./fixtures/additional-native-api-pages.json', import.meta.url)))[0]

test('Skan stops oversized response streams before buffering the entire body', async () => {
  const original = globalThis.fetch
  let cancelled = false
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1)) },
    cancel() { cancelled = true },
  })
  globalThis.fetch = async url => ({ status: 200, url, body, text: () => new Response(body).text() })
  try {
    await assert.rejects(run({ timeoutMs: 100 }), /response exceeds request bound/)
    assert.equal(cancelled, true)
  } finally { globalThis.fetch = original }
})

test('Skan cancels a stalled response stream when the deadline expires', async () => {
  const original = globalThis.fetch
  let cancelled = false
  const body = new ReadableStream({ cancel() { cancelled = true } })
  globalThis.fetch = async url => ({ status: 200, url, body, text: () => new Response(body).text() })
  try {
    await assert.rejects(run({ timeoutMs: 20 }), /timed out/)
    assert.equal(cancelled, true)
  } finally { globalThis.fetch = original }
})

test('Skan immediately cancels sibling requests after a native detail fails', async () => {
  let detailSignal
  let started = 0
  await assert.rejects(run({ timeoutMs: 5000, now: active.capturedAt, fetchText: async (url, { signal }) => {
    if (url === careers.url) return careers.body
    if (url === active.url) return active.body
    detailSignal = signal
    if (started++ === 0) throw new Error('native detail unavailable')
    return new Promise(() => {})
  } }), /native detail unavailable/)
  assert.equal(detailSignal.aborted, true)
})

test('Skan cancels unread HTTP failure and redirect bodies', async () => {
  const original = globalThis.fetch
  try {
    for (const redirect of [false, true]) {
      let cancelled = false
      const body = new ReadableStream({ cancel() { cancelled = true } })
      globalThis.fetch = async url => ({ status: redirect ? 200 : 503, url: redirect ? url + '/foreign' : url, body })
      await assert.rejects(run(), /HTTP failure|redirect/)
      assert.equal(cancelled, true)
    }
  } finally { globalThis.fetch = original }
})

test('Skan rejects transport without a bounded readable response stream', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async url => ({ status: 200, url, text: async () => careers.body })
  try { await assert.rejects(run(), /readable response stream/) }
  finally { globalThis.fetch = original }
})

test('Skan enforces elapsed deadline even while microtasks prevent the timeout callback', async () => {
  const details = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/detail-responses.json.gz', import.meta.url))))
  await assert.rejects(run({ timeoutMs: 20, fetchText: async url => {
    const until = performance.now() + 40
    while (performance.now() < until) {}
    return [careers, active, ...details].find(capture => capture.url === url).body
  } }), /timed out/)
})
