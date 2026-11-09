import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Turing Global India Private Limited is registered against the official Turing careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'turingglobalindia')

  assert.ok(provider, 'Expected Turing Global India provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Turing Global India Private Limited')
  assert.equal(provider.companyCareerPage, 'https://careers.turing.com/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'careers-landing-plus-open-roles-route')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-landing-plus-zero-open-roles-surface',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'turing.com')
  assert.match(provider.modulePath, /turingglobalindia[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Turing Global India Private Limited'),
    false,
  )
})

test('Turing Global India Private Limited matches directly from provider metadata without a new alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: [
      'Turing Global India Private Limited,',
      'Turing Global India Pvt Ltd,',
    ].join('\n'),
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      [
        'Turing Global India Private Limited',
        'turingglobalindia',
        'Turing Global India Private Limited',
      ],
      [
        'Turing Global India Pvt Ltd',
        'turingglobalindia',
        'Turing Global India Private Limited',
      ],
    ],
  )
})

test('Turing Global India Private Limited is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'turingglobalindia')

  assert.ok(scraper, 'Expected buildScrapers() to return the Turing Global India scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'turingglobalindia')
  assert.equal(scraper.provider.companyCareerPage, 'https://careers.turing.com/')
  assert.match(scraper.dryRunFile, /turingglobalindia[\\/]jobs\.json$/i)
})
