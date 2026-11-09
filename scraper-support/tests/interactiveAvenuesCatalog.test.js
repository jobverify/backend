import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const interactiveAvenuesModulePath = path.resolve(currentDir, '../../scraper/interactiveavenues/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/interactiveavenues/catalog.js')
  } catch {
    assert.fail('Expected Interactive Avenues catalog module at ../../scraper/interactiveavenues/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/interactiveavenues/script.js')
  } catch {
    assert.fail('Expected Interactive Avenues scraper module at ../../scraper/interactiveavenues/script.js')
  }
}

test('Interactive Avenues local catalog captures the verified first-party Mediabrands handoff without alias churn', async () => {
  const { INTERACTIVE_AVENUES_CATALOG } = await loadCatalogModule()
  const interactiveAvenues = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(INTERACTIVE_AVENUES_CATALOG)

  assert.equal(provider.source, 'interactiveavenues')
  assert.equal(provider.companyName, 'Interactive Avenues')
  assert.equal(provider.officialBrandName, 'Interactive Avenues')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.ipgmediabrands.com/posting-greenhouse/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India')
  assert.equal(provider.homepageUrl, 'https://www.interactiveavenues.com/')
  assert.equal(provider.officialCareersLandingUrl, 'https://www.interactiveavenues.com/join-us/index.html')
  assert.equal(provider.officialJobsHubUrl, 'https://careers.ipgmediabrands.com/postings/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India')
  assert.equal(provider.greenhouseJobsBaseUrl, 'https://careers.ipgmediabrands.com/posting-greenhouse/')
  assert.equal(provider.greenhouseBoardEmbedUrl, 'https://boards.greenhouse.io/embed/job_board/js?for=mediabrands')
  assert.equal(provider.atsPlatform, 'greenhouse-first-party-filtered-job-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-first-party-jobs-hub-plus-filtered-greenhouse-listing-plus-public-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-handoff+first-party-jobs-hub+first-party-filtered-greenhouse-job-rows+greenhouse-embedded-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'interactiveavenues.com')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.match(provider.dryRunFile, /interactiveavenues[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.interactiveavenues\.com\/join-us\/index\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.ipgmediabrands\.com\/postings\/\?gh_search=&department=Interactive\+Avenues/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.ipgmediabrands\.com\/posting-greenhouse\/\?gh_search=&department=Interactive\+Avenues/i)
  assert.match(provider.verifiedSurfaceSummary, /Media: Associate Vice President\/Vice President/i)
  assert.match(provider.verifiedSurfaceSummary, /1 public India job/i)
  assert.match(provider.verifiedSurfaceSummary, /Bangalore, Bangalore, India/i)
  assert.match(provider.verifiedSurfaceSummary, /5105985007/i)
  assert.equal(provider.modulePath, interactiveAvenuesModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Interactive Avenues'), false)

  assert.equal(interactiveAvenues.PROVIDER_METADATA.source, INTERACTIVE_AVENUES_CATALOG.source)
  assert.equal(interactiveAvenues.PROVIDER_METADATA.companyName, INTERACTIVE_AVENUES_CATALOG.companyName)
  assert.equal(interactiveAvenues.PROVIDER_METADATA.officialJobsHubUrl, INTERACTIVE_AVENUES_CATALOG.officialJobsHubUrl)
  assert.equal(
    interactiveAvenues.PROVIDER_METADATA.greenhouseBoardEmbedUrl,
    INTERACTIVE_AVENUES_CATALOG.greenhouseBoardEmbedUrl,
  )
})

test('Interactive Avenues backlog row matches directly from the local catalog without alias changes', async () => {
  const { INTERACTIVE_AVENUES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Interactive Avenues\n',
    catalog: [hydrateProviderCatalogEntry(INTERACTIVE_AVENUES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Interactive Avenues', 'interactiveavenues', 'Interactive Avenues']],
  )
})

test('getScraperCatalog includes Interactive Avenues as a verified Greenhouse provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'interactiveavenues')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Interactive Avenues')
  assert.equal(provider.companyCareerPage, 'https://careers.ipgmediabrands.com/posting-greenhouse/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India')
  assert.equal(provider.companyDomain, 'interactiveavenues.com')
  assert.equal(provider.atsPlatform, 'greenhouse-first-party-filtered-job-board')
  assert.match(provider.modulePath, /interactiveavenues[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Interactive Avenues scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'interactiveavenues')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'interactiveavenues')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse-first-party-filtered-job-board')
  assert.match(scraper.dryRunFile, /interactiveavenues[\\/]jobs\.json$/i)
})
