import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveWorkdayDetailFetchConcurrency } from '../myworkday/engine.js'

test('Workday detail fetch concurrency prefers an explicit env override', () => {
  assert.equal(resolveWorkdayDetailFetchConcurrency('1', 4), 1)
})

test('Workday detail fetch concurrency falls back to scraper config when env is unset', () => {
  assert.equal(resolveWorkdayDetailFetchConcurrency('', 2), 2)
})

test('Workday detail fetch concurrency falls back to the shared default when unset everywhere', () => {
  assert.equal(resolveWorkdayDetailFetchConcurrency('', null), 4)
})
