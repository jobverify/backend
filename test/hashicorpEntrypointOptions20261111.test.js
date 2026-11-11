import assert from 'node:assert/strict'
import test from 'node:test'

import { run, runHashiCorpSearch } from '../scraper/hashicorp/script.js'

// These are injected transport contracts; they do not assert native job facts.
const blockDefaultFetch = t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', () => {
    calls += 1
    throw new Error('HashiCorp options test forbids the default transport')
  })
  return () => calls
}

test('HashiCorp helper uses the caller-owned first search transport', async t => {
  const defaultCalls = blockDefaultFetch(t)
  const primary = new Error('owned helper transport failure')
  let calls = 0
  await assert.rejects(runHashiCorpSearch({
    fetchJson: async () => {
      calls += 1
      throw primary
    },
  }), error => error === primary)
  assert.equal(calls, 1)
  assert.equal(defaultCalls(), 0)
})

test('HashiCorp public run forwards the caller-owned first search transport', async t => {
  const defaultCalls = blockDefaultFetch(t)
  const primary = new Error('owned public transport failure')
  let calls = 0
  await assert.rejects(run({
    fetchJson: async () => {
      calls += 1
      throw primary
    },
  }), error => error === primary)
  assert.equal(calls, 1)
  assert.equal(defaultCalls(), 0)
})

test('HashiCorp public run forwards pre-aborted caller state before transport', async t => {
  const defaultCalls = blockDefaultFetch(t)
  const primary = new Error('owned caller cancellation')
  const controller = new AbortController()
  controller.abort(primary)
  let calls = 0
  await assert.rejects(run({
    signal: controller.signal,
    fetchJson: async () => {
      calls += 1
      throw new Error('pre-aborted transport must not start')
    },
  }), error => error === primary)
  assert.equal(calls, 0)
  assert.equal(defaultCalls(), 0)
})

test('HashiCorp public run forwards a zero-page bound without transport', async t => {
  const defaultCalls = blockDefaultFetch(t)
  let calls = 0
  assert.deepEqual(await run({
    maxPages: 0,
    fetchJson: async () => {
      calls += 1
      throw new Error('zero-page transport must not start')
    },
  }), [])
  assert.equal(calls, 0)
  assert.equal(defaultCalls(), 0)
})
