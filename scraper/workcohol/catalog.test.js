import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Workcohol is registered as a verified first-party careers scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'workcohol')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Workcohol')
  assert.equal(provider.companyCareerPage, 'https://www.workcohol.com/page-career')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-about-page+verified-contact-page+role-cards+same-domain-detail-pages+exclude-non-india-roles',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'workcohol.com')
  assert.match(provider.modulePath, /workcohol[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'WORKCOHOL'), false)
})

test('Workcohol resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'WORKCOHOL,\nWorkcohol,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['WORKCOHOL', 'workcohol', 'Workcohol'],
      ['Workcohol', 'workcohol', 'Workcohol'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'workcohol')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'workcohol')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.workcohol.com/page-career')
  assert.match(scraper.dryRunFile, /workcohol[\\/]jobs\.json$/i)
})
