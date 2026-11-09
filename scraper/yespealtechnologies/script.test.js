import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PATHS,
  COMPANY,
  OFFICIAL_SURFACE_CANDIDATES,
  SOURCE,
  VERIFIED_AT,
  createYespealTechnologiesScraper,
  isExpectedMissingSurfaceError,
} from './script.js'

test('exports the verified missing-surface contract for Yespeal Technologies', () => {
  assert.equal(SOURCE, 'yespealtechnologies')
  assert.equal(COMPANY, 'Yespeal Technologies')
  assert.equal(VERIFIED_AT, '2026-07-13')

  assert.deepEqual(CAREERS_PATHS, [
    '/',
    '/careers',
    '/careers/',
    '/career',
    '/jobs',
    '/jobs/',
  ])

  assert.deepEqual(OFFICIAL_SURFACE_CANDIDATES, [
    'https://yespealtechnologies.com',
    'https://www.yespealtechnologies.com',
    'https://yespealtechnologies.in',
    'https://www.yespealtechnologies.in',
    'https://yespealtechnologies.co.in',
    'https://www.yespealtechnologies.co.in',
    'https://yespeal.com',
    'https://www.yespeal.com',
    'https://yespeal.in',
    'https://www.yespeal.in',
    'https://yespeal.co.in',
    'https://www.yespeal.co.in',
    'https://yespealtech.com',
    'https://www.yespealtech.com',
    'https://yespealtech.in',
    'https://www.yespealtech.in',
    'https://yespealtech.co.in',
    'https://www.yespealtech.co.in',
  ])
})

test('recognizes the DNS failures that keep the Yespeal sentinel truthful', () => {
  assert.equal(isExpectedMissingSurfaceError(new Error('The remote name could not be resolved: yespealtechnologies.com')), true)
  assert.equal(isExpectedMissingSurfaceError(new Error('getaddrinfo ENOTFOUND yespealtechnologies.in')), true)
  assert.equal(isExpectedMissingSurfaceError(new Error('fetch failed: DNS lookup failed')), true)
  assert.equal(isExpectedMissingSurfaceError(new Error('socket hang up')), false)
  assert.equal(isExpectedMissingSurfaceError(new Error('HTTP 404 for https://yespealtechnologies.com')), false)
})

test('run returns no jobs only while every verified Yespeal candidate surface stays unresolved', async () => {
  const requestedUrls = []
  const scraper = createYespealTechnologiesScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      throw new Error(`The remote name could not be resolved: ${url}`)
    },
  })

  assert.equal(requestedUrls.length, OFFICIAL_SURFACE_CANDIDATES.length)
  assert.equal(requestedUrls[0], 'https://yespealtechnologies.com/')
  assert.equal(requestedUrls.at(-1), 'https://www.yespealtech.co.in/')
  assert.deepEqual(jobs, [])
})

test('run fails closed when any Yespeal candidate surface starts resolving or drifts unexpectedly', async () => {
  const scraper = createYespealTechnologiesScraper()

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === 'https://yespeal.in/') {
          return '<html><title>Yespeal Technologies</title><body>Careers</body></html>'
        }

        throw new Error(`The remote name could not be resolved: ${url}`)
      },
    }),
    /official first-party surface changed/i,
  )

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === 'https://yespealtechnologies.com/') {
          throw new Error(`HTTP 404 for ${url}`)
        }

        throw new Error(`The remote name could not be resolved: ${url}`)
      },
    }),
    /official first-party surface changed/i,
  )
})
