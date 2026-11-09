import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCyberArkIndiaModule = async () => {
  try {
    return await import('../../scraper/cyberarkindia/script.js')
  } catch {
    assert.fail('Expected CyberArk India scraper module at ../../scraper/cyberarkindia/script.js')
  }
}

test('getScraperCatalog includes CyberArk India as a verified parent-handoff sentinel', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cyberarkindia')
  const cyberArkIndia = await loadCyberArkIndiaModule()

  assert.ok(provider)
  assert.equal(provider.source, 'cyberarkindia')
  assert.equal(provider.companyName, 'CyberArk India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.cyberark.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers-handoff-to-shared-parent-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-careers-handoff-plus-parent-india-page-and-filtered-search-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-cyberark-careers-handoff+verified-pan-india-pages-without-cyberark-specific-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'cyberark.com')
  assert.equal(provider.workspaceDomain, 'jobs.paloaltonetworks.com')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /paloaltonetworks\.com\/idira/i)
  assert.match(provider.verifiedSurfaceSummary, /jobs\.paloaltonetworks\.com\/en\//i)
  assert.match(provider.modulePath, /cyberarkindia[\\/]script\.js$/i)

  assert.equal(cyberArkIndia.SOURCE, provider.source)
  assert.equal(cyberArkIndia.COMPANY, provider.companyName)
  assert.equal(cyberArkIndia.CYBERARK_CAREERS_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve CyberArk India from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cyberarkindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cyberarkindia')
  assert.match(scraper.dryRunFile, /cyberarkindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'CyberArk India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CyberArk India', 'cyberarkindia', 'CyberArk India']],
  )
})
