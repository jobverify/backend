import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/everestindustries/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/everestindustries/catalog.js')
  } catch {
    assert.fail('Expected Everest Industries catalog module at ../../scraper/everestindustries/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/everestindustries/script.js')
  } catch {
    assert.fail('Expected Everest Industries scraper module at ../../scraper/everestindustries/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Everest Industries local catalog captures the verified first-party careers page and Darwinbox handoff contract', async () => {
  const { EVEREST_INDUSTRIES_CATALOG } = await loadCatalogModule()
  const everestIndustries = await loadScraperModule()
  const provider = buildCatalogReadyProvider(EVEREST_INDUSTRIES_CATALOG)

  assert.equal(provider.source, 'everestindustries')
  assert.equal(provider.companyName, 'Everest Industries')
  assert.equal(provider.officialBrandName, 'Everest Industries Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.everestind.com/')
  assert.equal(provider.companyCareerPage, 'https://www.everestind.com/careerateverest')
  assert.equal(provider.darwinboxPublicPortalUrl, 'https://oneeverest.darwinbox.in/jobs')
  assert.equal(
    provider.darwinboxHomeUrl,
    'https://oneeverest.darwinbox.in/ms/candidatev2/main/careers/home',
  )
  assert.equal(
    provider.darwinboxAllJobsUrl,
    'https://oneeverest.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    provider.darwinboxApplyUrlExample,
    'https://oneeverest.darwinbox.in/ms/candidate/candidate/login?redirect=/ms/candidate/careers/a699eb89c55aca___apply=1',
  )
  assert.equal(provider.companyDomain, 'everestind.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-plus-darwinbox-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-html')
  assert.equal(
    provider.extractionStrategy,
    'homepage-careers-link+inline-first-party-job-cards+darwinbox-apply-handoff+darwinbox-shell-checks',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.everestind\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.everestind\.com\/careerateverest/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/oneeverest\.darwinbox\.in\/jobs/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/oneeverest\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/oneeverest\.darwinbox\.in\/ms\/candidate\/candidate\/login\?redirect=\/ms\/candidate\/careers\/a699eb89c55aca___apply=1/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b13 public openings\b/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare 403/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /everestindustries[\\/]jobs\.json$/i)

  assert.equal(everestIndustries.PROVIDER_METADATA.source, provider.source)
  assert.equal(everestIndustries.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(everestIndustries.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(
    everestIndustries.PROVIDER_METADATA.darwinboxPublicPortalUrl,
    provider.darwinboxPublicPortalUrl,
  )
})

test('Everest Industries exact backlog row matches from the local provider contract without aliases', async () => {
  const { EVEREST_INDUSTRIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Everest Industries\n',
    catalog: [buildCatalogReadyProvider(EVEREST_INDUSTRIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Everest Industries', 'everestindustries', 'Everest Industries']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Everest Industries'), false)
})
