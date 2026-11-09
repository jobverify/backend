import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/techfirefly/script.js')

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Tech Firefly</title>
    <link rel="canonical" href="https://www.techfirefly.com/careers/" />
  </head>
  <body>
    <h1>Careers At Techfirefly</h1>
    <p>[my_elementor_caree]</p>
    <h2>Apply now for success</h2>
    <form>
      <label>Name</label>
      <label>Email</label>
      <label>Phone</label>
      <label>Education</label>
      <label>Experience</label>
      <label>Resume</label>
      <button>Submit</button>
    </form>
    <footer>Copyright (c) 2026 Tech Firefly, All rights reserved.</footer>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Tech Firefly</title>
  </head>
  <body>
    <h1>Careers At Techfirefly</h1>
    <article class="job-card">
      <h2>Localization Program Manager</h2>
      <a href="https://www.techfirefly.com/careers/localization-program-manager">Apply now</a>
    </article>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/techfirefly/catalog.js')
  } catch {
    assert.fail('Expected Tech Firefly catalog module at ../../scraper/techfirefly/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/techfirefly/script.js')
  } catch {
    assert.fail('Expected Tech Firefly scraper module at ../../scraper/techfirefly/script.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Tech Firefly local catalog captures the verified placeholder-only first-party careers surface', async () => {
  const { TECH_FIREFLY_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const techFirefly = await loadScriptModule()
  const provider = buildProvider(TECH_FIREFLY_CATALOG)

  assert.equal(defaultCatalog, TECH_FIREFLY_CATALOG)
  assert.equal(provider.source, 'techfirefly')
  assert.equal(provider.companyName, 'Tech Firefly')
  assert.equal(provider.officialBrandName, 'Tech Firefly')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.techfirefly.com/')
  assert.equal(provider.companyCareerPage, 'https://www.techfirefly.com/careers/')
  assert.equal(provider.companyDomain, 'techfirefly.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-placeholder-shortcode')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-page-placeholder-shortcode-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+verified-placeholder-shortcode-resume-form-without-public-listings+return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /\[my_elementor_caree\]/i)
  assert.match(provider.verifiedSurfaceSummary, /Apply now for success/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /techfirefly[\\/]jobs\.json$/i)

  assert.equal(techFirefly.PROVIDER_METADATA.source, provider.source)
  assert.equal(techFirefly.CAREERS_URL, provider.companyCareerPage)
})

test('Tech Firefly exact backlog row resolves from the local fail-closed catalog', async () => {
  const { TECH_FIREFLY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Tech Firefly\n',
    catalog: [buildProvider(TECH_FIREFLY_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Tech Firefly sentinel returns [] only while the verified careers page stays placeholder-only', async () => {
  const techFirefly = await loadScriptModule()
  const requestedUrls = []

  const jobs = await techFirefly.createTechFireflyScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === techFirefly.CAREERS_URL) return CAREERS_HTML
      throw new Error(`Unexpected Tech Firefly URL: ${url}`)
    },
  })

  assert.equal(techFirefly.hasOfficialCareersShellSignal(CAREERS_HTML), true)
  assert.equal(techFirefly.hasPublicJobsSignal(CAREERS_HTML), false)
  assert.deepEqual(requestedUrls, [techFirefly.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Tech Firefly sentinel fails closed when the placeholder surface drifts into public jobs', async () => {
  const techFirefly = await loadScriptModule()

  await assert.rejects(
    techFirefly.createTechFireflyScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected shell</h1></body></html>',
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    techFirefly.createTechFireflyScraper().run({
      fetchText: async () => PUBLIC_JOBS_HTML,
    }),
    /surface now appears to expose public jobs/i,
  )
})

test('Tech Firefly returns [] when the verified careers page times out in the current runtime', async () => {
  const techFirefly = await loadScriptModule()

  const jobs = await techFirefly.createTechFireflyScraper().run({
    fetchText: async () => {
      const error = new TypeError('fetch failed')
      error.cause = {
        code: 'UND_ERR_CONNECT_TIMEOUT',
        message: 'Connect Timeout Error (attempted address: www.techfirefly.com:443, timeout: 10000ms)',
      }
      throw error
    },
  })

  assert.deepEqual(jobs, [])
})

test('Tech Firefly returns [] when the verified careers host times out', async () => {
  const techFirefly = await loadScriptModule()

  const jobs = await techFirefly.createTechFireflyScraper().run({
    fetchText: async () => {
      throw new Error(`Connect Timeout Error for ${techFirefly.CAREERS_URL}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Tech Firefly default fetch stops after a single connect-timeout pass', async () => {
  const techFirefly = await loadScriptModule()
  const originalFetch = globalThis.fetch
  const fetchCalls = []

  globalThis.fetch = async (url) => {
    fetchCalls.push(String(url))
    throw new Error(`Connect Timeout Error for ${url}`)
  }

  try {
    const jobs = await techFirefly.createTechFireflyScraper().run()

    assert.deepEqual(jobs, [])
    assert.deepEqual(fetchCalls, [techFirefly.CAREERS_URL])
  } finally {
    globalThis.fetch = originalFetch
  }
})
