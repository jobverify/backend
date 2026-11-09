import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CLOUDFLARE_522_URLS,
  COMPANY,
  SOURCE,
  UNRESOLVED_VARIANT_HOSTS,
  createEcmDataScraper,
  hasResolvableVariantHost,
  isExpectedCloudflare522Surface,
  isExpectedUnavailableExactNameSurface,
} from './script.js'

test('ECM Data unreachable-surface sentinel accepts both the old 522 and current timeout failure modes', () => {
  assert.equal(SOURCE, 'ecmdata')
  assert.equal(COMPANY, 'ECM Data')
  assert.equal(CLOUDFLARE_522_URLS.length, 8)
  assert.equal(UNRESOLVED_VARIANT_HOSTS.length, 6)
  assert.equal(
    isExpectedCloudflare522Surface({ status: 522, headers: { server: 'cloudflare' } }),
    true,
  )
  assert.equal(
    isExpectedUnavailableExactNameSurface({ status: 522, headers: { server: 'cloudflare' } }),
    true,
  )
  assert.equal(
    isExpectedUnavailableExactNameSurface({ status: null, errorKind: 'timeout' }),
    true,
  )
  assert.equal(hasResolvableVariantHost([]), false)
  assert.equal(hasResolvableVariantHost(['203.0.113.10']), true)
})

test('ECM Data scraper returns [] while the exact-name surface stays unreachable and variant hosts stay unresolved', async () => {
  const jobs = await createEcmDataScraper().run({
    probeUrl: async (url) => ({
      url,
      finalUrl: url,
      status: null,
      headers: {},
      html: null,
      errorKind: 'timeout',
    }),
    resolveHosts: async () => [],
  })

  assert.deepEqual(jobs, [])
})

test('ECM Data scraper fails closed when an India exact-name variant host starts resolving', async () => {
  await assert.rejects(
    createEcmDataScraper().run({
      probeUrl: async (url) => ({
        url,
        finalUrl: url,
        status: null,
        headers: {},
        html: null,
        errorKind: 'timeout',
      }),
      resolveHosts: async () => ['203.0.113.10'],
    }),
    /variant hosts now resolve/i,
  )
})
