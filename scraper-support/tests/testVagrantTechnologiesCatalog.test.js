import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

test('getScraperCatalog includes TestVagrant Technologies as an official Zoho Recruit script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'testvagranttechnologies')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.companyName, 'TestVagrant Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.testvagrant.com/careers/')
  assert.equal(provider.companyDomain, 'testvagrant.com')
  assert.match(provider.modulePath, /testvagranttechnologies[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable TestVagrant Technologies scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'testvagranttechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'testvagranttechnologies')
  assert.equal(scraper.provider.atsPlatform, 'zohorecruit')
  assert.match(scraper.dryRunFile, /testvagranttechnologies[\\/]jobs\.json$/i)
})

test('company coverage resolves the exact CSV company name TestVagrant Technologies without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,TestVagrant Technologies\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['TestVagrant Technologies', 'testvagranttechnologies', 'testvagranttechnologies']],
  )
  assert.equal(report.unmatchedCount, 0)
})
