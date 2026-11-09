import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/paynearby/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/paynearby/catalog.js')
  } catch {
    assert.fail('Expected PayNearby catalog module at ../../scraper/paynearby/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/paynearby/script.js')
  } catch {
    assert.fail('Expected PayNearby scraper module at ../../scraper/paynearby/script.js')
  }
}

test('PayNearby local catalog captures the verified first-party careers page and no-trustworthy-public-jobs contract', async () => {
  const { PAYNEARBY_CATALOG } = await loadCatalogModule()
  const payNearby = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(PAYNEARBY_CATALOG)

  assert.equal(provider.source, 'paynearby')
  assert.equal(provider.companyName, 'PayNearby')
  assert.equal(provider.officialBrandName, 'PayNearby')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://paynearby.in/')
  assert.equal(provider.companyCareerPage, 'https://paynearby.in/careers-learning/')
  assert.equal(provider.officialLinkedInCompanyUrl, 'https://www.linkedin.com/company/paynearby/')
  assert.equal(provider.companyDomain, 'paynearby.in')
  assert.equal(provider.atsPlatform, 'official-company-site-linkedin-company-handoff-no-public-jobs-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-validation-only')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+linkedin-company-profile-handoff-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /paynearby[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/paynearby\.in\/careers-learning\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.linkedin\.com\/company\/paynearby\//i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'PayNearby'), false)

  assert.equal(payNearby.PROVIDER_METADATA.source, PAYNEARBY_CATALOG.source)
  assert.equal(payNearby.PROVIDER_METADATA.companyName, PAYNEARBY_CATALOG.companyName)
  assert.equal(
    payNearby.PROVIDER_METADATA.officialLinkedInCompanyUrl,
    PAYNEARBY_CATALOG.officialLinkedInCompanyUrl,
  )
})

test('PayNearby exact backlog row resolves directly from local provider metadata', async () => {
  const { PAYNEARBY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'PayNearby\n',
    catalog: [hydrateProviderCatalogEntry(PAYNEARBY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PayNearby', 'paynearby', 'PayNearby']],
  )
})

test('getScraperCatalog exposes PayNearby as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'paynearby')
  const scraper = buildScrapers().find((item) => item.name === 'paynearby')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'PayNearby')
  assert.equal(provider.companyCareerPage, 'https://paynearby.in/careers-learning/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'PayNearby'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'PayNearby\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PayNearby', 'paynearby', 'PayNearby']],
  )
})

test('PayNearby hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { PAYNEARBY_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PAYNEARBY_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'PayNearby')
  assert.equal(provider.companyCareerPage, 'https://paynearby.in/careers-learning/')
  assert.equal(provider.companyDomain, 'paynearby.in')
  assert.match(provider.modulePath, /paynearby[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /paynearby[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
