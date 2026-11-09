import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper/hanosoftwaresolutions/fixtures',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareersShellHtml = readFixture('careers-shell.html')
const verifiedAppBundleJs = readFixture('app-bundle.js')

const loadModule = async () => {
  try {
    return await import('../../scraper/hanosoftwaresolutions/script.js')
  } catch {
    assert.fail('Expected Hano Software Solutions scraper module at ../../scraper/hanosoftwaresolutions/script.js')
  }
}

test('Hano Software Solutions validates the verified homepage shell, common careers shells, and bundle without jobs signals', async () => {
  const hano = await loadModule()

  assert.equal(hano.SOURCE, 'hanosoftwaresolutions')
  assert.equal(hano.COMPANY, 'Hano Software Solutions')
  assert.equal(hano.HOMEPAGE_URL, 'https://www.hanosoftwaresolutions.com/')
  assert.deepEqual(hano.CAREERS_ROUTE_URLS, [
    'https://www.hanosoftwaresolutions.com/careers',
    'https://www.hanosoftwaresolutions.com/careers/',
    'https://www.hanosoftwaresolutions.com/career',
    'https://www.hanosoftwaresolutions.com/career/',
    'https://www.hanosoftwaresolutions.com/jobs',
    'https://www.hanosoftwaresolutions.com/jobs/',
    'https://www.hanosoftwaresolutions.com/join-us',
    'https://www.hanosoftwaresolutions.com/join-us/',
  ])
  assert.equal(hano.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(hano.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(hano.extractBundleAssetPath(verifiedHomepageHtml), '/assets/index-37e67fdf.js')
  assert.equal(hano.hasVerifiedBundleSignal(verifiedAppBundleJs), true)
  assert.equal(hano.hasBundleJobsSignal(verifiedAppBundleJs), false)

  assert.equal(
    hano.isVerifiedCareersShell({
      status: 200,
      url: hano.CAREERS_ROUTE_URLS[0],
      headers: {},
      html: verifiedCareersShellHtml,
    }),
    true,
  )

  assert.equal(
    hano.isVerifiedCareersShell({
      status: 200,
      url: hano.CAREERS_ROUTE_URLS[0],
      headers: {},
      html: '<html><body><h1>Careers</h1><a href="/jobs/frontend-engineer">Apply now</a></body></html>',
    }),
    false,
  )
})

test('Hano Software Solutions returns no jobs only while the verified first-party shell and bundle remain unchanged', async () => {
  const hano = await loadModule()
  const requestedPages = []
  const requestedText = []

  const jobs = await hano.createHanoSoftwareSolutionsScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === hano.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedHomepageHtml,
        }
      }

      if (hano.CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedCareersShellHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedText.push(url)

      if (url === 'https://www.hanosoftwaresolutions.com/assets/index-37e67fdf.js') {
        return verifiedAppBundleJs
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    hano.HOMEPAGE_URL,
    ...hano.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(requestedText, ['https://www.hanosoftwaresolutions.com/assets/index-37e67fdf.js'])
  assert.deepEqual(jobs, [])
})

test('Hano Software Solutions returns discovery-only evidence when the official hostname cannot be resolved', async () => {
  const hano = await loadModule()
  const dnsError = Object.assign(new Error('fetch failed'), {
    cause: { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND www.hanosoftwaresolutions.com' },
  })

  const jobs = await hano.createHanoSoftwareSolutionsScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
    fetchPage: async () => { throw dnsError },
  })

  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, hano.HOMEPAGE_URL)
  assert.equal(evidence?.listingComplete, false)
})

test('Hano Software Solutions fails closed when the homepage, careers shell, or bundle contract changes', async () => {
  const hano = await loadModule()

  await assert.rejects(
    hano.createHanoSoftwareSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === hano.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 200, url, headers: {}, html: verifiedCareersShellHtml }
      },
      fetchText: async () => verifiedAppBundleJs,
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    hano.createHanoSoftwareSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === hano.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: verifiedHomepageHtml }
        }

        if (url === hano.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Careers</h1><a href="/jobs/frontend-engineer">Apply now</a></body></html>',
          }
        }

        return { status: 200, url, headers: {}, html: verifiedCareersShellHtml }
      },
      fetchText: async () => verifiedAppBundleJs,
    }),
    /careers routes changed materially or now expose public jobs/i,
  )

  await assert.rejects(
    hano.createHanoSoftwareSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === hano.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: verifiedHomepageHtml }
        }

        return { status: 200, url, headers: {}, html: verifiedCareersShellHtml }
      },
      fetchText: async () =>
        'const routes = ["/", "/careers"]; const board = "https://jobs.ashbyhq.com/hano"; const cta = "Apply now";',
    }),
    /client bundle changed materially or now exposes a public jobs surface/i,
  )
})
