import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Detect Technologies is registered as an official careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'detecttechnologies')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Detect Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://detecttechnologies.com/current-openings/')
  assert.equal(provider.companyDomain, 'detecttechnologies.com')
  assert.match(provider.modulePath, /detecttechnologies[\\/]script\.js$/i)

  const scraper = buildScrapers().find((item) => item.name === 'detecttechnologies')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})

test('company coverage resolves Detect Technologies to the official scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name,url_in_text,note\n1,Detect Technologies,,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'detecttechnologies')
  assert.equal(
    report.matched[0].provider.companyCareerPage,
    'https://detecttechnologies.com/current-openings/',
  )
})
