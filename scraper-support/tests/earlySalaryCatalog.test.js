import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/earlysalary/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/earlysalary/catalog.js')
  } catch {
    assert.fail('Expected EarlySalary catalog module at ../../scraper/earlysalary/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/earlysalary/script.js')
  } catch {
    assert.fail('Expected EarlySalary scraper module at ../../scraper/earlysalary/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('EarlySalary local catalog captures the verified first-party Fibe redirect and empty careers surface', async () => {
  const { EARLYSALARY_CATALOG } = await loadCatalogModule()
  const earlySalary = await loadScraperModule()
  const provider = buildCatalogReadyProvider(EARLYSALARY_CATALOG)

  assert.equal(provider.source, 'earlysalary')
  assert.equal(provider.companyName, 'EarlySalary')
  assert.equal(provider.officialBrandName, 'Fibe')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.earlysalary.com/')
  assert.equal(provider.redirectedHomepageUrl, 'https://www.fibe.in/')
  assert.equal(provider.companyCareerPage, 'https://www.fibe.in/careers/')
  assert.equal(provider.legacyCareersUrl, 'https://www.earlysalary.com/careers/')
  assert.equal(provider.checkedJobsRouteUrl, 'https://www.fibe.in/jobs')
  assert.equal(provider.companyDomain, 'fibe.in')
  assert.equal(provider.atsPlatform, 'official-company-careers-empty-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'legacy-domain-redirect-plus-first-party-empty-careers-page-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-earlysalary-to-fibe-redirect+verified-fibe-homepage-careers-link+verified-empty-fibe-careers-page-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.earlysalary\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.fibe\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.fibe\.in\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.fibe\.in\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /No Jobs found/i)
  assert.match(provider.verifiedSurfaceSummary, /currentjobopeningsdepts:null/i)
  assert.match(provider.verifiedSurfaceSummary, /404/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /earlysalary[\\/]jobs\.json$/i)

  assert.equal(earlySalary.PROVIDER_METADATA.source, provider.source)
  assert.equal(earlySalary.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(earlySalary.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(earlySalary.PROVIDER_METADATA.redirectedHomepageUrl, provider.redirectedHomepageUrl)
})

test('EarlySalary exact backlog row matches from the local provider contract without aliases', async () => {
  const { EARLYSALARY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'EarlySalary\n',
    catalog: [buildCatalogReadyProvider(EARLYSALARY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['EarlySalary', 'earlysalary', 'EarlySalary']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'EarlySalary'), false)
})
