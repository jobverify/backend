import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_DNS_LOOKUP_TIMEOUT_MS,
  resolveHostAddressesWithTimeout,
} from '../utils/dnsHostResolution.js'

test('dnsHostResolution exposes the shared bounded DNS timeout default', () => {
  assert.equal(DEFAULT_DNS_LOOKUP_TIMEOUT_MS, 3000)
})

test('resolveHostAddressesWithTimeout bounds and parallelizes stalled DNS lookups', async () => {
  const calls = []
  const never = (family) => async (host) => {
    calls.push(`${family}:${host}`)
    return new Promise(() => {})
  }
  const startedAt = Date.now()

  const addresses = await resolveHostAddressesWithTimeout(
    ['one.example', 'two.example'],
    {
      resolve4Impl: never('v4'),
      resolve6Impl: never('v6'),
      timeoutMs: 10,
    },
  )

  assert.deepEqual(addresses, [])
  assert.deepEqual(calls.sort(), [
    'v4:one.example',
    'v4:two.example',
    'v6:one.example',
    'v6:two.example',
  ])
  assert.ok(Date.now() - startedAt < 150)
})

test('resolveHostAddressesWithTimeout deduplicates addresses and ignores resolver failures', async () => {
  const addresses = await resolveHostAddressesWithTimeout(
    ['one.example'],
    {
      resolve4Impl: async () => ['203.0.113.10', '203.0.113.10'],
      resolve6Impl: async () => {
        throw new Error('resolver failed')
      },
      timeoutMs: 10,
    },
  )

  assert.deepEqual(addresses, ['203.0.113.10'])
})
