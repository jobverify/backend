import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/satsure/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/satsure/catalog.js')
  } catch {
    assert.fail('Expected SatSure catalog module at ../../scraper/satsure/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/satsure/script.js')
  } catch {
    assert.fail('Expected SatSure scraper module at ../../scraper/satsure/script.js')
  }
}

test('SatSure local catalog captures the verified first-party careers handoff and public Keka feed', async () => {
  const { SATSURE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const satSure = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SATSURE_CATALOG)

  assert.equal(defaultCatalog, SATSURE_CATALOG)
  assert.equal(provider.source, 'satsure')
  assert.equal(provider.companyName, 'SatSure')
  assert.equal(provider.officialBrandName, 'SatSure Analytics India Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.satsure.co/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.satsure.co/careers/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://satsure.keka.com/careers')
  assert.equal(provider.jobsBoardUrl, 'https://satsure.keka.com/careers')
  assert.equal(
    provider.careerPortalInfoUrl,
    'https://satsure.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    provider.activeJobsUrl,
    'https://satsure.keka.com/careers/api/embedjobs/default/active/350ad025-b87c-4c10-940f-8f95377d5133',
  )
  assert.equal(provider.verifiedSampleJobUrl, 'https://satsure.keka.com/careers/jobdetails/153475')
  assert.equal(provider.companyDomain, 'satsure.co')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'first-party-careers-page-handoff-plus-single-keka-active-jobs-endpoint',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-keka-handoff+embedded-khConfig+careerportalinfo+active-keka-embed-api+jobdetails+applyjob',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.dryRunFile, /satsure[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.satsure\.co\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/satsure\.keka\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /25 live public openings/i)
  assert.match(provider.verifiedSurfaceSummary, /Machine Learning Engineer - 2/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SatSure'), false)

  assert.equal(satSure.PROVIDER_METADATA.source, SATSURE_CATALOG.source)
  assert.equal(satSure.PROVIDER_METADATA.companyName, SATSURE_CATALOG.companyName)
})

test('SatSure exact backlog row matches directly from local provider metadata', async () => {
  const { SATSURE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SatSure\n',
    catalog: [hydrateProviderCatalogEntry(SATSURE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SatSure', 'satsure', 'SatSure']],
  )
})

test('SatSure hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SATSURE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SATSURE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SatSure')
  assert.equal(provider.companyCareerPage, 'https://www.satsure.co/careers/')
  assert.equal(provider.jobsBoardUrl, 'https://satsure.keka.com/careers')
  assert.equal(provider.companyDomain, 'satsure.co')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.match(provider.modulePath, /satsure[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /satsure[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
