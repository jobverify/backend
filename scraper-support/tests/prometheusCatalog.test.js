import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const prometheusModulePath = path.resolve(currentDir, '../../scraper/prometheus/script.js')

const HOMEPAGE_FIXTURE = `
  <title>Prometheus - Monitoring system & time series database</title>
  <h1>Open source metrics and monitoring for your systems and services</h1>
  <p>Prometheus is 100% open source and community-driven.</p>
  <p>Prometheus is a Cloud Native Computing Foundation graduated project.</p>
`

const OVERVIEW_FIXTURE = `
  <h1>Overview</h1>
  <p>Prometheus is now a standalone open source project and maintained independently of any company.</p>
  <p>To emphasize this, Prometheus joined the Cloud Native Computing Foundation in 2016.</p>
`

const GOVERNANCE_FIXTURE = `
  <h1>Prometheus Governance</h1>
  <p>The Prometheus Steering Committee is the governing body of the Prometheus project.</p>
  <p>Seats on the Steering Committee are held by individuals, not by or through their respective employers.</p>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/prometheus/catalog.js')
  } catch {
    assert.fail('Expected Prometheus catalog module at ../../scraper/prometheus/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/prometheus/script.js')
  } catch {
    assert.fail('Expected Prometheus scraper module at ../../scraper/prometheus/script.js')
  }
}

test('Prometheus local catalog captures the verified independent open-source no-company-careers contract', async () => {
  const { PROMETHEUS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const prometheus = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(PROMETHEUS_CATALOG)

  assert.equal(defaultCatalog, PROMETHEUS_CATALOG)
  assert.equal(provider.source, 'prometheus')
  assert.equal(provider.companyName, 'Prometheus')
  assert.equal(provider.officialBrandName, 'Prometheus')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://prometheus.io/')
  assert.equal(provider.companyCareerPage, null)
  assert.equal(provider.overviewUrl, 'https://prometheus.io/docs/introduction/overview/')
  assert.equal(provider.governanceUrl, 'https://prometheus.io/governance/')
  assert.equal(provider.companyDomain, 'prometheus.io')
  assert.equal(provider.atsPlatform, 'open-source-project-no-company-careers')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-overview-plus-governance-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-independent-project-overview+verified-open-governance+return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.modulePath, /prometheus[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /prometheus[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/prometheus\.io\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/prometheus\.io\/docs\/introduction\/overview\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/prometheus\.io\/governance\//i)
  assert.match(provider.verifiedSurfaceSummary, /open source and community-driven/i)
  assert.match(provider.verifiedSurfaceSummary, /maintained independently of any company/i)
  assert.match(provider.verifiedSurfaceSummary, /held by individuals rather than by employers/i)
  assert.equal(provider.modulePath, prometheusModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Prometheus'), false)

  assert.equal(prometheus.PROVIDER_METADATA.source, PROMETHEUS_CATALOG.source)
  assert.equal(prometheus.PROVIDER_METADATA.companyName, PROMETHEUS_CATALOG.companyName)
  assert.equal(prometheus.PROVIDER_METADATA.governanceUrl, PROMETHEUS_CATALOG.governanceUrl)
})

test('Prometheus backlog row matches directly from the local catalog without alias changes', async () => {
  const { PROMETHEUS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nPrometheus\n',
    catalog: [hydrateProviderCatalogEntry(PROMETHEUS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Prometheus', 'prometheus', 'Prometheus']],
  )
})

test('Prometheus scraper helpers stay pinned to the verified official project and governance signals', async () => {
  const prometheus = await loadScriptModule()

  assert.equal(prometheus.hasOfficialHomepageSignal(HOMEPAGE_FIXTURE), true)
  assert.equal(prometheus.hasIndependentProjectOverviewSignal(OVERVIEW_FIXTURE), true)
  assert.equal(prometheus.hasOpenGovernanceSignal(GOVERNANCE_FIXTURE), true)
})

test('Prometheus run returns [] while the official project stays independent and has no company careers surface', async () => {
  const prometheus = await loadScriptModule()
  const requestedUrls = []

  const jobs = await prometheus.createPrometheusScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === prometheus.HOMEPAGE_URL) return HOMEPAGE_FIXTURE
      if (url === prometheus.OVERVIEW_URL) return OVERVIEW_FIXTURE
      if (url === prometheus.GOVERNANCE_URL) return GOVERNANCE_FIXTURE

      assert.fail(`Unexpected URL requested by Prometheus scraper: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    prometheus.HOMEPAGE_URL,
    prometheus.OVERVIEW_URL,
    prometheus.GOVERNANCE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Prometheus fails closed when the homepage, overview, or governance independence signals drift', async () => {
  const prometheus = await loadScriptModule()

  await assert.rejects(
    prometheus.createPrometheusScraper().run({
      fetchText: async (url) => {
        if (url === prometheus.HOMEPAGE_URL) return '<html><body>Unexpected</body></html>'
        if (url === prometheus.OVERVIEW_URL) return OVERVIEW_FIXTURE
        return GOVERNANCE_FIXTURE
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    prometheus.createPrometheusScraper().run({
      fetchText: async (url) => {
        if (url === prometheus.HOMEPAGE_URL) return HOMEPAGE_FIXTURE
        if (url === prometheus.OVERVIEW_URL) return '<html><body>Unexpected</body></html>'
        return GOVERNANCE_FIXTURE
      },
    }),
    /overview/i,
  )

  await assert.rejects(
    prometheus.createPrometheusScraper().run({
      fetchText: async (url) => {
        if (url === prometheus.HOMEPAGE_URL) return HOMEPAGE_FIXTURE
        if (url === prometheus.OVERVIEW_URL) return OVERVIEW_FIXTURE
        return '<html><body>Unexpected</body></html>'
      },
    }),
    /governance/i,
  )
})

test('buildScrapers exposes a runnable Prometheus scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'prometheus')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'prometheus')
  assert.equal(scraper.provider.atsPlatform, 'open-source-project-no-company-careers')
  assert.match(scraper.dryRunFile, /prometheus[\\/]jobs\.json$/i)
})
