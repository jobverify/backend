import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Paramtech Cad Services Pvt. Ltd. is registered as a verified first-party zero-public-jobs careers sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'paramtechcadservicespvtltd')

  assert.ok(provider, 'Expected Paramtech Cad Services Pvt. Ltd. provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Paramtech Cad Services Pvt. Ltd.')
  assert.equal(provider.companyCareerPage, 'https://www.paramtechnologies.in/career.php')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-plus-contact-plus-single-public-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about+verified-contact+verified-empty-careers-shell-zero-public-job-listings',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'paramtechnologies.in')
  assert.match(provider.modulePath, /paramtechcadservicespvtltd[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Paramtech Cad Services Pvt. Ltd.'),
    false,
  )
})

test('Paramtech Cad Services Pvt. Ltd. matches backlog coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Paramtech Cad Services Pvt. Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Paramtech Cad Services Pvt. Ltd.', 'paramtechcadservicespvtltd', 'Paramtech Cad Services Pvt. Ltd.']],
  )
})

test('Paramtech Cad Services Pvt. Ltd. is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'paramtechcadservicespvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Paramtech Cad Services Pvt. Ltd. scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'paramtechcadservicespvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.paramtechnologies.in/career.php')
  assert.match(scraper.dryRunFile, /paramtechcadservicespvtltd[\\/]jobs\.json$/i)
})
