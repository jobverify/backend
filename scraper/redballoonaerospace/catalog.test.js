import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Red Balloon Aerospace Private Limited is registered as a verified first-party resume-form sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'redballoonaerospace')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Red Balloon Aerospace Private Limited')
  assert.equal(provider.companyCareerPage, 'https://www.red-balloon.space/jobs/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-jobs-and-contact-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-jobs-resume-form+verified-contact-page-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'red-balloon.space')
  assert.match(provider.modulePath, /redballoonaerospace[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Red Balloon Aerospace Private Limited'),
    false,
  )
})

test('Red Balloon Aerospace Private Limited resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Red Balloon Aerospace Private Limited\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Red Balloon Aerospace Private Limited', 'redballoonaerospace', 'Red Balloon Aerospace Private Limited']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'redballoonaerospace')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'redballoonaerospace')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.red-balloon.space/jobs/')
  assert.match(scraper.dryRunFile, /redballoonaerospace[\\/]jobs\.json$/i)
})
