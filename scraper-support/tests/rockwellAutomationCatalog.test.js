import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('getScraperCatalog includes Rockwell Automation on the verified first-party careers page backed by Workday', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rockwellautomation')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Rockwell Automation')
  assert.equal(provider.companyCareerPage, 'https://www.rockwellautomation.com/en-us/careers.html')
  assert.equal(provider.companyDomain, 'rockwellautomation.com')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.baseUrl, /rockwellautomation\.wd1\.myworkdayjobs\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.rockwellautomation\.com\/en-us\/careers\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /rockwellautomation\.wd1\.myworkdayjobs\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Development Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /SAP SCM Consultant/i)
  assert.match(provider.verifiedSurfaceSummary, /AI Transformation Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /Bangalore, India|Bengaluru, India/i)
  assert.match(provider.verifiedSurfaceSummary, /Pune, India/i)
  assert.match(provider.verifiedSurfaceSummary, /Noida, India/i)
})

test('buildScrapers and company coverage resolve Rockwell Automation from the shared Workday catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rockwellautomation')
  const scraper = buildScrapers().find((item) => item.name === 'rockwellautomation')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(scraper.provider.source, 'rockwellautomation')
  assert.equal(scraper.provider.atsPlatform, 'workday')
  assert.match(scraper.dryRunFile, /rockwellautomation.workday[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nRockwell Automation\n',
    catalog: getScraperCatalog(),
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rockwell Automation', 'rockwellautomation', 'Rockwell Automation']],
  )
})

test('Rockwell Automation local Workday config uses the shared jobs API defaults with the India country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/rockwellautomation.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.countryFacetParameter,
    'locationCountry',
  )
  assert.equal(
    config.jobsApiUrl,
    'https://rockwellautomation.wd1.myworkdayjobs.com/wday/cxs/rockwellautomation/External_Rockwell_Automation/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://rockwellautomation.wd1.myworkdayjobs.com/External_Rockwell_Automation',
  )
})
