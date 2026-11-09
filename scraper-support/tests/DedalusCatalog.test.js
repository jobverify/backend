import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/dedalus.workday/script.js')

const aliasMap = {
  'DH Healthcare Software Services India Private Limited': 'dedalus',
  'DH Healthcare Software Services India Private Limited (Dedalus)': 'dedalus',
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dedalus.workday/catalog.js')
  } catch {
    assert.fail('Expected Dedalus catalog module at ../../scraper/dedalus.workday/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/dedalus.workday/script.js')
  } catch {
    assert.fail('Expected Dedalus scraper module at ../../scraper/dedalus.workday/script.js')
  }
}

test('Dedalus local catalog captures the verified first-party careers handoff and current India-empty Workday surface', async () => {
  const { DEDALUS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const dedalus = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(DEDALUS_CATALOG)

  assert.equal(defaultCatalog, DEDALUS_CATALOG)
  assert.equal(provider.source, 'dedalus')
  assert.equal(provider.companyName, 'Dedalus')
  assert.equal(provider.officialBrandName, 'Dedalus')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.dedalus.com/global/en/careers/')
  assert.equal(
    provider.officialJobOffersPageUrl,
    'https://www.dedalus.com/global/en/working-at-dedalus/our-job-offers/',
  )
  assert.equal(provider.officialWorkdayBoardUrl, 'https://dedalus.wd3.myworkdayjobs.com/External')
  assert.equal(
    provider.jobsApiUrl,
    'https://dedalus.wd3.myworkdayjobs.com/wday/cxs/dedalus/External/jobs',
  )
  assert.equal(provider.verifiedIndiaCountryFacetId, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.deepEqual(provider.verifiedIndiaLocationDescriptors, [
    'IND - Chennai',
    'IND - New Delhi - Noida',
  ])
  assert.deepEqual(provider.verifiedIndiaJobUrls, [
    'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/PAS-Integration-Engineer_JR108480',
    'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/Solution-Architect_JR108318',
  ])
  assert.equal(provider.companyDomain, 'dedalus.com')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-handoff-plus-workday-country-facet',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+verified-workday-board+unfiltered-workday-jobs-api+india-country-facet-or-empty-india-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /dedalus.workday[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.dedalus\.com\/global\/en\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/dedalus\.wd3\.myworkdayjobs\.com\/External/i)
  assert.match(provider.verifiedSurfaceSummary, /no longer exposes an India country facet/i)
  assert.match(provider.verifiedSurfaceSummary, /blank generic Workday shells/i)
  assert.equal(companyAliases['DH Healthcare Software Services India Private Limited'], 'dedalus')
  assert.equal(companyAliases['DH Healthcare Software Services India Pvt Ltd'], 'dedalus')

  assert.equal(dedalus.PROVIDER_METADATA.source, DEDALUS_CATALOG.source)
  assert.equal(dedalus.PROVIDER_METADATA.jobsApiUrl, DEDALUS_CATALOG.jobsApiUrl)
})

test('Dedalus local coverage contract documents the exact alias snippet the controller should later integrate', async () => {
  const { DEDALUS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Dedalus\nDH Healthcare Software Services India Private Limited\nDH Healthcare Software Services India Private Limited (Dedalus)\n',
    catalog: [hydrateProviderCatalogEntry(DEDALUS_CATALOG)],
    aliasMap,
  })

  assert.equal(report.matchedCount, 3)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Dedalus', 'dedalus', 'Dedalus'],
      ['DH Healthcare Software Services India Private Limited', 'dedalus', 'Dedalus'],
      ['DH Healthcare Software Services India Private Limited (Dedalus)', 'dedalus', 'Dedalus'],
    ],
  )
})

test('Dedalus hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { DEDALUS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(DEDALUS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Dedalus')
  assert.equal(provider.officialWorkdayBoardUrl, 'https://dedalus.wd3.myworkdayjobs.com/External')
  assert.match(provider.modulePath, /dedalus\.workday[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /dedalus.workday[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
