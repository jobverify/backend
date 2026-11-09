import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCastrolIndiaModule = async () => {
  try {
    return await import('../../scraper/castrolindia/script.js')
  } catch {
    assert.fail('Expected Castrol India scraper module at ../../scraper/castrolindia/script.js')
  }
}

test('getScraperCatalog includes Castrol India as a verified careers handoff to Greenhouse', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'castrolindia')
  const castrolIndia = await loadCastrolIndiaModule()

  assert.ok(provider)
  assert.equal(provider.source, 'castrolindia')
  assert.equal(provider.companyName, 'Castrol India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.castrol.com/en_in/india/home/about-castrol/careers.html')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.eu.greenhouse.io/castrol')
  assert.equal(provider.greenhouseJobsUrl, 'https://boards-api.greenhouse.io/v1/boards/castrol/jobs?content=true')
  assert.equal(provider.companyDomain, 'castrol.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'native-public-GH-meta.total-reconciled-with-unfiltered-board-total+stable-final-full-feed')
  assert.equal(
    provider.extractionStrategy,
    'current-official-EU-Greenhouse-handoff+complete-public-GH-API+native-office-hierarchy+full-native-role-content+unchanged-shared-GH-mapping',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedAt, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.jobsBoardUrl, 'https://job-boards.eu.greenhouse.io/castrol')
  assert.match(provider.verifiedSurfaceSummary, /Current inventory counts are not stored/i)
  assert.match(provider.modulePath, /castrolindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /castrolindia[\\/]jobs\.json$/i)

  assert.equal(castrolIndia.SOURCE, provider.source)
  assert.equal(castrolIndia.COMPANY, provider.companyName)
  assert.equal(castrolIndia.CAREERS_PAGE_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve Castrol India from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'castrolindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'castrolindia')
  assert.match(scraper.dryRunFile, /castrolindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Castrol India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Castrol India', 'castrolindia', 'Castrol India']],
  )
})
