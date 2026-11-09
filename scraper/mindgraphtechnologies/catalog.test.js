import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'mindgraphtechnologies'
const COMPANY = 'Mindgraph Technologies'

test('Mindgraph Technologies is registered as a verified brochure-site no-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Mindgraph Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, 'https://mind-graph.com/')
  assert.deepEqual(provider.alternateCareerPages, [
    'https://mind-graph.com/careers',
    'https://mind-graph.com/careers/',
    'https://mind-graph.com/jobs',
    'https://mind-graph.com/jobs/',
    'https://mind-graph.com/join-us',
    'https://mind-graph.com/join-us/',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-bundle-route-table-plus-public-job-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-react-homepage+verified-route-table-without-jobs+verified-brochure-job-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mind-graph.com')
  assert.match(provider.modulePath, /mindgraphtechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Mindgraph Technologies resolves directly from provider metadata and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${COMPANY}\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Mindgraph Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, 'https://mind-graph.com/')
  assert.match(scraper.dryRunFile, /mindgraphtechnologies[\\/]jobs\.json$/i)
})
