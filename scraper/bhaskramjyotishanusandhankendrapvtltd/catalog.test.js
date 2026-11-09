import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd is registered as a verified missing-first-party-surface sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bhaskramjyotishanusandhankendrapvtltd')

  assert.ok(
    provider,
    'Expected Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd provider to be registered in customProviders.json',
  )
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd')
  assert.equal(provider.companyCareerPage, 'https://bhaskramjyotishanusandhankendrapvtltd.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'candidate-first-party-host-resolution-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-unresolved-first-party-hosts-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'bhaskramjyotishanusandhankendrapvtltd.com')
  assert.match(provider.modulePath, /bhaskramjyotishanusandhankendrapvtltd[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd'),
    false,
  )
})

test('Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd',
      'bhaskramjyotishanusandhankendrapvtltd',
      'Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd',
    ]],
  )
})

test('Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bhaskramjyotishanusandhankendrapvtltd')

  assert.ok(
    scraper,
    'Expected buildScrapers() to return the Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd scraper',
  )
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'bhaskramjyotishanusandhankendrapvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://bhaskramjyotishanusandhankendrapvtltd.com/')
  assert.match(scraper.dryRunFile, /bhaskramjyotishanusandhankendrapvtltd[\\/]jobs\.json$/i)
})
