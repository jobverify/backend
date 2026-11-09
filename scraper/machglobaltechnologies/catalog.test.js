import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Mach Global Technologies is registered with the verified first-party careers page and requires no alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'machglobaltechnologies')

  assert.ok(provider, 'Expected Mach Global Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Mach Global Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.machglobaltech.com/careers.php')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-contact-page-plus-missing-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+verified-contact-page-country-signal+inline-public-openings+shared-mailto-apply+verified-missing-jobs-routes',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'machglobaltech.com')
  assert.match(provider.modulePath, /machglobaltechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Mach Global Technologies'), false)
})

test('Mach Global Technologies matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Mach Global Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mach Global Technologies', 'machglobaltechnologies', 'Mach Global Technologies']],
  )
})

test('Mach Global Technologies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'machglobaltechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Mach Global Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'machglobaltechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.machglobaltech.com/careers.php')
  assert.match(scraper.dryRunFile, /machglobaltechnologies[\\/]jobs\.json$/i)
})
