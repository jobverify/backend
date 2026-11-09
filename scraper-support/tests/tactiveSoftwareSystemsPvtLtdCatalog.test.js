import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Tactive Software Systems Pvt. Ltd. is registered against the official first-party careers page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tactivesoftwaresystemspvtltd')

  assert.ok(provider, 'Expected Tactive Software Systems Pvt. Ltd. provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Tactive Software Systems Pvt. Ltd.')
  assert.equal(provider.companyCareerPage, 'https://www.tactivesoft.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-accordion-roles')
  assert.equal(
    provider.extractionStrategy,
    'official-current-openings-page+accordion-roles+shared-first-party-apply-anchor',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tactivesoft.com')
  assert.match(provider.modulePath, /tactivesoftwaresystemspvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Tactive Software Systems Pvt. Ltd.'), false)
})

test('Tactive Software Systems Pvt. Ltd. matches the backlog directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Tactive Software Systems Pvt. Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tactive Software Systems Pvt. Ltd.', 'tactivesoftwaresystemspvtltd', 'Tactive Software Systems Pvt. Ltd.']],
  )
})

test('Tactive Software Systems Pvt. Ltd. is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tactivesoftwaresystemspvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Tactive Software Systems Pvt. Ltd. scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'tactivesoftwaresystemspvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.tactivesoft.com/careers/')
  assert.match(scraper.dryRunFile, /tactivesoftwaresystemspvtltd[\\/]jobs\.json$/i)
})
