import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/eicher/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/eicher/catalog.js')
  } catch {
    assert.fail('Expected Eicher catalog module at ../../scraper/eicher/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/eicher/script.js')
  } catch {
    assert.fail('Expected Eicher scraper module at ../../scraper/eicher/script.js')
  }
}

test('Eicher catalog captures the verified first-party careers handoff without a trustworthy public Eicher jobs surface', async () => {
  const { EICHER_CATALOG } = await loadCatalogModule()
  const eicher = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(EICHER_CATALOG)

  assert.equal(provider.source, 'eicher')
  assert.equal(provider.companyName, 'Eicher')
  assert.equal(provider.officialBrandName, 'Eicher Motors Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.eicher.in/')
  assert.equal(provider.companyCareerPage, 'https://www.eicher.in/careers')
  assert.equal(provider.careersPageUrl, 'https://www.eicher.in/careers')
  assert.deepEqual(provider.verifiedFirstPartyUrls, [
    'https://www.eicher.in/',
    'https://www.eicher.in/careers',
    'https://www.eicher.in/career',
    'https://www.eicher.in/jobs',
    'https://www.eicher.in/current-openings',
  ])
  assert.deepEqual(provider.linkedCareerUrls, [
    'http://royalenfield.com/aboutus/careers/',
    'http://careers.vecv.in/',
    'https://careers.vecv.in/',
  ])
  assert.equal(provider.companyDomain, 'eicher.in')
  assert.equal(provider.atsPlatform, 'official-company-site-subsidiary-careers-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-careers-page-plus-direct-job-route-and-subsidiary-handoff-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-subsidiary-careers-handoff+verified-missing-direct-job-routes+verified-cloudflare-blocked-vecv-careers-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.eicher\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.eicher\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /http:\/\/royalenfield\.com\/aboutus\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /http:\/\/careers\.vecv\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.vecv\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /404/i)
  assert.match(provider.verifiedSurfaceSummary, /403/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(provider.dryRunFile, /eicher[\\/]jobs\.json$/i)

  assert.equal(eicher.PROVIDER_METADATA.source, provider.source)
  assert.equal(eicher.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(eicher.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Eicher exact backlog name matches directly from the local provider contract', async () => {
  const { EICHER_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Eicher\n',
    catalog: [hydrateProviderCatalogEntry(EICHER_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Eicher', 'eicher', 'Eicher']],
  )
})
