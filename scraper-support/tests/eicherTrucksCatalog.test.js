import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/eichertrucks/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/eichertrucks/catalog.js')
  } catch {
    assert.fail('Expected Eicher Trucks catalog module at ../../scraper/eichertrucks/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/eichertrucks/script.js')
  } catch {
    assert.fail('Expected Eicher Trucks scraper module at ../../scraper/eichertrucks/script.js')
  }
}

test('Eicher Trucks catalog captures the verified brand careers handoff without a trustworthy public Eicher Trucks jobs surface', async () => {
  const { EICHER_TRUCKS_CATALOG } = await loadCatalogModule()
  const eicherTrucks = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(EICHER_TRUCKS_CATALOG)

  assert.equal(provider.source, 'eichertrucks')
  assert.equal(provider.companyName, 'Eicher Trucks')
  assert.equal(provider.officialBrandName, 'Eicher Trucks and Buses')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.eichertrucksandbuses.com/')
  assert.equal(provider.companyCareerPage, 'https://www.eichertrucksandbuses.com/careers')
  assert.equal(provider.careersPageUrl, 'https://www.eichertrucksandbuses.com/careers')
  assert.deepEqual(provider.verifiedFirstPartyUrls, [
    'https://www.eichertrucksandbuses.com/',
    'https://www.eichertrucksandbuses.com/careers',
    'https://www.eichertrucksandbuses.com/career',
    'https://www.eichertrucksandbuses.com/jobs',
    'https://www.eichertrucksandbuses.com/current-openings',
    'https://www.eichertrucksandbuses.com/join-us',
  ])
  assert.deepEqual(provider.linkedCareerUrls, [
    'https://careers.vecv.in/',
  ])
  assert.equal(provider.companyDomain, 'eichertrucksandbuses.com')
  assert.equal(provider.atsPlatform, 'official-company-site-subsidiary-careers-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-first-party-careers-page-plus-direct-job-route-and-vecv-handoff-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-vecv-handoff+verified-missing-direct-job-routes+verified-cloudflare-blocked-vecv-careers-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.eichertrucksandbuses\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.eichertrucksandbuses\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.eichertrucksandbuses\.com\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.eichertrucksandbuses\.com\/join-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.vecv\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /404/i)
  assert.match(provider.verifiedSurfaceSummary, /403/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(provider.verifiedSurfaceSummary, /Eicher Trucks/i)
  assert.match(provider.dryRunFile, /eichertrucks[\\/]jobs\.json$/i)

  assert.equal(eicherTrucks.PROVIDER_METADATA.source, provider.source)
  assert.equal(eicherTrucks.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(eicherTrucks.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Eicher Trucks exact backlog name matches directly from the local provider contract', async () => {
  const { EICHER_TRUCKS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Eicher Trucks\n',
    catalog: [hydrateProviderCatalogEntry(EICHER_TRUCKS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Eicher Trucks', 'eichertrucks', 'Eicher Trucks']],
  )
})
