import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Rinex Technologies is registered against the verified same-domain job pages with exact-company aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rinextechnologies')

  assert.ok(provider, 'Expected Rinex Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Rinex Technologies')
  assert.equal(provider.companyCareerPage, 'https://rinex.ai/career')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-shell-plus-main-bundle-plus-same-domain-job-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-shell+verified-main-jobs-bundle+bundle-discovered-same-domain-job-pages+external-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'rinex.ai')
  assert.match(provider.modulePath, /rinextechnologies[\\/]script\.js$/i)
  assert.equal(companyAliases['Rinex Technologies'], 'rinextechnologies')
  assert.equal(companyAliases['Rinex Technologies Private Limited'], 'rinextechnologies')
})

test('Rinex Technologies backlog rows resolve through the alias map and buildScrapers exposes the lane', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Rinex Technologies,\nRinex Technologies Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Rinex Technologies', 'rinextechnologies', 'Rinex Technologies'],
      ['Rinex Technologies Private Limited', 'rinextechnologies', 'Rinex Technologies'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'rinextechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Rinex Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'rinextechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://rinex.ai/career')
  assert.match(scraper.dryRunFile, /rinextechnologies[\\/]jobs\.json$/i)
})
