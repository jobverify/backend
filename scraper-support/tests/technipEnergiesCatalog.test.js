import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Technip Energies as an Oracle Cloud script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'technipenergies')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Technip Energies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.companyCareerPage, 'https://hcxg.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(provider.extractionStrategy, 'oracle-cloud-finder-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'hcxg.fa.em2.oraclecloud.com')
  assert.match(provider.modulePath, /technipenergies[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Technip Energies to the technipenergies source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'technipenergies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /technipenergies[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'technipenergies')

  const report = generateCompanyCoverageReport({
    csvText: 'Technip Energies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Technip Energies', 'technipenergies', 'Technip Energies']],
  )
})
