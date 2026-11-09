import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const goibiboModulePath = path.resolve(currentDir, '../../scraper/goibibo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/goibibo/catalog.js')
  } catch {
    assert.fail('Expected Goibibo catalog module at ../../scraper/goibibo/catalog.js')
  }
}

const loadGoibiboModule = async () => {
  try {
    return await import('../../scraper/goibibo/script.js')
  } catch {
    assert.fail('Expected Goibibo scraper module at ../../scraper/goibibo/script.js')
  }
}

test('Goibibo local catalog captures the verified broken first-party careers handoff', async () => {
  const { GOIBIBO_CATALOG } = await loadCatalogModule()
  const goibibo = await loadGoibiboModule()

  assert.deepEqual(GOIBIBO_CATALOG, {
    source: 'goibibo',
    companyName: 'Goibibo',
    companyCareerPage: 'https://www.goibibo.com/careers/',
    companyDomain: 'goibibo.com',
    adapter: 'script',
    atsPlatform: 'official-company-careers-unavailable',
    countryFilter: 'India',
    paginationStrategy: 'homepage-careers-link-validation',
    extractionStrategy: 'verified-homepage+broken-careers-handoff-return-empty',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    modulePath: goibiboModulePath,
    verifiedOn: '2026-08-07',
    verifiedSurfaceSummary: 'Verified on Friday, August 7, 2026 that the official Goibibo homepage still links job seekers to https://www.goibibo.com/careers/, but that first-party route currently resolves only to an unavailable surface from this environment, observed as 404/503/504-style failures or request timeouts rather than a trustworthy public jobs listing page.',
    homepageUrl: 'https://www.goibibo.com/',
    acceptedCareerPageStatuses: [404, 503, 504],
  })

  assert.equal(goibibo.PROVIDER_METADATA.source, GOIBIBO_CATALOG.source)
  assert.equal(goibibo.PROVIDER_METADATA.companyName, GOIBIBO_CATALOG.companyName)
  assert.equal(goibibo.PROVIDER_METADATA.companyCareerPage, GOIBIBO_CATALOG.companyCareerPage)
  assert.deepEqual(
    goibibo.PROVIDER_METADATA.acceptedCareerPageStatuses,
    GOIBIBO_CATALOG.acceptedCareerPageStatuses,
  )
})

test('Goibibo exact backlog row resolves directly from the local provider metadata without aliases', async () => {
  const { GOIBIBO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Goibibo\n',
    catalog: [GOIBIBO_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Goibibo', 'goibibo', 'Goibibo']],
  )
})

test('getScraperCatalog includes Goibibo as a verified unavailable-careers sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'goibibo')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Goibibo')
  assert.equal(provider.companyCareerPage, 'https://www.goibibo.com/careers/')
  assert.equal(provider.companyDomain, 'goibibo.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-unavailable')
  assert.match(provider.modulePath, /goibibo[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Goibibo scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'goibibo')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'goibibo')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers-unavailable')
  assert.match(scraper.dryRunFile, /goibibo[\\/]jobs\.json$/i)
})

test('Goibibo default page fetches are bounded while validating the unavailable careers handoff', async () => {
  const goibibo = await loadGoibiboModule()
  const originalFetch = globalThis.fetch
  const requests = []
  const homepageHtml = `
    <!doctype html>
    <html>
      <head><title>goibibo - Best Travel Website</title></head>
      <body>
        <p>Book hotels, flights, trains, bus and cabs</p>
        <a href="https://www.goibibo.com/careers/">Careers</a>
      </body>
    </html>
  `

  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), signal: init.signal })

    if (url === goibibo.HOMEPAGE_URL) {
      return { status: 200, url, text: async () => homepageHtml }
    }
    if (url === goibibo.CAREER_URL) {
      return { status: 404, url, text: async () => '<html><body>Not found</body></html>' }
    }

    assert.fail(`Unexpected Goibibo URL: ${url}`)
  }

  try {
    const jobs = await goibibo.createGoibiboScraper().run()

    assert.deepEqual(jobs, [])
    assert.ok(requests.every((request) => request.signal), 'each fetch should include an abort signal')
    assert.ok(requests.every((request) => typeof request.signal.aborted === 'boolean'))
  } finally {
    globalThis.fetch = originalFetch
  }
})
