import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const citiusModulePath = path.resolve(currentDir, '../../scraper/citius/script.js')

const loadCitiusCatalog = async () => {
  try {
    return await import('../../scraper/citius/catalog.js')
  } catch {
    assert.fail('Expected Citius catalog module at ../../scraper/citius/catalog.js')
  }
}

test('Citius catalog captures the verified first-party CitiusTech careers handoff surface', async () => {
  const { CITIUS_CATALOG } = await loadCitiusCatalog()
  const provider = hydrateProviderCatalogEntry(CITIUS_CATALOG)

  assert.equal(provider.source, 'citius')
  assert.equal(provider.companyName, 'Citius')
  assert.equal(provider.officialBrandName, 'CitiusTech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.citiustech.com/careers')
  assert.equal(provider.homepageUrl, 'https://www.citiustech.com/')
  assert.equal(provider.portalOrigin, 'https://citiustech.ripplehire.com')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE#list',
  )
  assert.equal(
    provider.jobBoardUrl,
    'https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE',
  )
  assert.equal(
    provider.jobsApiUrl,
    'https://citiustech.ripplehire.com/candidate/candidatejobsearch',
  )
  assert.equal(provider.companyDomain, 'citiustech.com')
  assert.equal(provider.atsPlatform, 'ripplehire')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'page-param-on-public-ripplehire-board')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+ripplehire-list-detail-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, citiusModulePath)
  assert.match(provider.dryRunFile, /citius[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.citiustech\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.citiustech\.com\/careers/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/citiustech\.ripplehire\.com\/candidate\/\?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE#list/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/citiustech\.ripplehire\.com\/candidate\/\?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/citiustech\.ripplehire\.com\/candidate\/candidatejobsearch/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b73\b/)
})

test('Citius backlog row matches directly from provider metadata without a shared alias entry', async () => {
  const { CITIUS_CATALOG } = await loadCitiusCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Citius\n',
    catalog: [hydrateProviderCatalogEntry(CITIUS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Citius', 'citius', 'Citius']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Citius'), false)
})
