import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URLS,
  HOMEPAGE_URLS,
  createRadspanWirelessSystemsScraper,
  isDomainAbsentError,
} from './script.js'

test('uses the verified RADSPAN candidate first-party URLs', () => {
  assert.deepEqual(HOMEPAGE_URLS, [
    'https://www.radspanwirelesssystems.com/',
    'https://radspanwirelesssystems.com/',
    'https://www.radspan.com/',
    'https://radspan.com/',
  ])

  assert.deepEqual(CAREERS_URLS, [
    'https://www.radspanwirelesssystems.com/careers',
    'https://radspanwirelesssystems.com/careers',
    'https://www.radspan.com/careers',
    'https://radspan.com/careers',
    'https://www.radspanwirelesssystems.com/jobs',
    'https://radspanwirelesssystems.com/jobs',
    'https://www.radspan.com/jobs',
    'https://radspan.com/jobs',
  ])
})

test('recognizes domain-absent fetch failures', () => {
  assert.equal(isDomainAbsentError(new Error('getaddrinfo ENOTFOUND radspan.com')), true)
  assert.equal(isDomainAbsentError(new Error('Could not resolve host: www.radspanwirelesssystems.com')), true)
  assert.equal(isDomainAbsentError(new Error('DNS name does not exist')), true)
  assert.equal(isDomainAbsentError(new Error('HTTP 404 for https://radspan.com/careers')), false)
})

test('run returns no jobs only while every verified public URL is domain-absent', async () => {
  const requestedUrls = []
  const jobs = await createRadspanWirelessSystemsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      throw new Error(`getaddrinfo ENOTFOUND ${new URL(url).hostname}`)
    },
  })

  assert.deepEqual(requestedUrls, [...HOMEPAGE_URLS, ...CAREERS_URLS])
  assert.deepEqual(jobs, [])
})

test('run fails closed when any candidate public URL starts resolving', async () => {
  await assert.rejects(
    createRadspanWirelessSystemsScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URLS[0]) {
          return '<html><title>RADSPAN Wireless Systems</title></html>'
        }

        throw new Error(`getaddrinfo ENOTFOUND ${new URL(url).hostname}`)
      },
    }),
    /public surface changed/i,
  )
})
