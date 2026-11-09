import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadChetuModule = async () => {
  try {
    return await import('../../scraper/chetu/script.js')
  } catch {
    assert.fail('Expected Chetu scraper module at ../../scraper/chetu/script.js')
  }
}

test('getScraperCatalog includes Chetu as a verified first-party feed scraper', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'chetu')
  assert.equal(provider.source, 'chetu')
  assert.equal(provider.companyName, 'Chetu')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.chetu.com/')
  assert.equal(provider.companyDomain, 'careers.chetu.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-first-party-json-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-csrf-session-first-party-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-shell+csrf-cookie-session+first-party-data-fetch+applicant-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /chetu[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /chetu[\\/]jobs\.json$/i)

  const chetu = await loadChetuModule()
  assert.equal(typeof chetu.createChetuScraper, 'function')
  assert.equal(typeof chetu.run, 'function')
  assert.equal(chetu.SOURCE, provider.source)
  assert.equal(chetu.COMPANY, provider.companyName)
  assert.equal(chetu.CAREERS_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve Chetu from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'chetu')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'chetu')
  assert.match(scraper.dryRunFile, /chetu[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Chetu,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Chetu', 'chetu', 'Chetu']],
  )
})
