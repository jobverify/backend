import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchTextWithRetry, fetchJsonWithRetry } from '../utils/fetch.js'

const url = 'https://careers.example.test/native'
for (const [kind, read, value] of [['text', fetchTextWithRetry, 'native body'], ['json', fetchJsonWithRetry, { jobs: [] }]]) {
  const response = body => ({ ok: true, status: 200, url, headers: new Headers({ 'content-type': kind === 'text' ? 'text/html' : 'application/json' }),
    text: body, json: body })

  test(`shared ${kind} fetch checks caller cancellation after headers before any body read`, async t => {
    const caller = new AbortController(), reason = Object.freeze(Error('caller stopped after headers'))
    let bodies = 0
    t.mock.method(globalThis, 'fetch', async () => { caller.abort(reason); return response(async () => { bodies += 1; return value }) })
    await assert.rejects(read(url, { signal: caller.signal, attempts: 1 }), error => error === reason)
    assert.equal(bodies, 0)
  })

  for (const stage of ['headers', 'body']) {
    test(`shared ${kind} fetch cannot accept its own expired attempt after ${stage}`, async t => {
      const timeout = new AbortController(), reason = Object.freeze(new DOMException('attempt timed out', 'TimeoutError'))
      let bodies = 0
      t.mock.method(AbortSignal, 'timeout', () => timeout.signal)
      t.mock.method(globalThis, 'fetch', async () => {
        if (stage === 'headers') timeout.abort(reason)
        return response(async () => { bodies += 1; if (stage === 'body') timeout.abort(reason); return value })
      })
      await assert.rejects(read(url, { attempts: 1 }), error => error === reason || error.cause === reason)
      assert.equal(bodies, stage === 'headers' ? 0 : 1)
    })
  }

  test(`shared ${kind} fetch still preserves the exact frozen caller reason after a replaced body error`, async t => {
    const caller = new AbortController(), reason = Object.freeze(Error('caller stopped in body'))
    t.mock.method(globalThis, 'fetch', async () => response(async () => { caller.abort(reason); throw Error('replacement body error') }))
    await assert.rejects(read(url, { signal: caller.signal, attempts: 1 }), error => error === reason)
  })
}

test('shared JSON fetch checks its expired attempt before classifying a late HTML body as an upstream contract error', async t => {
  const timeout = new AbortController(), reason = Object.freeze(new DOMException('attempt timed out reading HTML', 'TimeoutError'))
  t.mock.method(AbortSignal, 'timeout', () => timeout.signal)
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, url,
    headers: new Headers({ 'content-type': 'text/html' }), text: async () => { timeout.abort(reason); return '<p>Forbidden</p>' } }))
  await assert.rejects(fetchJsonWithRetry(url, { attempts: 1 }), error => error === reason || error.cause === reason)
})

for (const [kind, read] of [['text', fetchTextWithRetry], ['json', fetchJsonWithRetry]]) {
  test(`shared ${kind} fetch retains its own frozen timeout when a native body reader rejects with a replacement AbortError`, async t => {
    const deadline = new AbortController()
    const reason = Object.freeze(new DOMException('controlled native body request deadline', 'TimeoutError'))
    const replacement = new DOMException('Native body reader replaced deadline reason', 'AbortError')
    let requests = 0, pulls = 0
    t.mock.method(AbortSignal, 'timeout', () => deadline.signal)
    await assert.rejects(read(url, { attempts: 1, fetchImpl: async (_url, options) => {
      requests++
      const stream = new ReadableStream({
        start(controller) {
          options.signal.addEventListener('abort', () => controller.error(replacement), { once: true })
        },
        pull() { pulls++; deadline.abort(reason) },
      }, { highWaterMark: 0 })
      return new Response(stream, { headers: { 'content-type': kind === 'text' ? 'text/html' : 'application/json' } })
    } }), error => error === reason || error.cause === reason)
    assert.equal(requests, 1)
    assert.equal(pulls, 1)
    assert.equal(Object.isFrozen(reason), true)
  })
}

for (const order of ['caller-first', 'own-first']) {
  test(`shared fetch keeps caller priority when a native rejected body observes both aborts: ${order}`, async t => {
    const deadline = new AbortController(), caller = new AbortController()
    const ownReason = Object.freeze(new DOMException('request body deadline', 'TimeoutError'))
    const callerReason = Object.freeze(Error('source caller stopped during body read'))
    t.mock.method(AbortSignal, 'timeout', () => deadline.signal)
    await assert.rejects(fetchTextWithRetry(url, { attempts: 1, signal: caller.signal, fetchImpl: async (_url, options) => {
      const stream = new ReadableStream({
        start(controller) {
          options.signal.addEventListener('abort', () => controller.error(new DOMException('replacement body abort', 'AbortError')), { once: true })
        },
        pull() {
          if (order === 'caller-first') { caller.abort(callerReason); deadline.abort(ownReason) }
          else { deadline.abort(ownReason); caller.abort(callerReason) }
        },
      }, { highWaterMark: 0 })
      return new Response(stream, { headers: { 'content-type': 'text/html' } })
    } }), error => error === callerReason)
  })
}
