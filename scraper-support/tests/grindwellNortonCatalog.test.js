import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Grindwell Norton is registered against the verified official homepage with a LinkedIn-only careers handoff', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'grindwellnorton')

  assert.ok(provider, 'Expected Grindwell Norton provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Grindwell Norton')
  assert.equal(provider.companyCareerPage, 'https://www.grindwellnorton.co.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-official-homepage')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-linkedin-handoff-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'grindwellnorton.co.in')
  assert.match(provider.modulePath, /grindwellnorton[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Grindwell Norton'), false)
})

test('Grindwell Norton matches backlog coverage directly from provider metadata without adding an alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Grindwell Norton,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Grindwell Norton', 'grindwellnorton', 'Grindwell Norton']],
  )
})

test('Grindwell Norton is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'grindwellnorton')

  assert.ok(scraper, 'Expected buildScrapers() to return the Grindwell Norton scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'grindwellnorton')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.grindwellnorton.co.in/')
  assert.match(scraper.dryRunFile, /grindwellnorton[\\/]jobs\.json$/i)
})
