import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('WhiteMatrix is registered as a LinkedIn-backed zero-jobs sentinel with the White Matrix alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'whitematrix')

  assert.ok(provider, 'Expected WhiteMatrix provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'WhiteMatrix')
  assert.equal(provider.companyCareerPage, 'https://www.linkedin.com/company/whitematrix/')
  assert.equal(provider.atsPlatform, 'linkedin-guest-search')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'single-public-company-jobs-page')
  assert.equal(provider.extractionStrategy, 'public-company-page+guest-search-empty-results')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'chainide.com')
  assert.match(provider.modulePath, /whitematrix[\\/]script\.js$/i)
  assert.equal(companyAliases['White Matrix'], 'whitematrix')
})

test('WhiteMatrix resolves both CSV spellings through company coverage and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'White Matrix,\nWhiteMatrix,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['White Matrix', 'whitematrix', 'WhiteMatrix'],
      ['WhiteMatrix', 'whitematrix', 'WhiteMatrix'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'whitematrix')

  assert.ok(scraper, 'Expected buildScrapers() to return the WhiteMatrix scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'whitematrix')
  assert.equal(scraper.provider.companyName, 'WhiteMatrix')
  assert.match(scraper.dryRunFile, /whitematrix[\\/]jobs\.json$/i)
})
