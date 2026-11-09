import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Great Learning is registered in the provider catalog with the verified first-party form metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'greatlearning')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'Great Learning')
  assert.equal(provider.companyCareerPage, 'https://www.mygreatlearning.com/careers')
  assert.equal(provider.officialSiteUrl, 'https://www.mygreatlearning.com/')
  assert.equal(provider.darwinboxOrigin, 'https://greatlearning.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(
    provider.publicAllJobsUrl,
    'https://greatlearning.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(provider.companyDomain, 'mygreatlearning.com')
  assert.equal(provider.paginationStrategy, 'single-first-party-openings-list')
  assert.equal(
    provider.extractionStrategy,
    'native-own-role-pages+whole-html-and-jsonld+exact-office-country-relations+opening-closing',
  )
  assert.match(provider.modulePath, /greatlearning[\\/]script\.js$/i)
})

test('Great Learning resolves through company coverage and remains runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nGreat Learning\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.matched[0]?.source, 'greatlearning')

  const scraper = buildScrapers().find((item) => item.name === 'greatlearning')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /greatlearning[\\/]jobs\.json$/i)
})
