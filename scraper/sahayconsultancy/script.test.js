import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_ROUTE_PATHS,
  COMPANY,
  DOMAIN_CANDIDATES,
  SOURCE,
  buildCareerRouteUrls,
  createSahayConsultancyScraper,
  defaultFetchPage,
  isUnresolvableHostError,
} from './script.js'

test('exports the verified Sahay Consultancy sentinel metadata', () => {
  assert.equal(SOURCE, 'sahayconsultancy')
  assert.equal(COMPANY, 'Sahay Consultancy')
  assert.deepEqual(DOMAIN_CANDIDATES, [
    'https://www.sahayconsultancy.com/',
    'https://sahayconsultancy.com/',
    'https://www.sahayconsultancy.in/',
    'https://sahayconsultancy.in/',
    'https://www.sahayconsultancy.co.in/',
    'https://sahayconsultancy.co.in/',
  ])
  assert.deepEqual(CAREERS_ROUTE_PATHS, [
    'careers',
    'career',
    'jobs',
    'join-us',
    'work-with-us',
    'openings',
  ])
})

test('buildCareerRouteUrls appends the verified careers route probes to a root URL', () => {
  assert.deepEqual(
    buildCareerRouteUrls('https://www.sahayconsultancy.com/'),
    [
      'https://www.sahayconsultancy.com/careers',
      'https://www.sahayconsultancy.com/career',
      'https://www.sahayconsultancy.com/jobs',
      'https://www.sahayconsultancy.com/join-us',
      'https://www.sahayconsultancy.com/work-with-us',
      'https://www.sahayconsultancy.com/openings',
    ],
  )
})

test('isUnresolvableHostError accepts the DNS failures seen during live verification', () => {
  assert.equal(
    isUnresolvableHostError(new Error("The remote name could not be resolved: 'www.sahayconsultancy.com'")),
    true,
  )
  assert.equal(
    isUnresolvableHostError(new Error('getaddrinfo ENOTFOUND sahayconsultancy.com')),
    true,
  )
  assert.equal(
    isUnresolvableHostError('getaddrinfo ENOTFOUND sahayconsultancy.co.in'),
    true,
  )
  assert.equal(
    isUnresolvableHostError(Object.assign(new TypeError('fetch failed'), {
      cause: {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND sahayconsultancy.com',
      },
    })),
    true,
  )
  assert.equal(
    isUnresolvableHostError(new Error('socket hang up')),
    false,
  )
})

test('default fetch applies a bounded timeout to Sahay Consultancy probes', async () => {
  let capturedInit = null
  const page = await defaultFetchPage(DOMAIN_CANDIDATES[0], {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init
      return {
        status: 404,
        url,
        text: async () => '<html><title>Not Found</title></html>',
      }
    },
  })

  assert.equal(page.status, 404)
  assert.equal(page.url, DOMAIN_CANDIDATES[0])
  assert.equal(capturedInit.redirect, 'follow')
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('run returns an empty list only while every exact-match first-party domain remains absent', async () => {
  const visited = []
  const scraper = createSahayConsultancyScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      visited.push(url)
      throw new Error(`getaddrinfo ENOTFOUND ${new URL(url).hostname}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(visited, DOMAIN_CANDIDATES)
})

test('run fails closed when an exact-match first-party root starts resolving', async () => {
  const scraper = createSahayConsultancyScraper()

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => {
        if (url === 'https://www.sahayconsultancy.com/') {
          return {
            status: 200,
            url,
            html: '<html><title>Sahay Consultancy</title></html>',
          }
        }

        throw new Error(`getaddrinfo ENOTFOUND ${new URL(url).hostname}`)
      },
    }),
    /exact-match first-party domain now resolves/i,
  )
})

test('run fails closed when a careers route starts resolving on an exact-match first-party domain', async () => {
  const visited = []
  const scraper = createSahayConsultancyScraper()

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => {
        visited.push(url)

        if (url === 'https://www.sahayconsultancy.com/') {
          return {
            status: 404,
            url,
            html: '<html><title>404 Not Found</title></html>',
          }
        }

        if (url === 'https://www.sahayconsultancy.com/careers') {
          return {
            status: 200,
            url,
            html: '<html><title>Careers</title><body>Join our team</body></html>',
          }
        }

        throw new Error(`getaddrinfo ENOTFOUND ${new URL(url).hostname}`)
      },
    }),
    /careers route now resolves/i,
  )

  assert.deepEqual(visited, [
    'https://www.sahayconsultancy.com/',
    'https://www.sahayconsultancy.com/careers',
  ])
})
