import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Rappit is registered as a verified first-party vacancies scraper with Vanenburg legacy alias coverage', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rappit')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Rappit')
  assert.equal(provider.companyCareerPage, 'https://rappit.io/vacancies/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'single-current-vacancies-page-plus-first-party-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-rebrand-about-page+verified-careers-page+first-party-vacancy-links+first-party-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'rappit.io')
  assert.match(provider.modulePath, /rappit[\\/]script\.js$/i)
  assert.equal(companyAliases.Vanenburg, 'rappit')
})

test('Vanenburg resolves through alias coverage to the Rappit provider and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Vanenburg,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Vanenburg', 'rappit', 'Rappit']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'rappit')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'rappit')
  assert.equal(scraper.provider.companyCareerPage, 'https://rappit.io/vacancies/')
  assert.match(scraper.dryRunFile, /rappit[\\/]jobs\.json$/i)
})
