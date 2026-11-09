import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadModule = async () => {
  try {
    return await import('../../scraper/croma/script.js')
  } catch {
    assert.fail('Expected Croma scraper module at ../../scraper/croma/script.js')
  }
}

test('getScraperCatalog includes Croma as a verified first-party recruiter-handoff sentinel', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'croma')
  const croma = await loadModule()

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Croma')
  assert.equal(provider.companyCareerPage, 'https://www.croma.com/careers-at-croma/')
  assert.equal(provider.atsPlatform, 'official-company-careers-empty-shell')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'careers-landing-plus-current-openings-contact-handoff')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-landing+verified-current-openings-recruiter-handoff-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'croma.com')
  assert.match(provider.modulePath, /croma[\\/]script\.js$/i)

  assert.equal(croma.SOURCE, provider.source)
  assert.equal(croma.COMPANY, provider.companyName)
  assert.equal(croma.CAREERS_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve Croma rows from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'croma')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'croma')
  assert.match(scraper.dryRunFile, /croma[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Croma,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Croma', 'croma', 'Croma']],
  )
})
