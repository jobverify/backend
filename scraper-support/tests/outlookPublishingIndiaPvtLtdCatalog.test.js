import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Outlook Publishing India Pvt. Ltd. is registered as a verified first-party zero-job scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'outlookpublishingindiapvtltd')

  assert.ok(
    provider,
    'Expected Outlook Publishing India Pvt. Ltd. provider to be registered in customProviders.json',
  )
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Outlook Publishing India Pvt. Ltd.')
  assert.equal(provider.companyCareerPage, 'https://www.outlookindia.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-and-contact-validation-plus-common-careers-404-check')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-about-us+verified-contact-us+verified-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'outlookindia.com')
  assert.match(provider.modulePath, /outlookpublishingindiapvtltd[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Outlook Publishing India Pvt. Ltd.'),
    false,
  )
})

test('Outlook Publishing India Pvt. Ltd. matches backlog coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Outlook Publishing India Pvt. Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Outlook Publishing India Pvt. Ltd.',
      'outlookpublishingindiapvtltd',
      'Outlook Publishing India Pvt. Ltd.',
    ]],
  )
})

test('Outlook Publishing India Pvt. Ltd. is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'outlookpublishingindiapvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Outlook Publishing India Pvt. Ltd. scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'outlookpublishingindiapvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.outlookindia.com/')
  assert.match(scraper.dryRunFile, /outlookpublishingindiapvtltd[\\/]jobs\.json$/i)
})
