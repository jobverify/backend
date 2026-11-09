import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/pratiantechnologies/script.js')

const CAREERS_SHELL_FIXTURE = `
  <title>Pratian</title>
  <app-root></app-root>
  <script src="runtime.9b2896331a6ccdca.js" type="module"></script>
  <script src="polyfills.11b9033b4cdabbd0.js" type="module"></script>
  <script src="main.d7ac0e33a2b8f83f.js" type="module"></script>
`

const CAREER_BUNDLE_FIXTURE = `
  const YP=[{path:"career",component:UP}];
  g(187," Career ");
  g(189,"At Pratian, it is all about you.");
  g(193," nurture ");
  g(198," challenge ");
  g(203," celebrate ");
  g(208," trust ");
  g(211,"view more");
`

const BUNDLE_WITH_PUBLIC_JOBS_FIXTURE = `
  <h2>Current Openings</h2>
  <a href="/jobs/data-engineer">Apply Now</a>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pratiantechnologies/catalog.js')
  } catch {
    assert.fail('Expected Pratian Technologies catalog module at ../../scraper/pratiantechnologies/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/pratiantechnologies/script.js')
  } catch {
    assert.fail('Expected Pratian Technologies scraper module at ../../scraper/pratiantechnologies/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Pratian Technologies local catalog captures the verified careers shell without a trustworthy public jobs board', async () => {
  const { PRATIAN_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(PRATIAN_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, PRATIAN_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'pratiantechnologies')
  assert.equal(provider.companyName, 'Pratian Technologies')
  assert.equal(provider.officialBrandName, 'Pratian')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.pratian.com/')
  assert.equal(provider.companyCareerPage, 'https://www.pratian.com/career')
  assert.equal(provider.companyDomain, 'pratian.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-shell-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'angular-shell-plus-bundle-check')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-angular-shell+verified-career-bundle-without-public-job-listings+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.pratian\.com\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /CERT_HAS_EXPIRED/i)
  assert.match(provider.verifiedSurfaceSummary, /main\.d7ac0e33a2b8f83f\.js/i)
  assert.match(provider.verifiedSurfaceSummary, /At Pratian, it is all about you/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /pratiantechnologies[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Pratian Technologies\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Pratian Technologies scraper stays fail-closed when the verified career shell still lacks public role listings', async () => {
  const pratian = await loadScriptModule()
  const scraper = pratian.createPratianTechnologiesScraper()

  assert.equal(pratian.hasOfficialCareersShellSignal(CAREERS_SHELL_FIXTURE), true)
  assert.equal(pratian.extractBundlePath(CAREERS_SHELL_FIXTURE), 'https://www.pratian.com/main.d7ac0e33a2b8f83f.js')
  assert.equal(pratian.bundleHasExpectedCareerMessaging(CAREER_BUNDLE_FIXTURE), true)
  assert.equal(pratian.bundleExposesStructuredJobListings(CAREER_BUNDLE_FIXTURE), false)
  assert.equal(pratian.bundleExposesStructuredJobListings(BUNDLE_WITH_PUBLIC_JOBS_FIXTURE), true)

  const jobs = await scraper.run({
    fetchText: async (url) => {
      if (url === pratian.CAREERS_URL) return CAREERS_SHELL_FIXTURE
      if (url === 'https://www.pratian.com/main.d7ac0e33a2b8f83f.js') return CAREER_BUNDLE_FIXTURE
      assert.fail(`Unexpected URL requested by Pratian scraper: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
