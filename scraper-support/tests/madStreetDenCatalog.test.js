import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/madstreetden/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/madstreetden/catalog.js')
  } catch {
    assert.fail('Expected Mad Street Den catalog module at ../../scraper/madstreetden/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/madstreetden/script.js')
  } catch {
    assert.fail('Expected Mad Street Den scraper module at ../../scraper/madstreetden/script.js')
  }
}

test('Mad Street Den local catalog captures the verified exact-name empty-board contract', async () => {
  const { MAD_STREET_DEN_CATALOG } = await loadCatalogModule()
  const madStreetDen = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(MAD_STREET_DEN_CATALOG)

  assert.equal(provider.source, 'madstreetden')
  assert.equal(provider.companyName, 'Mad Street Den')
  assert.equal(provider.officialBrandName, 'Mad Street Den')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.madstreetden.com/')
  assert.equal(provider.companyCareerPage, 'https://www.madstreetden.com/careers/')
  assert.equal(provider.jobListApiUrl, 'https://www.madstreetden.com/api/joblist.php')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://msd.darwinbox.in/ms/candidate/careers/others?apply=1',
  )
  assert.equal(
    provider.darwinboxPublicBoardUrl,
    'https://msd.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(provider.companyDomain, 'madstreetden.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-empty-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-careers-page-plus-joblist-401-plus-darwinbox-board-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-joblist-invalid-url-response+verified-darwinbox-empty-signal-or-shell-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.match(provider.dryRunFile, /madstreetden[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.madstreetden\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.madstreetden\.com\/api\/joblist\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /Invalid Url/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/msd\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs/i)
  assert.match(provider.verifiedSurfaceSummary, /raw shell or branded stub/i)
  assert.match(provider.verifiedSurfaceSummary, /No jobs found/i)

  assert.equal(madStreetDen.PROVIDER_METADATA.source, MAD_STREET_DEN_CATALOG.source)
  assert.equal(madStreetDen.PROVIDER_METADATA.companyName, MAD_STREET_DEN_CATALOG.companyName)
  assert.equal(madStreetDen.PROVIDER_METADATA.jobListApiUrl, MAD_STREET_DEN_CATALOG.jobListApiUrl)
})

test('Mad Street Den exact backlog name matches directly from local provider metadata', async () => {
  const { MAD_STREET_DEN_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Mad Street Den\n',
    catalog: [hydrateProviderCatalogEntry(MAD_STREET_DEN_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mad Street Den', 'madstreetden', 'Mad Street Den']],
  )
})

test('Mad Street Den hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { MAD_STREET_DEN_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MAD_STREET_DEN_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Mad Street Den')
  assert.equal(provider.companyCareerPage, 'https://www.madstreetden.com/careers/')
  assert.equal(provider.companyDomain, 'madstreetden.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-empty-board')
  assert.match(provider.modulePath, /madstreetden[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /madstreetden[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
