import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Feedback Infra Pvt Ltd as a verified official careers external-handoff scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'feedbackinfrapvtltd')

  assert.ok(provider, 'Expected Feedback Infra Pvt Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Feedback Infra Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://www.feedbackinfra.com/career.php')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-homepage-plus-careers-handoff-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-careers-page+external-naukri-handoff-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'feedbackinfra.com')
  assert.match(provider.modulePath, /feedbackinfrapvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Feedback Infra Pvt Ltd'), false)
})

test('Feedback Infra Pvt Ltd is runnable through the provider catalog and matches coverage without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'feedbackinfrapvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Feedback Infra Pvt Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'feedbackinfrapvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.feedbackinfra.com/career.php')
  assert.match(scraper.dryRunFile, /feedbackinfrapvtltd[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Feedback Infra Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Feedback Infra Pvt Ltd', 'feedbackinfrapvtltd', 'Feedback Infra Pvt Ltd']],
  )
})
