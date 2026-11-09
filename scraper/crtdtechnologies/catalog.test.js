import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('CRTD Technologies is registered as a verified empty first-party careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'crtdtechnologies')

  assert.ok(provider, 'Expected CRTD Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'CRTD Technologies')
  assert.equal(provider.companyCareerPage, 'https://crtd.in/fresher-jobs')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-empty-api-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-fresher-jobs-shell+verified-first-party-bundle+verified-public-jobs-apis-bad-request-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'crtd.in')
  assert.match(provider.modulePath, /crtdtechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'CRTD Technologies'), false)
})

test('CRTD Technologies matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'CRTD Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CRTD Technologies', 'crtdtechnologies', 'CRTD Technologies']],
  )
})

test('CRTD Technologies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'crtdtechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the CRTD Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'crtdtechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://crtd.in/fresher-jobs')
  assert.match(scraper.dryRunFile, /crtdtechnologies[\\/]jobs\.json$/i)
})
