import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Pragya Refrigeration and Electricals Private Limited is registered as a first-party careers scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pragyarefrigerationandelectricalsprivatelimited')

  assert.ok(provider, 'Expected Pragya Refrigeration and Electricals Private Limited provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Pragya Refrigeration and Electricals Private Limited')
  assert.equal(provider.companyCareerPage, 'https://pragyarefrigeration.in/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-wordpress-page-json-endpoint')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+wordpress-json-page-api+inline-role-sections',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'pragyarefrigeration.in')
  assert.match(provider.modulePath, /pragyarefrigerationandelectricalsprivatelimited[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Pragya Refrigeration and Electricals Private Limited'),
    false,
  )
})

test('Pragya Refrigeration and Electricals Private Limited matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Pragya Refrigeration and Electricals Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Pragya Refrigeration and Electricals Private Limited',
      'pragyarefrigerationandelectricalsprivatelimited',
      'Pragya Refrigeration and Electricals Private Limited',
    ]],
  )
})

test('Pragya Refrigeration and Electricals Private Limited is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'pragyarefrigerationandelectricalsprivatelimited')

  assert.ok(scraper, 'Expected buildScrapers() to return the Pragya Refrigeration and Electricals Private Limited scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'pragyarefrigerationandelectricalsprivatelimited')
  assert.equal(scraper.provider.companyCareerPage, 'https://pragyarefrigeration.in/careers/')
  assert.match(scraper.dryRunFile, /pragyarefrigerationandelectricalsprivatelimited[\\/]jobs\.json$/i)
})
