import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Vofox is registered as a verified first-party careers scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'vofox')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Vofox Solutions Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://vofoxsolutions.com/career-at-vofox')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-shared-apply-form')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-about-page+verified-contact-page+inline-role-sections+shared-resume-upload-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'vofoxsolutions.com')
  assert.match(provider.modulePath, /vofox[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Vofox'), false)
})

test('Vofox resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Vofox,\nVofox Solutions Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Vofox', 'vofox', 'Vofox Solutions Pvt Ltd'],
      ['Vofox Solutions Pvt Ltd', 'vofox', 'Vofox Solutions Pvt Ltd'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'vofox')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'vofox')
  assert.equal(scraper.provider.companyCareerPage, 'https://vofoxsolutions.com/career-at-vofox')
  assert.match(scraper.dryRunFile, /vofox[\\/]jobs\.json$/i)
})
