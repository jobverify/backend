import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const neysaModulePath = path.resolve(currentDir, '../../scraper/neysa/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/neysa/catalog.js')
  } catch {
    assert.fail('Expected Neysa catalog module at ../../scraper/neysa/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/neysa/script.js')
  } catch {
    assert.fail('Expected Neysa scraper module at ../../scraper/neysa/script.js')
  }
}

test('Neysa local catalog captures the verified same-domain public job openings surface', async () => {
  const { NEYSA_CATALOG } = await loadCatalogModule()
  const neysa = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(NEYSA_CATALOG)

  assert.equal(provider.source, 'neysa')
  assert.equal(provider.companyName, 'Neysa')
  assert.equal(provider.officialBrandName, 'Neysa')
  assert.equal(provider.legalEntityName, 'Neysa Networks Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://neysa.ai/')
  assert.equal(provider.companyCareerPage, 'https://neysa.ai/careers/')
  assert.equal(provider.companyDomain, 'neysa.ai')
  assert.equal(provider.officialJobOpeningsUrl, 'https://neysa.ai/careers/job-openings/')
  assert.equal(provider.officialAboutUrl, 'https://neysa.ai/about-us/')
  assert.equal(provider.officialPrivacyUrl, 'https://neysa.ai/privacy-policy/')
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://neysa.ai/careers/job-openings/?job_id=51964',
  )
  assert.equal(provider.verifiedPublicJobCount, 8)
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-careers-page-plus-same-domain-job-openings-page',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-same-domain-job-openings-page+detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.dryRunFile, /neysa[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, neysaModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/neysa\.ai\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/neysa\.ai\/careers\/job-openings\//i)
  assert.match(provider.verifiedSurfaceSummary, /8 public jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /\?job_id=51964/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Neysa'), false)
  assert.equal(companyAliases['Neysa Networks'], 'neysa')
  assert.equal(companyAliases['Neysa Networks Private Limited'], 'neysa')

  assert.equal(neysa.PROVIDER_METADATA.source, NEYSA_CATALOG.source)
  assert.equal(neysa.PROVIDER_METADATA.companyName, NEYSA_CATALOG.companyName)
  assert.equal(
    neysa.PROVIDER_METADATA.officialJobOpeningsUrl,
    NEYSA_CATALOG.officialJobOpeningsUrl,
  )
})

test('Neysa backlog row matches directly from the local catalog without alias churn', async () => {
  const { NEYSA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Neysa\n',
    catalog: [hydrateProviderCatalogEntry(NEYSA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Neysa', 'neysa', 'Neysa']],
  )
})

test('getScraperCatalog and shared aliases resolve Neysa and Neysa Networks to the same runnable provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'neysa')
  const scraper = buildScrapers().find((item) => item.name === 'neysa')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Neysa')
  assert.equal(provider.companyCareerPage, 'https://neysa.ai/careers/')
  assert.equal(companyAliases['Neysa Networks'], 'neysa')
  assert.equal(companyAliases['Neysa Networks Private Limited'], 'neysa')

  const report = generateCompanyCoverageReport({
    csvText: 'Neysa\nNeysa Networks\nNeysa Networks Private Limited\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 3)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Neysa', 'neysa', 'Neysa'],
      ['Neysa Networks', 'neysa', 'Neysa'],
      ['Neysa Networks Private Limited', 'neysa', 'Neysa'],
    ],
  )
})
