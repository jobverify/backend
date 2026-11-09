import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('KINLONG HARDWARE INDIAPVT. LTD is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kinlonghardwareindiapvtltd')

  assert.ok(provider, 'Expected KINLONG HARDWARE INDIAPVT. LTD provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'KINLONG HARDWARE INDIAPVT. LTD')
  assert.equal(provider.companyCareerPage, 'https://en.kinlong.com/career.html')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-plus-contact-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-email-only-careers-page+verified-india-subsidiary-contact-zero-jobs',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'en.kinlong.com')
  assert.match(provider.modulePath, /kinlonghardwareindiapvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'KINLONG HARDWARE INDIAPVT. LTD'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Kinlong\u200b'), true)
  assert.equal(companyAliases['Kinlong\u200b'], 'kinlonghardwareindiapvtltd')
})

test('KINLONG HARDWARE INDIAPVT. LTD matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'KINLONG HARDWARE INDIAPVT. LTD,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['KINLONG HARDWARE INDIAPVT. LTD', 'kinlonghardwareindiapvtltd', 'KINLONG HARDWARE INDIAPVT. LTD']],
  )
})

test('KINLONG alias variant from the CSV resolves to the KINLONG HARDWARE INDIAPVT. LTD scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Kinlong\u200b,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kinlong\u200b', 'kinlonghardwareindiapvtltd', 'KINLONG HARDWARE INDIAPVT. LTD']],
  )
})

test('KINLONG HARDWARE INDIAPVT. LTD is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kinlonghardwareindiapvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the KINLONG HARDWARE INDIAPVT. LTD scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'kinlonghardwareindiapvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://en.kinlong.com/career.html')
  assert.match(scraper.dryRunFile, /kinlonghardwareindiapvtltd[\\/]jobs\.json$/i)
})
