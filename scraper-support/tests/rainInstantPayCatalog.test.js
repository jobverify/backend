import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rainInstantPayModulePath = path.resolve(currentDir, '../../scraper/raininstantpay/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/raininstantpay/catalog.js')
  } catch {
    assert.fail('Expected Rain Instant Pay catalog module at ../../scraper/raininstantpay/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/raininstantpay/script.js')
  } catch {
    assert.fail('Expected Rain Instant Pay scraper module at ../../scraper/raininstantpay/script.js')
  }
}

test('Rain Instant Pay local catalog captures the verified official careers page and Ashby GET feed contract', async () => {
  const { RAIN_INSTANT_PAY_CATALOG } = await loadCatalogModule()
  const rainInstantPay = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(RAIN_INSTANT_PAY_CATALOG)

  assert.equal(provider.source, 'raininstantpay')
  assert.equal(provider.companyName, 'Rain Instant Pay')
  assert.equal(provider.officialBrandName, 'Rain')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.rainapp.com/careers')
  assert.equal(provider.ashbyPublicBoardUrl, 'https://jobs.ashbyhq.com/rain-technologies')
  assert.equal(provider.ashbyJobBoardUrl, 'https://api.ashbyhq.com/posting-api/job-board/rain-technologies')
  assert.equal(provider.companyDomain, 'rainapp.com')
  assert.equal(provider.verifiedPublicJobCount, 8)
  assert.equal(provider.verifiedSampleJobTitle, 'Business Development Representative')
  assert.equal(provider.verifiedSampleSecondaryJobTitle, 'Engineering Lead')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'single-public-ashby-job-board-get')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+ashby-handoff+public-ashby-get-feed',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, rainInstantPayModulePath)
  assert.match(provider.dryRunFile, /raininstantpay[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.rainapp\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.ashbyhq\.com\/rain-technologies/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/rain-technologies/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Development Representative/i)
  assert.match(provider.verifiedSurfaceSummary, /Engineering Lead/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Rain Instant Pay'), false)

  assert.equal(rainInstantPay.PROVIDER_METADATA.source, RAIN_INSTANT_PAY_CATALOG.source)
  assert.equal(
    rainInstantPay.PROVIDER_METADATA.ashbyJobBoardUrl,
    RAIN_INSTANT_PAY_CATALOG.ashbyJobBoardUrl,
  )
})

test('Rain Instant Pay backlog row matches directly from the local catalog without alias churn', async () => {
  const { RAIN_INSTANT_PAY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Rain Instant Pay\n',
    catalog: [hydrateProviderCatalogEntry(RAIN_INSTANT_PAY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rain Instant Pay', 'raininstantpay', 'Rain Instant Pay']],
  )
})

test('Rain Instant Pay hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { RAIN_INSTANT_PAY_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(RAIN_INSTANT_PAY_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /raininstantpay[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /raininstantpay[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
