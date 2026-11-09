import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/thryvedigital/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/thryvedigital/catalog.js')
  } catch {
    assert.fail('Expected Thryve Digital catalog module at ../../scraper/thryvedigital/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/thryvedigital/script.js')
  } catch {
    assert.fail('Expected Thryve Digital scraper module at ../../scraper/thryvedigital/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Thryve Digital local catalog captures the verified first-party enGen careers page and Darwinbox handoff', async () => {
  const { THRYVE_DIGITAL_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const thryveDigital = await loadScriptModule()
  const provider = buildCatalogReadyProvider(THRYVE_DIGITAL_CATALOG)

  assert.equal(defaultCatalog, THRYVE_DIGITAL_CATALOG)
  assert.equal(provider.source, 'thryvedigital')
  assert.equal(provider.companyName, 'Thryve Digital')
  assert.equal(provider.officialBrandName, 'enGen Global')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.goengen.in/')
  assert.equal(provider.companyCareerPage, 'https://www.goengen.in/careers')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://tdh.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(provider.darwinboxOrigin, 'https://tdh.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-goengen-careers-page+darwinbox-listing-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'goengen.in')
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.match(provider.verifiedSurfaceSummary, /Wednesday, August 5, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.thryvedigital\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.goengen\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/tdh\.darwinbox\.in\/ms\/candidate\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /An enGenious career, rooted in India\./i)
  assert.match(provider.verifiedSurfaceSummary, /CLICK HERE TO JOIN US/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /thryvedigital[\\/]jobs\.json$/i)

  assert.equal(thryveDigital.PROVIDER_METADATA.source, provider.source)
  assert.equal(thryveDigital.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(thryveDigital.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Thryve Digital exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { THRYVE_DIGITAL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Thryve Digital\n',
    catalog: [buildCatalogReadyProvider(THRYVE_DIGITAL_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Thryve Digital', 'thryvedigital', 'Thryve Digital']],
  )
})
