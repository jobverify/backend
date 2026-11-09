import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Testpress is registered as a verified first-party careers sentinel with a safe legal-name alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'testpress')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Testpress Tech Labs')
  assert.equal(provider.companyCareerPage, 'https://testpress.tech/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers-nonlisting')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-and-careers-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-page+verified-careers-page+outbound-apply-handoff-without-public-job-records-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'testpress.tech')
  assert.match(provider.modulePath, /testpress[\\/]script\.js$/i)
  assert.equal(companyAliases['Testpress Tech Labs LLP'], 'testpress')
})

test('Testpress coverage resolves the official name and the backlog legal-name alias to the sentinel provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Testpress Tech Labs LLP,\nTestpress Tech Labs,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Testpress Tech Labs LLP', 'testpress', 'Testpress Tech Labs'],
      ['Testpress Tech Labs', 'testpress', 'Testpress Tech Labs'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'testpress')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'testpress')
  assert.equal(scraper.provider.companyCareerPage, 'https://testpress.tech/careers/')
  assert.match(scraper.dryRunFile, /testpress[\\/]jobs\.json$/i)
})
