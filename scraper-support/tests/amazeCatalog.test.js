import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const amazeModulePath = path.resolve(currentDir, '../../scraper/amaze/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/amaze/catalog.js')
  } catch {
    assert.fail('Expected Amaze catalog module at ../../scraper/amaze/catalog.js')
  }
}

const loadAmazeModule = async () => {
  try {
    return await import('../../scraper/amaze/script.js')
  } catch {
    assert.fail('Expected Amaze scraper module at ../../scraper/amaze/script.js')
  }
}

test('Amaze local catalog captures the verified official site pages plus the dead public careers handoff sentinel state', async () => {
  const { AMAZE_CATALOG } = await loadCatalogModule()
  const amaze = await loadAmazeModule()

  assert.equal(AMAZE_CATALOG.source, 'amaze')
  assert.equal(AMAZE_CATALOG.companyName, 'Amaze')
  assert.equal(AMAZE_CATALOG.officialBrandName, 'Amaze')
  assert.equal(AMAZE_CATALOG.adapter, 'script')
  assert.equal(AMAZE_CATALOG.companyCareerPage, 'https://www.amaze.co/')
  assert.equal(AMAZE_CATALOG.companyDomain, 'amaze.co')
  assert.equal(AMAZE_CATALOG.aboutPageUrl, 'https://www.amaze.co/about-us')
  assert.equal(AMAZE_CATALOG.contactPageUrl, 'https://www.amaze.co/contact')
  assert.equal(AMAZE_CATALOG.brokenCareersHandoffUrl, 'https://jobs.lever.co/amaze')
  assert.equal(AMAZE_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(AMAZE_CATALOG.countryFilter, 'India')
  assert.equal(
    AMAZE_CATALOG.paginationStrategy,
    'verified-homepage-plus-supporting-pages-plus-broken-careers-handoff-route-validation',
  )
  assert.equal(
    AMAZE_CATALOG.extractionStrategy,
    'verified-homepage+verified-about-and-contact-pages+dead-footer-careers-link+404-first-party-careers-routes-return-empty',
  )
  assert.equal(AMAZE_CATALOG.parser, 'custom-script')
  assert.equal(AMAZE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AMAZE_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(AMAZE_CATALOG.dryRunFile, 'amaze/jobs.json')
  assert.match(AMAZE_CATALOG.verifiedSurfaceSummary, /https:\/\/amaze\.co\//i)
  assert.match(AMAZE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.amaze\.co\/about-us/i)
  assert.match(AMAZE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.amaze\.co\/contact/i)
  assert.match(AMAZE_CATALOG.verifiedSurfaceSummary, /https:\/\/jobs\.lever\.co\/amaze/i)
  assert.match(AMAZE_CATALOG.verifiedSurfaceSummary, /404/i)
  assert.match(AMAZE_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(AMAZE_CATALOG.modulePath, amazeModulePath)

  assert.equal(amaze.PROVIDER_METADATA.source, AMAZE_CATALOG.source)
  assert.equal(amaze.PROVIDER_METADATA.companyName, AMAZE_CATALOG.companyName)
  assert.equal(
    amaze.PROVIDER_METADATA.brokenCareersHandoffUrl,
    AMAZE_CATALOG.brokenCareersHandoffUrl,
  )
})

test('Amaze local catalog hydrates into coverage without needing a shared alias entry', async () => {
  const { AMAZE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(AMAZE_CATALOG)

  assert.equal(provider.companyName, 'Amaze')
  assert.equal(provider.companyDomain, 'amaze.co')
  assert.match(provider.modulePath, /amaze[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /amaze[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Amaze\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amaze', 'amaze', 'Amaze']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Amaze'), false)
})

test('buildScrapers and company coverage resolve Amaze from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'amaze')
  const scraper = buildScrapers().find((item) => item.name === 'amaze')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Amaze')
  assert.equal(provider.companyCareerPage, 'https://www.amaze.co/')
  assert.match(scraper.dryRunFile, /amaze[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Amaze\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amaze', 'amaze', 'Amaze']],
  )
})
