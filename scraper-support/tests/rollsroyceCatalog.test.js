import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Rolls Royce as an official apiPortal provider with exact CSV coverage', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rollsroyce')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'connectid-jobs-api')
  assert.equal(provider.companyName, 'Rolls Royce')
  assert.equal(provider.companyCareerPage, 'https://careers.rolls-royce.com/en/jobs')
  assert.equal(provider.companyDomain, 'careers.rolls-royce.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.config.auth.tokenUrl, 'https://rollsroyceats-prod-api.connectid.cloud/auth/gettoken')
  assert.equal(
    provider.config.discovery.listingApiUrl,
    'https://rollsroyceats-prod-api.connectid.cloud/api/jobs',
  )
  assert.deepEqual(provider.config.request.query, {
    perPage: '10',
    primaryCountry: 'India',
  })
})

test('buildScrapers and company coverage resolve the exact Rolls Royce CSV name without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'rollsroyce')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /rollsroyce[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'rollsroyce')

  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Rolls Royce\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['Rolls Royce', 'rollsroyce', 'rollsroyce']],
  )
  assert.equal(report.unmatchedCount, 0)
})
