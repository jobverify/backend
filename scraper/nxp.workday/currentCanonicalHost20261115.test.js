import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'
import { inferWorkdayJobsApiConfig } from '../../scraper-support/myworkday/engine.js'

test('NXP follows its current official canonical Workday host through listing and detail URLs', () => {
  const provider = getScraperCatalog().find(row => row.source === 'nxp')
  assert.equal(provider.baseUrl, 'https://nxp.myworkdayjobs.com/careers')
  assert.deepEqual(inferWorkdayJobsApiConfig(provider.baseUrl), {
    jobsApiUrl: 'https://nxp.myworkdayjobs.com/wday/cxs/nxp/careers/jobs',
    detailUrlBase: 'https://nxp.myworkdayjobs.com/careers',
  })
  assert.equal(provider.companyCareerPage, 'https://www.nxp.com/company/about-nxp/careers:CAREERS')
})
