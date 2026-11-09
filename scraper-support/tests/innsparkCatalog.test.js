import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Innspark is registered against its verified first-party careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'innspark')

  assert.ok(provider, 'Expected Innspark provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Innspark')
  assert.equal(provider.companyCareerPage, 'https://innspark.in/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-official-careers-page')
  assert.equal(provider.extractionStrategy, 'official-careers-page+first-party-apply-form-role-validation')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'innspark.in')
  assert.match(provider.modulePath, /innspark[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Innspark'), false)
})

test('Innspark matches backlog coverage directly from provider metadata and is runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Innspark,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Innspark', 'innspark', 'Innspark']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'innspark')

  assert.ok(scraper, 'Expected buildScrapers() to return the Innspark scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'innspark')
  assert.equal(scraper.provider.companyCareerPage, 'https://innspark.in/careers/')
  assert.match(scraper.dryRunFile, /innspark[\\/]jobs\.json$/i)
})
