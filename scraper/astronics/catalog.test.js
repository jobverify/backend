import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Astronics registers current declared native boards without claiming complete company coverage', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'astronics')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Astronics Test Systems')
  assert.equal(provider.companyCareerPage, 'https://www.astronics.com/careers')
  assert.equal(provider.officialHomepageUrl, 'https://www.astronics.com/test-systems')
  assert.equal(provider.atsPlatform, 'current-declared-greenhouse-and-talentsoft-public-boards')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-current-native-Greenhouse-pages+France-all-offers+Canada-explicit-empty+final-inventories-after-closing-details')
  assert.equal(
    provider.extractionStrategy,
    'current-Test-Systems-employer-bridge+declared-shared-boards+all-native-country-alternatives+full-France-criteria+closing',
  )
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.sourceCompanyWideScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'astronics.com')
  assert.match(provider.modulePath, /astronics[\\/]script\.js$/i)
  assert.equal(
    companyAliases['Diagnosys Electronics (I) Pvt Ltd (ASTRONICS)'],
    'astronics',
  )
})

test('Astronics covers the Diagnosys CSV row through the alias map', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Diagnosys Electronics (I) Pvt Ltd (ASTRONICS)\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Diagnosys Electronics (I) Pvt Ltd (ASTRONICS)',
      'astronics',
      'Astronics Test Systems',
    ]],
  )
})

test('Astronics is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'astronics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'astronics')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.astronics.com/careers')
  assert.match(scraper.dryRunFile, /astronics[\\/]jobs\.json$/i)
})
