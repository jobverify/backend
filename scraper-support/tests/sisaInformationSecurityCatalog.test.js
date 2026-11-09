import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('SISA Information Security is registered with its verified first-party careers metadata and exact aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sisainformationsecurity')

  assert.ok(provider, 'Expected SISA Information Security provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SISA Information Security')
  assert.equal(provider.companyCareerPage, 'https://www.sisa.ai/careers')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-keka-active-jobs-endpoint')
  assert.equal(provider.extractionStrategy, 'official-careers-page+embedded-keka-careers-page+careerportalinfo+jobdetails+applyjob')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sisa.ai')
  assert.match(provider.modulePath, /sisainformationsecurity[\\/]script\.js$/i)
  assert.equal(companyAliases['SISA Information Security Pvt Ltd'], 'sisainformationsecurity')
  assert.equal(companyAliases['SISA Information Security Pvt. Ltd.'], 'sisainformationsecurity')
})

test('SISA Information Security matches coverage for the exact CSV name and the exact portal legal name, and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'SISA Information Security,\nSISA Information Security Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['SISA Information Security', 'sisainformationsecurity', 'SISA Information Security'],
      ['SISA Information Security Pvt Ltd', 'sisainformationsecurity', 'SISA Information Security'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'sisainformationsecurity')

  assert.ok(scraper, 'Expected buildScrapers() to return the SISA Information Security scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sisainformationsecurity')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.sisa.ai/careers')
  assert.match(scraper.dryRunFile, /sisainformationsecurity[\\/]jobs\.json$/i)
})
