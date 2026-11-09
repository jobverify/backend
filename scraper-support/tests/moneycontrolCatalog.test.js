import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const moneycontrolModulePath = path.resolve(currentDir, '../../scraper/moneycontrol/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/moneycontrol/catalog.js')
  } catch {
    assert.fail('Expected Moneycontrol catalog module at ../../scraper/moneycontrol/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/moneycontrol/script.js')
  } catch {
    assert.fail('Expected Moneycontrol scraper module at ../../scraper/moneycontrol/script.js')
  }
}

test('Moneycontrol local catalog captures the verified contact-page careers link and blocked careers-route sentinel', async () => {
  const { MONEYCONTROL_CATALOG } = await loadCatalogModule()
  const moneycontrol = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(MONEYCONTROL_CATALOG)

  assert.equal(provider.source, 'moneycontrol')
  assert.equal(provider.companyName, 'Moneycontrol')
  assert.equal(provider.officialBrandName, 'Moneycontrol')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.moneycontrol.com/career/?classic=true')
  assert.equal(provider.officialContactPageUrl, 'https://www.moneycontrol.com/cdata/contact.php?classic=true')
  assert.deepEqual(provider.blockedCareersRouteUrls, [
    'https://www.moneycontrol.com/career/?classic=true',
    'https://www.moneycontrol.com/career/',
  ])
  assert.equal(provider.companyDomain, 'moneycontrol.com')
  assert.equal(provider.atsPlatform, 'official-contact-page-plus-blocked-careers-route')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-contact-page-plus-blocked-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-contact-page-careers-link+blocked-careers-route-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-19')
  assert.match(provider.dryRunFile, /moneycontrol[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, moneycontrolModulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 19, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /contact\.php\?classic=true/i)
  assert.match(provider.verifiedSurfaceSummary, /career\/\?classic=true/i)
  assert.match(provider.verifiedSurfaceSummary, /503/i)
  assert.match(provider.verifiedSurfaceSummary, /Akamai/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Moneycontrol'), false)

  assert.equal(moneycontrol.PROVIDER_METADATA.source, MONEYCONTROL_CATALOG.source)
  assert.equal(moneycontrol.PROVIDER_METADATA.companyName, MONEYCONTROL_CATALOG.companyName)
  assert.equal(
    moneycontrol.PROVIDER_METADATA.officialContactPageUrl,
    MONEYCONTROL_CATALOG.officialContactPageUrl,
  )
})

test('Moneycontrol backlog row matches directly from the local catalog without alias churn', async () => {
  const { MONEYCONTROL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Moneycontrol\n',
    catalog: [hydrateProviderCatalogEntry(MONEYCONTROL_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Moneycontrol', 'moneycontrol', 'Moneycontrol']],
  )
})
