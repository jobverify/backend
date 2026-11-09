import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Omnex Software Solutions Pvt. Ltd. is registered against the verified first-party jobs portal without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'omnexsoftwaresolutionspvtltd')

  assert.ok(provider, 'Expected Omnex provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Omnex Software Solutions Pvt.Ltd.')
  assert.equal(provider.companyCareerPage, 'http://careers.omnexsystems.com/Users/Jobs')
  assert.equal(provider.atsPlatform, 'omnex-public-jobs-portal')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-company-site-handoff-plus-clientid-query-page-number-json-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-omnexsystems-homepage+verified-about-page+verified-first-party-jobs-portal+json-job-feed+detail-pages+jobposting-jsonld',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.omnexsystems.com')
  assert.match(provider.modulePath, /omnexsoftwaresolutionspvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Omnex Software Solutions pvt. Ltd'), false)
})

test('Omnex Software Solutions pvt. Ltd maps from company coverage and buildScrapers exposes a runnable scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Omnex Software Solutions pvt. Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Omnex Software Solutions pvt. Ltd', 'omnexsoftwaresolutionspvtltd', 'Omnex Software Solutions Pvt.Ltd.']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'omnexsoftwaresolutionspvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Omnex scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'omnexsoftwaresolutionspvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'http://careers.omnexsystems.com/Users/Jobs')
  assert.match(scraper.dryRunFile, /omnexsoftwaresolutionspvtltd[\\/]jobs\.json$/i)
})
