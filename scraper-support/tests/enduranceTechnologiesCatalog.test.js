import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/endurancetechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/endurancetechnologies/catalog.js')
  } catch {
    assert.fail('Expected Endurance Technologies catalog module at ../../scraper/endurancetechnologies/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/endurancetechnologies/script.js')
  } catch {
    assert.fail('Expected Endurance Technologies scraper module at ../../scraper/endurancetechnologies/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Endurance Technologies local catalog captures the verified first-party browser-rendered job portal contract', async () => {
  const { ENDURANCE_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const enduranceTechnologies = await loadScraperModule()
  const provider = buildCatalogReadyProvider(ENDURANCE_TECHNOLOGIES_CATALOG)

  assert.equal(provider.source, 'endurancetechnologies')
  assert.equal(provider.companyName, 'Endurance Technologies')
  assert.equal(provider.officialBrandName, 'Endurance Technologies Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.endurancegroup.com/')
  assert.equal(provider.companyCareerPage, 'https://www.endurancegroup.com/careers/')
  assert.equal(provider.jobPortalUrl, 'https://www.endurancegroup.com/careers/job-portal/')
  assert.deepEqual(provider.verifiedJobUrls, [
    'https://www.endurancegroup.com/career/technical-architect/',
    'https://www.endurancegroup.com/career/technical-lead-hardware/',
    'https://www.endurancegroup.com/career/technical-member-hardware/',
    'https://www.endurancegroup.com/career/technical-lead-software/',
    'https://www.endurancegroup.com/career/technical-member-software/',
    'https://www.endurancegroup.com/career/technical-member-verification-validation/',
  ])
  assert.equal(provider.companyDomain, 'endurancegroup.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-job-portal-page-plus-detail-pages',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-landing-page+browser-rendered-first-party-job-portal+same-domain-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.endurancegroup\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.endurancegroup\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.endurancegroup\.com\/careers\/job-portal\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.endurancegroup\.com\/career\/technical-architect\//i)
  assert.match(provider.verifiedSurfaceSummary, /\b6 public openings\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\b403\b/i)
  assert.match(provider.verifiedSurfaceSummary, /Just a moment/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /endurancetechnologies[\\/]jobs\.json$/i)

  assert.equal(enduranceTechnologies.PROVIDER_METADATA.source, provider.source)
  assert.equal(enduranceTechnologies.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(enduranceTechnologies.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(enduranceTechnologies.PROVIDER_METADATA.jobPortalUrl, provider.jobPortalUrl)
})

test('Endurance Technologies exact backlog row matches from the local provider contract without aliases', async () => {
  const { ENDURANCE_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Endurance Technologies\n',
    catalog: [buildCatalogReadyProvider(ENDURANCE_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Endurance Technologies', 'endurancetechnologies', 'Endurance Technologies']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Endurance Technologies'), false)
})
