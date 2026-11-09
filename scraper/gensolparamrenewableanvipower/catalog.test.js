import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Gensol Param Renewable / Gensol-Anvi Power is registered as a verified first-party no-public-careers sentinel with family aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'gensolparamrenewableanvipower')

  assert.ok(provider, 'Expected Gensol family provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Gensol Param Renewable / Gensol-Anvi Power')
  assert.equal(provider.companyCareerPage, 'https://www.gensol.in/')
  assert.deepEqual(provider.alternateCareerPages, [
    'https://www.gensol.in/careers',
    'https://www.gensol.in/jobs',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'gensol.in')
  assert.match(provider.modulePath, /gensolparamrenewableanvipower[\\/]script\.js$/i)
  assert.equal(companyAliases['Gensol Param Renewable'], 'gensolparamrenewableanvipower')
  assert.equal(companyAliases['Gensol-Anvi Power'], 'gensolparamrenewableanvipower')
})

test('Gensol Param Renewable and Gensol-Anvi Power resolve from provider metadata and stay runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Gensol Param Renewable,\nGensol-Anvi Power,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Gensol Param Renewable', 'gensolparamrenewableanvipower', 'Gensol Param Renewable / Gensol-Anvi Power'],
      ['Gensol-Anvi Power', 'gensolparamrenewableanvipower', 'Gensol Param Renewable / Gensol-Anvi Power'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'gensolparamrenewableanvipower')

  assert.ok(scraper, 'Expected buildScrapers() to return the Gensol family sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'gensolparamrenewableanvipower')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.gensol.in/')
  assert.match(scraper.dryRunFile, /gensolparamrenewableanvipower[\\/]jobs\.json$/i)
})
