import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/jaidka/catalog.js')
  } catch {
    assert.fail('Expected Jaidka catalog module at ../../scraper/jaidka/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/jaidka/script.js')
  } catch {
    assert.fail('Expected Jaidka scraper module at ../../scraper/jaidka/script.js')
  }
}

test('Jaidka local catalog captures the verified no-public-jobs sentinel contract', async () => {
  const { JAIDKA_CATALOG } = await loadCatalogModule()
  const jaidka = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(JAIDKA_CATALOG)

  assert.equal(JAIDKA_CATALOG.source, 'jaidka')
  assert.equal(JAIDKA_CATALOG.companyName, 'Jaidka')
  assert.equal(JAIDKA_CATALOG.officialBrandName, 'Jaidka Power Systems Pvt. Ltd.')
  assert.equal(JAIDKA_CATALOG.adapter, 'script')
  assert.equal(JAIDKA_CATALOG.modulePath, '../../scraper/jaidka/script.js')
  assert.equal(JAIDKA_CATALOG.dryRunFile, 'jaidka/jobs.json')
  assert.equal(JAIDKA_CATALOG.homepageUrl, 'https://jaidka.in/')
  assert.equal(JAIDKA_CATALOG.companyCareerPage, 'https://jaidka.in/')
  assert.equal(JAIDKA_CATALOG.aboutPageUrl, 'https://jaidka.in/About_Company')
  assert.equal(JAIDKA_CATALOG.teamPageUrl, 'https://jaidka.in/Team')
  assert.equal(JAIDKA_CATALOG.companyDomain, 'jaidka.in')
  assert.equal(JAIDKA_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(JAIDKA_CATALOG.countryFilter, 'India')
  assert.equal(
    JAIDKA_CATALOG.paginationStrategy,
    'verified-homepage-plus-about-plus-team-route-validation',
  )
  assert.equal(
    JAIDKA_CATALOG.extractionStrategy,
    'verified-homepage+verified-about-page+verified-team-page-without-public-jobs-return-empty',
  )
  assert.equal(JAIDKA_CATALOG.parser, 'custom-script')
  assert.equal(JAIDKA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(JAIDKA_CATALOG.verifiedOn, '2026-07-16')
  assert.match(JAIDKA_CATALOG.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(JAIDKA_CATALOG.verifiedSurfaceSummary, /https:\/\/jaidka\.in\//i)
  assert.match(JAIDKA_CATALOG.verifiedSurfaceSummary, /About_Company/i)
  assert.match(JAIDKA_CATALOG.verifiedSurfaceSummary, /Team/i)
  assert.match(JAIDKA_CATALOG.verifiedSurfaceSummary, /no trustworthy public job listings/i)

  assert.equal(provider.source, 'jaidka')
  assert.equal(provider.companyName, 'Jaidka')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://jaidka.in/')
  assert.equal(provider.companyDomain, 'jaidka.in')
  assert.match(provider.modulePath, /jaidka[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /jaidka[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Jaidka'), false)

  assert.equal(jaidka.PROVIDER_METADATA.source, provider.source)
  assert.equal(jaidka.HOMEPAGE_URL, provider.homepageUrl)
  assert.equal(jaidka.ABOUT_PAGE_URL, provider.aboutPageUrl)
  assert.equal(jaidka.TEAM_PAGE_URL, provider.teamPageUrl)
})

test('Jaidka exact-name backlog rows resolve directly from local metadata without a shared alias', async () => {
  const { JAIDKA_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Jaidka\n',
    catalog: [hydrateProviderCatalogEntry(JAIDKA_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Jaidka', 'jaidka', 'Jaidka']],
  )
})

test('getScraperCatalog includes Jaidka as a verified no-public-careers sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'jaidka')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Jaidka')
  assert.equal(provider.companyCareerPage, 'https://jaidka.in/')
  assert.equal(provider.companyDomain, 'jaidka.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /jaidka[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Jaidka scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'jaidka')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'jaidka')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /jaidka[\\/]jobs\.json$/i)
})
