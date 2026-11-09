import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../utils/loadConfig.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('registers DBS Tech India against the official DBS Workday careers link', () => {
  const catalog = getScraperCatalog()
  const dbsTechIndia = catalog.find((provider) => provider.source === 'dbstechindia')

  assert.ok(dbsTechIndia)
  assert.equal(dbsTechIndia.companyName, 'DBS Tech India')
  assert.equal(dbsTechIndia.adapter, 'workday')
  assert.equal(dbsTechIndia.atsPlatform, 'workday')
  assert.equal(dbsTechIndia.companyCareerPage, 'https://www.dbs.com/dbstechindia/career.html')
  assert.equal(dbsTechIndia.companyDomain, 'dbs.com')
  assert.match(dbsTechIndia.baseUrl, /dbs\.wd3\.myworkdayjobs\.com\/DBS_Careers/i)

  const scraper = buildScrapers().find((candidate) => candidate.name === 'dbstechindia')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /dbstechindia.workday[\\/]jobs\.json$/)
})

test('uses the DBS Workday jobs API and its lower-camel-case India country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/dbstechindia.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://dbs.wd3.myworkdayjobs.com/wday/cxs/dbs/DBS_Careers/jobs',
  )
  assert.equal(config.detailUrlBase, 'https://dbs.wd3.myworkdayjobs.com/DBS_Careers')
  assert.equal(config.countryFacetParameter, 'locationCountry')
})

test('maps DBS Technology Services India coverage rows to the DBS Tech India scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name,url_in_text,note\n1,DBS Technology Services India Pvt. Ltd.,,',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'dbstechindia')
})
