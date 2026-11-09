import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Vistex is registered as a verified first-party UKG handoff sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'vistex')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Vistex')
  assert.equal(provider.companyCareerPage, 'https://www.vistex.com/careers/careers-in-india/')
  assert.equal(provider.atsPlatform, 'ukg-ultipro-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-and-india-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-india-careers-page+verified-about-page+verified-contact-page+verified-ultipro-board-handoff-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'vistex.com')
  assert.match(provider.modulePath, /vistex[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Vistex India Pvt Ltd'), false)
})

test('Vistex resolves the CSV row through provider normalization and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Vistex India Pvt Ltd,\nVistex,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Vistex India Pvt Ltd', 'vistex', 'Vistex'],
      ['Vistex', 'vistex', 'Vistex'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'vistex')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'vistex')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.vistex.com/careers/careers-in-india/')
  assert.match(scraper.dryRunFile, /vistex[\\/]jobs\.json$/i)
})
