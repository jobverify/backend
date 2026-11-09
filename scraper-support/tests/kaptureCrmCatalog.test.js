import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadKaptureCrmModule = async () => {
  try {
    return await import('../../scraper/kapturecrm/script.js')
  } catch {
    assert.fail('Expected Kapture CRM scraper module at ../../scraper/kapturecrm/script.js')
  }
}

test('getScraperCatalog includes Kapture CRM as a verified Keka embed script provider', async () => {
  const kaptureCrm = await loadKaptureCrmModule()
  const provider = getScraperCatalog().find((item) => item.source === kaptureCrm.SOURCE)

  assert.ok(provider)
  assert.equal(provider.source, 'kapturecrm')
  assert.equal(provider.companyName, 'Kapture CRM')
  assert.equal(provider.officialBrandName, 'Kapture')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.kapture.cx/careers/')
  assert.equal(provider.companyDomain, 'kapture.cx')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-keka-active-jobs-endpoint')
  assert.equal(
    provider.extractionStrategy,
    'verified-kapture-crm-careers-page+verified-keka-embed-config+active-keka-embed-api+jobdetails+applyjob',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /kapturecrm[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /kapturecrm[\\/]jobs\.json$/i)

  assert.equal(kaptureCrm.SOURCE, provider.source)
  assert.equal(kaptureCrm.COMPANY, provider.companyName)
  assert.equal(kaptureCrm.OFFICIAL_BRAND_NAME, provider.officialBrandName)
  assert.equal(kaptureCrm.CAREERS_URL, provider.companyCareerPage)
  assert.equal(kaptureCrm.COMPANY_DOMAIN, provider.companyDomain)
  assert.equal(kaptureCrm.ATS_PLATFORM, provider.atsPlatform)
  assert.equal(kaptureCrm.COUNTRY_FILTER, provider.countryFilter)
  assert.equal(kaptureCrm.PAGINATION_STRATEGY, provider.paginationStrategy)
  assert.equal(kaptureCrm.PARSER, provider.parser)
  assert.equal(kaptureCrm.NORMALIZATION_PROFILE, provider.normalizationProfile)
  assert.equal(typeof kaptureCrm.createKaptureCrmScraper, 'function')
})

test('buildScrapers and company coverage resolve Kapture CRM from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kapturecrm')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'kapturecrm')
  assert.match(scraper.dryRunFile, /kapturecrm[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Kapture CRM,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kapture CRM', 'kapturecrm', 'Kapture CRM']],
  )
})
