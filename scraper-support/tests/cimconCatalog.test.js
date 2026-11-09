import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

test('CIMCON Software India Pvt. Ltd. is registered as an official email-only careers scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'cimcon')

  assert.ok(provider)
  assert.equal(provider.companyName, 'CIMCON Software India Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://cimcon.com/about-us/careers/')
  assert.equal(provider.companyDomain, 'cimcon.com')
  assert.match(provider.modulePath, /cimcon[\\/]script\.js$/i)

  const scraper = buildScrapers().find((item) => item.name === 'cimcon')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})

test('company coverage resolves CIMCON Software India Pvt. Ltd. to the CIMCON scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name,url_in_text,note\n1,CIMCON Software India Pvt. Ltd.,,',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['CIMCON Software India Pvt. Ltd.', 'cimcon'],
  ])
})
