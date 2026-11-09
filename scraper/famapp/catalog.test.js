import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('FamApp is registered as a first-party Lever jobs scraper with Fam alias coverage', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'famapp')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'FamApp by Trio')
  assert.equal(provider.companyCareerPage, 'https://www.famapp.in/jobs/')
  assert.equal(provider.atsPlatform, 'lever')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'lever-skip-limit-reconciled-with-grouped-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage+careers+jobs-client-handoff+public-lever-feed',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'famapp.in')
  assert.match(provider.modulePath, /famapp[\\/]script\.js$/i)
  assert.equal(companyAliases.Fam, 'famapp')
})

test('Fam resolves through company coverage to the FamApp Lever provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Fam,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fam', 'famapp', 'FamApp by Trio']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'famapp')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'famapp')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.famapp.in/jobs/')
  assert.match(scraper.dryRunFile, /famapp[\\/]jobs\.json$/i)
})
