import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('DEITEL Engineering Solutions LLP is registered against the verified first-party careers page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'deitelengineeringsolutionsllp')

  assert.ok(provider, 'Expected DEITEL Engineering Solutions LLP provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'DEITEL Engineering Solutions LLP')
  assert.equal(provider.companyCareerPage, 'https://deitel.in/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+inline-role-list+resume-email',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'deitel.in')
  assert.match(provider.modulePath, /deitelengineeringsolutionsllp[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'DEITEL Engineering Solutions LLP'), false)
})

test('DEITEL Engineering Solutions LLP matches coverage directly and buildScrapers exposes a runnable scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'DEITEL Engineering Solutions LLP,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DEITEL Engineering Solutions LLP', 'deitelengineeringsolutionsllp', 'DEITEL Engineering Solutions LLP']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'deitelengineeringsolutionsllp')

  assert.ok(scraper, 'Expected buildScrapers() to return the DEITEL Engineering Solutions LLP scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'deitelengineeringsolutionsllp')
  assert.equal(scraper.provider.companyCareerPage, 'https://deitel.in/career/')
  assert.match(scraper.dryRunFile, /deitelengineeringsolutionsllp[\\/]jobs\.json$/i)
})
