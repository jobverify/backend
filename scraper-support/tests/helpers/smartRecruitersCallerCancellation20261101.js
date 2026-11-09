import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { setImmediate } from 'node:timers/promises'

const opaqueReason = () => Object.defineProperty({}, 'message', {
  get() { throw Error('opaque cancellation reason cannot be formatted') },
})
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const boundedOutcome = async promise => {
  let timer
  const outcome = promise.then(value => ({ kind: 'fulfilled', value }), reason => ({ kind: 'rejected', reason }))
  try {
    return await Promise.race([outcome, new Promise(resolve => { timer = setTimeout(() => resolve({ kind: 'stalled' }), 500) })])
  } finally { clearTimeout(timer) }
}
const requireCallerRejection = async (promise, reason) => {
  const outcome = await boundedOutcome(promise)
  assert.equal(outcome.kind, 'rejected', 'the caller must settle promptly with its cancellation')
  assert.equal(outcome.reason, reason, 'preserve the exact caller reason')
}

const model = source => {
  const captured = source.decode(JSON.parse(gunzipSync(readFileSync(source.fixture))))
  const detail = JSON.parse(captured.detailBody), originalListing = JSON.parse(captured.listingBody)
  const row = originalListing.content.find(record => record.id === detail.id)
  assert.ok(row)
  // A one-role synthetic cancellation harness. The exact captured row/date and
  // full original capture are retained; this envelope is not an inventory proof.
  return { ...captured, listing: { ...originalListing, content: [structuredClone(row)], totalFound: 1 }, detail }
}

export const registerCallerCancellationControls = source => {
  for (const [label, makeReason] of [['Error', () => Error('caller stop')], ['zero', () => 0], ['null', () => null], ['opaque', opaqueReason]]) {
    test(`${source.name} pre-aborted ${label} caller prevents every reader`, async () => {
      const controller = new AbortController(), reason = makeReason()
      controller.abort(reason)
      let reads = 0
      const pending = source.module.run({ signal: controller.signal,
        fetchText: async () => { reads++; return '' }, fetchJson: async () => { reads++; return {} } })
      await requireCallerRejection(pending, reason)
      assert.equal(reads, 0)
    })
  }

  for (const stage of ['official', 'listing', 'detail']) {
    for (const [label, makeReason] of [['Error', () => Error('caller stopped ' + stage)], ['opaque', opaqueReason]]) {
      test(`${source.name} ${stage} ${label} cancellation settles a reader that ignores its signal`, async () => {
        const native = model(source), controller = new AbortController(), reason = makeReason()
        const entered = deferred(), blocked = deferred(), reads = []
        let readerSignal
        const wait = options => { readerSignal = options?.signal; entered.resolve(); return blocked.promise }
        const pending = source.module.run({ signal: controller.signal,
          fetchText: async (url, options) => { reads.push(url); return stage === 'official' ? wait(options) : native.officialBody },
          fetchJson: async (url, options) => {
            reads.push(url)
            const listing = new URL(url).searchParams.has('offset')
            if (stage === (listing ? 'listing' : 'detail')) return wait(options)
            assert.equal(listing, true, 'the only nonblocked API request is the synthetic listing')
            return structuredClone(native.listing)
          },
        })
        pending.catch(() => {})
        const started = await boundedOutcome(entered.promise)
        assert.equal(started.kind, 'fulfilled', 'the expected reader must be reached')
        controller.abort(reason)
        try {
          await requireCallerRejection(pending, reason)
          assert.ok(readerSignal instanceof AbortSignal)
          assert.equal(readerSignal.aborted, true)
          assert.equal(readerSignal.reason, reason)
          const count = reads.length
          blocked.reject(Error('late reader rejection after caller settlement'))
          await setImmediate()
          assert.equal(reads.length, count, 'cancellation must not schedule another request')
        } finally { blocked.reject(Error('release controlled reader')) }
      })
    }
  }

  for (const stage of ['official', 'listing', 'detail']) {
    test(`${source.name} default ${stage} body reader receives the caller signal and settles on abort`, async () => {
      const native = model(source), controller = new AbortController(), reason = opaqueReason()
      const entered = deferred(), blocked = deferred(), previousFetch = globalThis.fetch, reads = []
      let bodySignal
      globalThis.fetch = async (value, options = {}) => {
        const url = String(value), isOfficial = url === source.module.CAREERS_URL
          || source.module.BOARD_URL != null && url === source.module.BOARD_URL
        const listing = !isOfficial && new URL(url).searchParams.has('offset')
        const currentStage = isOfficial ? 'official' : listing ? 'listing' : 'detail'
        reads.push(url)
        if (currentStage === stage) {
          assert.ok(options.signal instanceof AbortSignal)
          return { ok: true, status: 200, url, headers: new Headers({ 'content-type': isOfficial ? 'text/html' : 'application/json' }),
            [isOfficial ? 'text' : 'json']: () => { bodySignal = options.signal; entered.resolve(); return blocked.promise } }
        }
        if (isOfficial) return new Response(native.officialBody, { status: 200, headers: { 'content-type': 'text/html' } })
        assert.equal(listing, true, 'no unadvertised detail or alternate host is allowed')
        return new Response(JSON.stringify(native.listing), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      const pending = source.module.run({ signal: controller.signal })
      pending.catch(() => {})
      try {
        const started = await boundedOutcome(entered.promise)
        assert.equal(started.kind, 'fulfilled', 'the default body reader must be reached')
        controller.abort(reason)
        await requireCallerRejection(pending, reason)
        assert.equal(bodySignal.aborted, true)
        assert.equal(bodySignal.reason, reason)
        const count = reads.length
        blocked.reject(Error('late body-reader rejection'))
        await setImmediate()
        assert.equal(reads.length, count)
      } finally {
        globalThis.fetch = previousFetch
        // The RED baseline may ignore the caller. Leave that pure pending
        // promise unresolved rather than accidentally starting legacy retries.
        if (bodySignal?.aborted && bodySignal.reason === reason) blocked.reject(Error('release controlled default reader'))
      }
    })
  }
}
