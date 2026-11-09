import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/fampay/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fampay/catalog.js')
  } catch {
    assert.fail('Expected Fampay catalog module at ../../scraper/fampay/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/fampay/script.js')
  } catch {
    assert.fail('Expected Fampay scraper module at ../../scraper/fampay/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Fampay local catalog captures the verified first-party Fam careers shell and Lever jobs contract', async () => {
  const {
    FAMPAY_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()
  const fampay = await loadScraperModule()
  const provider = buildCatalogReadyProvider(FAMPAY_CATALOG)

  assert.equal(provider.source, 'fampay')
  assert.equal(provider.companyName, 'Fampay')
  assert.equal(provider.officialBrandName, 'FamApp by Trio')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.modulePath, modulePath)
  assert.equal(FAMPAY_CATALOG.dryRunFile, 'fampay/jobs.json')
  assert.match(provider.dryRunFile, /fampay[\\/]jobs\.json$/i)
  assert.equal(provider.officialHomepageUrl, 'https://www.famapp.in/')
  assert.equal(provider.companyCareerPage, 'https://www.famapp.in/careers/')
  assert.equal(provider.officialJobsPageUrl, 'https://www.famapp.in/jobs/')
  assert.equal(provider.careersBundleUrl, 'https://www.famapp.in/_next/static/chunks/a57fc16ab57e4e2c.js')
  assert.equal(provider.jobsBundleUrl, 'https://www.famapp.in/_next/static/chunks/46b0e91d4324e433.js')
  assert.equal(provider.officialLeverBoardUrl, 'https://jobs.lever.co/fampay')
  assert.equal(provider.leverApiUrl, 'https://api.lever.co/v0/postings/fampay?group=team&mode=json')
  assert.equal(provider.companyDomain, 'famapp.in')
  assert.equal(provider.verifiedIndiaCountryCode, 'IN')
  assert.equal(provider.verifiedLeverGroupCount, 7)
  assert.equal(provider.verifiedLeverPostingCount, 17)
  assert.equal(provider.verifiedIndiaRoleCount, 17)
  assert.equal(provider.verifiedLeverLocation, 'Bengaluru')
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://jobs.lever.co/fampay/7c59fd4b-508e-4a91-9d73-164bc7d9abba',
  )
  assert.equal(provider.atsPlatform, 'lever')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-careers-shell-plus-first-party-jobs-shell-bundle-plus-grouped-lever-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+verified-careers-bundle-jobs-handoff+verified-jobs-shell+verified-jobs-bundle+grouped-lever-postings-api+india-country-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.famapp\.in\/careers\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.famapp\.in\/jobs\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.famapp\.in\/_next\/static\/chunks\/a57fc16ab57e4e2c\.js/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.famapp\.in\/_next\/static\/chunks\/46b0e91d4324e433\.js/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/jobs\.lever\.co\/fampay/i)
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/api\.lever\.co\/v0\/postings\/fampay\?group=team&mode=json/i,
  )
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/jobs\.lever\.co\/fampay\/7c59fd4b-508e-4a91-9d73-164bc7d9abba/i,
  )
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b17 public postings\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b17 India roles\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b7 teams\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /formerly FamPay/i)

  assert.equal(fampay.PROVIDER_METADATA.source, provider.source)
  assert.equal(fampay.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(fampay.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(fampay.PROVIDER_METADATA.officialJobsPageUrl, provider.officialJobsPageUrl)
  assert.equal(fampay.PROVIDER_METADATA.leverApiUrl, provider.leverApiUrl)
})

test('Fampay exact backlog row matches from the local provider contract without aliases', async () => {
  const { FAMPAY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Fampay\n',
    catalog: [buildCatalogReadyProvider(FAMPAY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fampay', 'fampay', 'Fampay']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Fampay'), false)
})
