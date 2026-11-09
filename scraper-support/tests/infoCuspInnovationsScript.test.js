import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'infocuspinnovations')

const readFixture = (name) => readFile(path.join(fixturesDir, name), 'utf8')

const KEKA_FORBIDDEN_HTML = `
<!DOCTYPE html>
<html style="height:100%">
  <head>
    <meta charset="utf-8" />
    <title>Forbidden Access</title>
    <link href="https://fonts.googleapis.com/css?family=Roboto:500,400italic,100,700italic,300,700,500italic,100italic,300italic,400" rel="stylesheet" type="text/css">
    <link rel="stylesheet" href="https://cdn.keka.com/shared/fonts/proximanova/proximanova.css" />
  </head>
  <body>
    <main>
      <h1>Forbidden Access</h1>
      <p>The requested resource is not available.</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/infocuspinnovations/script.js')
  } catch {
    assert.fail('Expected InfoCusp Innovations scraper module at ../../scraper/infocuspinnovations/script.js')
  }
}

test('InfoCusp Innovations validates the verified homepage, careers shell, Keka bundle config, and India jobs payload', async () => {
  const infocusp = await loadModule()
  const homepageHtml = await readFixture('homepage.html')
  const careersHtml = await readFixture('careers-openings.html')
  const bundleJs = await readFixture('current-openings-bundle.js')
  const activeJobs = JSON.parse(await readFixture('active-jobs.json'))

  assert.equal(infocusp.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(infocusp.hasVerifiedCareersPageSignal(careersHtml), true)

  const bundlePath = infocusp.extractCareersBundlePath(careersHtml)
  assert.equal(typeof bundlePath, 'string')

  const config = infocusp.extractCareerConfig(bundleJs)
  assert.deepEqual(config, {
    identifier: infocusp.EXPECTED_IDENTIFIER,
    domain: infocusp.EXPECTED_KEKA_DOMAIN,
    portalName: 'default',
  })

  const jobs = infocusp.extractSearchResults(activeJobs, config)
  assert.ok(jobs.length > 0)
  assert.equal(jobs[0].company, 'InfoCusp Innovations')
  assert.match(jobs[0].sourceUrl, /infocusp\.keka\.com/i)
})

test('InfoCusp Innovations falls back to browser-backed loaders when Node transport times out', async () => {
  const infocusp = await loadModule()
  const homepageHtml = await readFixture('homepage.html')
  const careersHtml = await readFixture('careers-openings.html')
  const bundleJs = await readFixture('current-openings-bundle.js')
  const activeJobs = JSON.parse(await readFixture('active-jobs.json'))
  const bundlePath = infocusp.extractCareersBundlePath(careersHtml)
  const bundleUrl = new URL(bundlePath, infocusp.HOMEPAGE_URL).toString()
  const activeJobsUrl = infocusp.buildActiveJobsUrl({
    identifier: infocusp.EXPECTED_IDENTIFIER,
    domain: infocusp.EXPECTED_KEKA_DOMAIN,
    portalName: 'default',
  })

  const requestedPrimaryTextUrls = []
  const requestedPrimaryJsonUrls = []
  const requestedBrowserTextUrls = []
  const requestedBrowserJsonUrls = []

  const jobs = await infocusp.createInfoCuspInnovationsScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedPrimaryTextUrls.push(url)
      throw new TypeError('fetch failed | Connect Timeout Error')
    },
    fetchJson: async (url) => {
      requestedPrimaryJsonUrls.push(url)
      throw new TypeError('fetch failed | Connect Timeout Error')
    },
    fetchBrowserText: async (url) => {
      requestedBrowserTextUrls.push(url)

      if (url === infocusp.HOMEPAGE_URL) return homepageHtml
      if (url === infocusp.CAREERS_URL) return careersHtml
      if (url === bundleUrl) return bundleJs
      throw new Error(`Unexpected browser text URL: ${url}`)
    },
    fetchBrowserJson: async (url) => {
      requestedBrowserJsonUrls.push(url)

      if (url === activeJobsUrl) return activeJobs
      throw new Error(`Unexpected browser JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPrimaryTextUrls, [
    infocusp.HOMEPAGE_URL,
    infocusp.CAREERS_URL,
    bundleUrl,
  ])
  assert.deepEqual(requestedPrimaryJsonUrls, [activeJobsUrl])
  assert.deepEqual(requestedBrowserTextUrls, requestedPrimaryTextUrls)
  assert.deepEqual(requestedBrowserJsonUrls, [activeJobsUrl])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'infocuspinnovations')
})

test('InfoCusp Innovations returns no jobs when the verified careers page renders a jobs load error', async () => {
  const infocusp = await loadModule()
  const homepageHtml = await readFixture('homepage.html')
  const careersHtml = await readFixture('careers-openings.html')
  const bundleJs = await readFixture('current-openings-bundle.js')
  const bundlePath = infocusp.extractCareersBundlePath(careersHtml)
  const bundleUrl = new URL(bundlePath, infocusp.HOMEPAGE_URL).toString()
  const renderedCareersHtml = careersHtml.replace(
    '</body>',
    '<section id="current-openings">Current Openings Error loading jobs</section></body>',
  )

  const jobs = await infocusp.createInfoCuspInnovationsScraper().run({
    fetchText: async (url) => {
      if (url === infocusp.HOMEPAGE_URL) return homepageHtml
      if (url === infocusp.CAREERS_URL) return careersHtml
      if (url === bundleUrl) return bundleJs
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async () => {
      throw new TypeError('fetch failed | Connect Timeout Error')
    },
    fetchBrowserText: async (url) => {
      if (url === infocusp.CAREERS_URL) return renderedCareersHtml
      throw new Error(`Unexpected browser text URL: ${url}`)
    },
    fetchBrowserJson: async () => {
      throw new Error('Expected JSON from Keka but received an invalid browser payload')
    },
  })

  assert.deepEqual(jobs, [])
})

test('InfoCusp Innovations returns no jobs when Keka serves the verified forbidden shell instead of JSON', async () => {
  const infocusp = await loadModule()
  const homepageHtml = await readFixture('homepage.html')
  const careersHtml = await readFixture('careers-openings.html')
  const bundleJs = await readFixture('current-openings-bundle.js')
  const bundlePath = infocusp.extractCareersBundlePath(careersHtml)
  const bundleUrl = new URL(bundlePath, infocusp.HOMEPAGE_URL).toString()
  const activeJobsUrl = infocusp.buildActiveJobsUrl({
    identifier: infocusp.EXPECTED_IDENTIFIER,
    domain: infocusp.EXPECTED_KEKA_DOMAIN,
    portalName: 'default',
  })

  assert.equal(infocusp.hasVerifiedKekaForbiddenApiSignal(KEKA_FORBIDDEN_HTML), true)

  const jobs = await infocusp.createInfoCuspInnovationsScraper().run({
    fetchText: async (url) => {
      if (url === infocusp.HOMEPAGE_URL) return homepageHtml
      if (url === infocusp.CAREERS_URL) return careersHtml
      if (url === bundleUrl) return bundleJs
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async () => {
      throw new Error(`Forbidden HTML response for ${activeJobsUrl}`)
    },
    fetchBrowserText: async (url) => {
      if (url === activeJobsUrl) return KEKA_FORBIDDEN_HTML
      throw new Error(`Unexpected browser text URL: ${url}`)
    },
    fetchBrowserJson: async () => {
      throw new Error(`Expected JSON from ${activeJobsUrl} but received an invalid API payload`)
    },
  })

  assert.deepEqual(jobs, [])
})
