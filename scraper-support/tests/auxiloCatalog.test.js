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
const auxiloModulePath = path.resolve(currentDir, '../../scraper/auxilo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/auxilo/catalog.js')
  } catch {
    assert.fail('Expected Auxilo catalog module at ../../scraper/auxilo/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/auxilo/script.js')
  } catch {
    assert.fail('Expected Auxilo scraper module at ../../scraper/auxilo/script.js')
  }
}

test('Auxilo local catalog captures the verified first-party careers handoff and Workline public jobs API surface', async () => {
  const { AUXILO_CATALOG } = await loadCatalogModule()
  const auxilo = await loadScriptModule()

  assert.equal(AUXILO_CATALOG.source, 'auxilo')
  assert.equal(AUXILO_CATALOG.companyName, 'Auxilo')
  assert.equal(AUXILO_CATALOG.officialBrandName, 'Auxilo Finserve')
  assert.equal(AUXILO_CATALOG.adapter, 'script')
  assert.equal(AUXILO_CATALOG.companyCareerPage, 'https://www.auxilo.com/careers')
  assert.equal(AUXILO_CATALOG.homepageUrl, 'https://www.auxilo.com/')
  assert.equal(AUXILO_CATALOG.jobsBoardEntryUrl, 'https://app1176.workline.hr/candidate')
  assert.equal(AUXILO_CATALOG.jobsBoardUrl, 'https://app1176.workline.hr/Cportal/GeneralOpening.aspx')
  assert.equal(
    AUXILO_CATALOG.jobsApiUrl,
    'https://app1176.workline.hr/CPortal/generalopening.aspx/GetCurrentopening',
  )
  assert.equal(
    AUXILO_CATALOG.sampleDetailUrl,
    'https://app1176.workline.hr/CandidatePortal/56dc33ad-1f13-475c-958d-7c7dcb92df9f/Senior-Executive---Customer-Service-Job-in-Mumbai---Corporate-Office-1-1391',
  )
  assert.equal(
    AUXILO_CATALOG.sampleApplyUrl,
    'https://app1176.workline.hr/Candidate/SignInv1.aspx?PRFCode=56dc33ad-1f13-475c-958d-7c7dcb92df9f&Flag=C&DirectApply=1',
  )
  assert.equal(AUXILO_CATALOG.companyDomain, 'auxilo.com')
  assert.equal(AUXILO_CATALOG.atsPlatform, 'workline-public-jobs-api')
  assert.equal(AUXILO_CATALOG.countryFilter, 'India')
  assert.equal(
    AUXILO_CATALOG.paginationStrategy,
    'verified-careers-page-handoff-plus-single-workline-current-opening-api',
  )
  assert.equal(
    AUXILO_CATALOG.extractionStrategy,
    'verified-homepage+verified-first-party-careers-page+workline-handoff+currentopening-json-api+detail-page-apply-validation',
  )
  assert.equal(AUXILO_CATALOG.parser, 'custom-script')
  assert.equal(AUXILO_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AUXILO_CATALOG.verifiedOn, '2026-10-03')
  assert.equal(AUXILO_CATALOG.dryRunFile, 'auxilo/jobs.json')
  assert.equal(AUXILO_CATALOG.modulePath, auxiloModulePath)
  assert.match(AUXILO_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.auxilo\.com\/careers/i)
  assert.match(AUXILO_CATALOG.verifiedSurfaceSummary, /https:\/\/app1176\.workline\.hr\/candidate/i)
  assert.match(AUXILO_CATALOG.verifiedSurfaceSummary, /GeneralOpening\.aspx/i)
  assert.match(AUXILO_CATALOG.verifiedSurfaceSummary, /GetCurrentopening/i)
  assert.match(AUXILO_CATALOG.verifiedSurfaceSummary, /\b16 live job records\b/i)
  assert.match(AUXILO_CATALOG.verifiedSurfaceSummary, /SignInv1\.aspx/i)

  assert.equal(auxilo.PROVIDER_METADATA.source, AUXILO_CATALOG.source)
  assert.equal(auxilo.PROVIDER_METADATA.companyName, AUXILO_CATALOG.companyName)
  assert.equal(auxilo.PROVIDER_METADATA.jobsBoardUrl, AUXILO_CATALOG.jobsBoardUrl)
  assert.equal(auxilo.PROVIDER_METADATA.jobsApiUrl, AUXILO_CATALOG.jobsApiUrl)
})

test('Auxilo local catalog hydrates into coverage without needing an alias entry', async () => {
  const { AUXILO_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(AUXILO_CATALOG)

  assert.equal(provider.companyName, 'Auxilo')
  assert.equal(provider.companyDomain, 'auxilo.com')
  assert.match(provider.modulePath, /auxilo[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /auxilo[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Auxilo\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Auxilo', 'auxilo', 'Auxilo']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Auxilo'), false)
})

test('buildScrapers and company coverage resolve Auxilo from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'auxilo')
  const scraper = buildScrapers().find((item) => item.name === 'auxilo')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Auxilo')
  assert.equal(provider.companyCareerPage, 'https://www.auxilo.com/careers')
  assert.match(scraper.dryRunFile, /auxilo[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Auxilo\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Auxilo', 'auxilo', 'Auxilo']],
  )
})
