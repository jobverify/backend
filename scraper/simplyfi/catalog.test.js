import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('SimplyFI is registered as a verified first-party zero-public-careers sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'simplyfi')

  assert.ok(provider, 'Expected SimplyFI provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SimplyFI Softech Pvt. Ltd.')
  assert.equal(provider.companyCareerPage, 'https://www.simplyfi.tech/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'simplyfi.tech')
  assert.match(provider.modulePath, /simplyfi[\\/]script\.js$/i)
})

test('SimplyFI resolves through company coverage and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'SimplyFI Softech Pvt. Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SimplyFI Softech Pvt. Ltd.', 'simplyfi', 'SimplyFI Softech Pvt. Ltd.']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'simplyfi')

  assert.ok(scraper, 'Expected buildScrapers() to return the SimplyFI scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'simplyfi')
  assert.equal(scraper.provider.companyName, 'SimplyFI Softech Pvt. Ltd.')
  assert.match(scraper.dryRunFile, /simplyfi[\\/]jobs\.json$/i)
})
