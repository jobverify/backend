import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Numeros Motors is registered against the verified official open positions page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'numerosmotors')

  assert.ok(provider, 'Expected Numeros Motors provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Numeros Motors')
  assert.equal(provider.companyCareerPage, 'https://numerosmotors.com/open-positions/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-careers-page-plus-open-positions-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-careers-page+verified-open-positions-page+inline-job-cards+shared-onsite-apply-popup',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'numerosmotors.com')
  assert.match(provider.modulePath, /numerosmotors[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Numeros Motors'), false)
})

test('Numeros Motors matches coverage directly and buildScrapers exposes a runnable scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Numeros Motors,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Numeros Motors', 'numerosmotors', 'Numeros Motors']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'numerosmotors')

  assert.ok(scraper, 'Expected buildScrapers() to return the Numeros Motors scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'numerosmotors')
  assert.equal(scraper.provider.companyCareerPage, 'https://numerosmotors.com/open-positions/')
  assert.match(scraper.dryRunFile, /numerosmotors[\\/]jobs\.json$/i)
})
