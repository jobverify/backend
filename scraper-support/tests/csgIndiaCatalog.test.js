import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../utils/loadConfig.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('registers CSG against the official first-party Workday careers source', () => {
  const catalog = getScraperCatalog()
  const csg = catalog.find((provider) => provider.source === 'csg')

  assert.ok(csg)
  assert.equal(csg.companyName, 'CSG')
  assert.equal(csg.adapter, 'workday')
  assert.equal(csg.atsPlatform, 'workday')
  assert.equal(csg.companyCareerPage, 'https://www.csgi.com/careers')
  assert.equal(csg.companyDomain, 'csgi.com')
  assert.match(csg.baseUrl, /csgi\.wd5\.myworkdayjobs\.com\/CSGCareers/i)

  const scraper = buildScrapers().find((candidate) => candidate.name === 'csg')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /csg.workday[\\/]jobs\.json$/)
})

test('uses the CSG Workday jobs API with complete-board native country proof', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/csg.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://csgi.wd5.myworkdayjobs.com/wday/cxs/csgi/CSGCareers/jobs',
  )
  assert.equal(config.detailUrlBase, 'https://csgi.wd5.myworkdayjobs.com/en-US/CSGCareers')
  assert.equal(config.locationCountry, null)
  assert.equal(config.searchText, '')
  assert.equal(config.inventoryScope, 'complete-board-country-proof')
  assert.equal(config.officialCareersUrl, 'https://www.csgi.com/careers')
})

test('company coverage resolves CSG India Pvt Ltd. to the CSG scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,CSG India Pvt Ltd.\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['CSG India Pvt Ltd.', 'csg']],
  )
  assert.equal(report.unmatchedCount, 0)
})
