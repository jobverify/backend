import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Urban Company is registered in the provider catalog with the verified first-party jobs API metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'urbancompany')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Urban Company')
  assert.equal(provider.companyCareerPage, 'https://careers.urbancompany.com/jobs')
  assert.equal(provider.jobsApiUrl, 'https://www.urbanclap.com/api/v2/platform-gateway/getAllJobs')
  assert.equal(provider.atsPlatform, 'official-first-party-jobs-api')
  assert.equal(provider.companyDomain, 'urbancompany.com')
})

test('Urban Company resolves directly from company coverage and remains runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nUrban Company\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.matched[0]?.source, 'urbancompany')

  const scraper = buildScrapers().find((item) => item.name === 'urbancompany')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /urbancompany[\\/]jobs\.json$/i)
})
