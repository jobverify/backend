import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCheckPointIndiaModule = async () => {
  try {
    return await import('../../scraper/checkpointindia/script.js')
  } catch {
    assert.fail('Expected Check Point India scraper module at ../../scraper/checkpointindia/script.js')
  }
}

test('getScraperCatalog includes Check Point India as a verified SmartRecruiters script provider', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'checkpointindia')
  const checkpointindia = await loadCheckPointIndiaModule()

  assert.ok(provider)
  assert.equal(provider.source, 'checkpointindia')
  assert.equal(provider.companyName, 'Check Point India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.checkpoint.com/careers/')
  assert.equal(provider.companyDomain, 'checkpoint.com')
  assert.equal(provider.atsPlatform, 'smartrecruiters')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-india-search-plus-smartrecruiters-offset-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-landing+verified-india-search+official-detail-handoff+smartrecruiters-india-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /checkpointindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /checkpointindia[\\/]jobs\.json$/i)

  assert.equal(checkpointindia.SOURCE, provider.source)
  assert.equal(checkpointindia.COMPANY, provider.companyName)
  assert.equal(checkpointindia.OFFICIAL_CAREERS_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve Check Point India from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'checkpointindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'checkpointindia')
  assert.match(scraper.dryRunFile, /checkpointindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Check Point India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Check Point India', 'checkpointindia', 'Check Point India']],
  )
})
