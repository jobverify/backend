import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { createCoinbaseScraper, run } from '../../scraper/coinbase/script.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'

const capturedBody = await readFile(new URL('../../scraper/coinbase/native-captures/greenhouse-coinbase-jobs-20261101.json', import.meta.url), 'utf8')
const challenge = await readFile(new URL('../../scraper/coinbase/native-captures/first-party-listing-denied-20261101.html', import.meta.url), 'utf8')

test('Coinbase module entrypoint forwards output limits while observing the complete native response', async () => {
  const jobs = await run({ fetchJson: async () => JSON.parse(capturedBody), maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(readSourceObservationEvidence(jobs, 'coinbase').observedRecordCount, 254)
  assert.equal(jobs[0].sourceListingComplete, false)
})

test('Coinbase propagates an injected native denial without fetching employer or browser pages', async () => {
  const denial = Object.assign(new Error('HTTP 403 public native source denied'), { status: 403 })
  await assert.rejects(run({
    fetchJson: async () => { throw denial },
    fetchText: async () => assert.fail('employer retry after native denial'),
    fetchPage: async () => assert.fail('second client retry after native denial'),
    fetchBrowserText: async () => assert.fail('browser retry after native denial'),
  }), error => error === denial)
})

test('Coinbase treats an HTTP 200 challenge body as denied rather than successful zero', async () => {
  let calls = 0
  await assert.rejects(run({ fetchImpl: async () => {
    calls++
    return new Response(challenge, { status: 200 })
  } }), /access denied/i)
  assert.equal(calls, 1)
})

test('Coinbase does not follow a native redirect back to the challenged employer route', async () => {
  let calls = 0
  await assert.rejects(run({ fetchImpl: async (url, options) => {
    calls++
    assert.equal(options.redirect, 'manual')
    return new Response('', { status: 302, headers: { location: 'https://www.coinbase.com/careers/positions' } })
  } }), /Native HTTP 302/i)
  assert.equal(calls, 1)
})

test('Coinbase preserves in-flight caller cancellation through its bounded native transport', async () => {
  const controller = new AbortController()
  const reason = new Error('Caller cancelled the source read')
  await assert.rejects(createCoinbaseScraper().run({ signal: controller.signal,
    fetchImpl: async (_url, options) => {
      assert.equal(options.signal.aborted, false)
      controller.abort(reason)
      assert.equal(options.signal.aborted, true)
      return new Response(capturedBody, { status: 200 })
    },
  }), error => error === reason)
})
