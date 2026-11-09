import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Cloud Ambassadors is registered with its official public careers page', () => {
  const catalog = getScraperCatalog()
  const cloudAmbassadors = catalog.find((provider) => provider.source === 'cloudambassadors')

  assert.ok(cloudAmbassadors)
  assert.equal(cloudAmbassadors.companyName, 'Cloud Ambassadors')
  assert.equal(cloudAmbassadors.adapter, 'script')
  assert.equal(cloudAmbassadors.atsPlatform, 'official-company-careers')
  assert.equal(cloudAmbassadors.companyCareerPage, 'https://cloudambassadors.com/careers')
  assert.equal(cloudAmbassadors.companyDomain, 'cloudambassadors.com')
  assert.equal(cloudAmbassadors.paginationStrategy, 'single-static-careers-page')
  assert.equal(cloudAmbassadors.extractionStrategy, 'html-open-role-buttons+shared-application-form')

  const scraper = buildScrapers().find((item) => item.name === 'cloudambassadors')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})

test('company coverage resolves Cloud Ambassadors to its scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Cloud Ambassadors\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['Cloud Ambassadors', 'cloudambassadors']],
  )
})
