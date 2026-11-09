import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCanvaModule = async () => {
  try {
    return await import('../../scraper/canva/script.js')
  } catch {
    assert.fail('Expected Canva scraper module at ../../scraper/canva/script.js')
  }
}

test('getScraperCatalog includes Canva as a verified first-party jobs-board scraper', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'canva')
  const canva = await loadCanvaModule()

  assert.ok(provider)
  assert.equal(provider.source, 'canva')
  assert.equal(provider.companyName, 'Canva')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.lifeatcanva.com/en/jobs/')
  assert.equal(provider.companyDomain, 'lifeatcanva.com')
  assert.equal(provider.atsPlatform, 'official-first-party-jobs-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'page-query-stop-on-http-denial')
  assert.equal(
    provider.extractionStrategy,
    'first-party-jobs-html+pagination+india-location-filter-with-unavailable-inventory-gap',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /canva[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /canva[\\/]jobs\.json$/i)

  assert.equal(canva.SOURCE, provider.source)
  assert.equal(canva.COMPANY, provider.companyName)
  assert.equal(canva.CAREERS_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve Canva from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'canva')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'canva')
  assert.match(scraper.dryRunFile, /canva[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Canva,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Canva', 'canva', 'Canva']],
  )
})
