import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'codevicesolutionpvtltd',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareersShellHtml = readFixture('careers-shell.html')
const verifiedAppBundleJs = readFixture('app-bundle.js')

const loadModule = async () => {
  try {
    return await import('../../scraper/codevicesolutionpvtltd/script.js')
  } catch {
    assert.fail('Expected Codevice Solution Pvt Ltd scraper module at ../../scraper/codevicesolutionpvtltd/script.js')
  }
}

test('Codevice Solution Pvt Ltd validates the verified homepage shell, common careers shells, and bundle without public jobs signals', async () => {
  const codevice = await loadModule()

  assert.equal(codevice.SOURCE, 'codevicesolutionpvtltd')
  assert.equal(codevice.COMPANY, 'Codevice Solution Pvt Ltd')
  assert.equal(codevice.HOMEPAGE_URL, 'https://codevicesolution.in/')
  assert.deepEqual(codevice.CAREERS_ROUTE_URLS, [
    'https://codevicesolution.in/careers',
    'https://codevicesolution.in/careers/',
    'https://codevicesolution.in/career',
    'https://codevicesolution.in/career/',
    'https://codevicesolution.in/jobs',
    'https://codevicesolution.in/jobs/',
    'https://codevicesolution.in/join-us',
    'https://codevicesolution.in/join-us/',
  ])
  assert.equal(codevice.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(codevice.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(codevice.extractBundleAssetPath(verifiedHomepageHtml), '/assets/index-DV62x6p4.js')
  assert.equal(codevice.hasVerifiedBundleSignal(verifiedAppBundleJs), true)
  assert.equal(codevice.hasBundleJobsSignal(verifiedAppBundleJs), false)
  assert.equal(
    codevice.isVerifiedCareersShell({
      status: 200,
      url: codevice.CAREERS_ROUTE_URLS[0],
      headers: {},
      html: verifiedCareersShellHtml,
    }),
    true,
  )
  assert.equal(
    codevice.hasBundleJobsSignal('const routes = ["/careers"]; const cta = "Apply now";'),
    true,
  )
})

test('Codevice Solution Pvt Ltd returns an empty discovery snapshot after validating the authentic shell and bundle', async () => {
  const codevice = await loadModule()
  const requestedPages = []
  const requestedText = []

  const jobs = await codevice.createCodeviceSolutionPvtLtdScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === codevice.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedHomepageHtml,
        }
      }

      if (codevice.CAREERS_ROUTE_URLS.includes(url)) {
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

      if (url === 'https://codevicesolution.in/assets/index-DV62x6p4.js') {
        return verifiedAppBundleJs
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    codevice.HOMEPAGE_URL,
    ...codevice.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(requestedText, ['https://codevicesolution.in/assets/index-DV62x6p4.js'])
  assert.deepEqual(jobs, [])
})

test('Codevice Solution Pvt Ltd preserves caller cancellation at every verified request boundary', async () => {
  const codevice = await loadModule()

  for (let stopAt = 0; stopAt < 10; stopAt += 1) {
    const controller = new AbortController()
    const reason = new Error('caller stopped Codevice audit')
    const calls = []
    const responseFor = (url) => {
      if (url === codevice.HOMEPAGE_URL) {
        return { status: 200, url, headers: {}, html: verifiedHomepageHtml }
      }
      if (codevice.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 200, url, headers: {}, html: verifiedCareersShellHtml }
      }
      if (url === 'https://codevicesolution.in/assets/index-DV62x6p4.js') return verifiedAppBundleJs
      throw new Error(`Unexpected URL: ${url}`)
    }
    const fetchSurface = async (url, { signal }) => {
      assert.ok(signal)
      calls.push(url)
      const response = responseFor(url)
      if (calls.length - 1 === stopAt) controller.abort(reason)
      return response
    }

    await assert.rejects(codevice.run({
      signal: controller.signal,
      fetchPage: fetchSurface,
      fetchText: fetchSurface,
    }), (error) => error === reason)
    assert.equal(calls.length, stopAt + 1)
  }
})

test('Codevice Solution Pvt Ltd applies a bounded deadline to injected requests', async () => {
  const codevice = await loadModule()
  const testKeepAlive = setTimeout(() => {}, 1000)
  const neverCompletes = async (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })

  try {
    await assert.rejects(codevice.run({
      requestTimeoutMs: 5,
      fetchPage: neverCompletes,
      fetchText: neverCompletes,
    }), (error) => error?.name === 'TimeoutError')
  } finally {
    clearTimeout(testKeepAlive)
  }
})

test('Codevice Solution Pvt Ltd fails closed when the homepage shell, careers shell, or bundle contract changes', async () => {
  const codevice = await loadModule()

  await assert.rejects(
    codevice.createCodeviceSolutionPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === codevice.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 200, url, headers: {}, html: verifiedCareersShellHtml }
      },
      fetchText: async () => verifiedAppBundleJs,
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    codevice.createCodeviceSolutionPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === codevice.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: verifiedHomepageHtml }
        }

        if (url === codevice.CAREERS_ROUTE_URLS[0]) {
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
    codevice.createCodeviceSolutionPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === codevice.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: verifiedHomepageHtml }
        }

        return { status: 200, url, headers: {}, html: verifiedCareersShellHtml }
      },
      fetchText: async () =>
        'const routes = ["/", "/careers"]; const board = "https://jobs.ashbyhq.com/codevice"; const cta = "Apply now";',
    }),
    /client bundle changed materially or now exposes a public jobs surface/i,
  )
})
