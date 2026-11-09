import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/nference/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nference/catalog.js')
  } catch {
    assert.fail('Expected Nference catalog module at ../../scraper/nference/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/nference/script.js')
  } catch {
    assert.fail('Expected Nference scraper module at ../../scraper/nference/script.js')
  }
}

test('Nference local catalog captures the verified first-party careers page and Keka jobs contract', async () => {
  const { NFERENCE_CATALOG } = await loadCatalogModule()
  const nference = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(NFERENCE_CATALOG)

  assert.equal(provider.source, 'nference')
  assert.equal(provider.companyName, 'Nference')
  assert.equal(provider.officialBrandName, 'nference')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://nference.com/')
  assert.equal(provider.companyCareerPage, 'https://nference.com/careers')
  assert.equal(provider.officialCareersHandoffUrl, 'https://nference.keka.com/careers/')
  assert.equal(
    provider.careerPortalInfoUrl,
    'https://nference.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    provider.activeJobsApiUrl,
    'https://nference.keka.com/careers/api/embedjobs/default/active/ebcb8808-c268-4a6d-a493-192d50dde0b7',
  )
  assert.equal(provider.kekaIdentifier, 'ebcb8808-c268-4a6d-a493-192d50dde0b7')
  assert.equal(provider.kekaDomain, 'https://nference.keka.com/careers/')
  assert.equal(provider.kekaPortalName, 'default')
  assert.equal(provider.kekaPortalDomain, 'nference.keka.com')
  assert.equal(provider.companyDomain, 'nference.com')
  assert.equal(provider.verifiedPublicJobCount, 3)
  assert.equal(provider.verifiedSampleJobUrl, 'https://nference.keka.com/careers/jobdetails/78858')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-careers-page-plus-keka-active-jobs-endpoint')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-keka-handoff+careerportalinfo+active-keka-embed-api+jobdetails+applyjob',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /nference[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/nference\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/nference\.keka\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /3 live public jobs/i)

  assert.equal(nference.PROVIDER_METADATA.source, NFERENCE_CATALOG.source)
  assert.equal(nference.PROVIDER_METADATA.companyName, NFERENCE_CATALOG.companyName)
  assert.equal(
    nference.PROVIDER_METADATA.companyCareerPage,
    NFERENCE_CATALOG.companyCareerPage,
  )
})

test('Nference exact backlog row resolves directly from local provider metadata', async () => {
  const { NFERENCE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Nference\n',
    catalog: [hydrateProviderCatalogEntry(NFERENCE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nference', 'nference', 'Nference']],
  )
})

test('Nference hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { NFERENCE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NFERENCE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Nference')
  assert.equal(provider.companyCareerPage, 'https://nference.com/careers')
  assert.equal(provider.companyDomain, 'nference.com')
  assert.match(provider.modulePath, /nference[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /nference[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

test('getScraperCatalog exposes Nference as a runnable shared provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nference')
  const scraper = buildScrapers().find((item) => item.name === 'nference')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Nference')
  assert.equal(provider.companyCareerPage, 'https://nference.com/careers')

  const report = generateCompanyCoverageReport({
    csvText: 'Nference\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nference', 'nference', 'Nference']],
  )
})
