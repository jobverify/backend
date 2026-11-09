import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

test('getScraperCatalog includes Elsevier on the official Workday tenant linked from its website', () => {
  const catalog = getScraperCatalog()
  const elsevier = catalog.find((provider) => provider.source === 'elsevier')

  assert.ok(elsevier)
  assert.equal(elsevier.adapter, 'workday')
  assert.equal(elsevier.atsPlatform, 'workday')
  assert.equal(elsevier.companyName, 'Elsevier')
  assert.equal(elsevier.companyCareerPage, 'https://www.elsevier.com/about/careers')
  assert.equal(elsevier.companyDomain, 'elsevier.com')
  assert.match(elsevier.baseUrl, /relx\.wd3\.myworkdayjobs\.com\/ElsevierJobs/i)
})

test('buildScrapers exposes a runnable Elsevier Workday scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const elsevier = scrapers.find((scraper) => scraper.name === 'elsevier')

  assert.ok(elsevier)
  assert.equal(typeof elsevier.run, 'function')
  assert.match(elsevier.dryRunFile, /elsevier.workday[\\/]jobs\.json$/)
  assert.equal(elsevier.provider.source, 'elsevier')
  assert.equal(elsevier.provider.atsPlatform, 'workday')
})

test('company coverage resolves Elsevier from the CSV against the official Workday-backed scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Elsevier\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['Elsevier', 'elsevier']],
  )
  assert.equal(report.unmatchedCount, 0)
})
