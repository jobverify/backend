import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'
import {
  BASE_URL,
  COMPANY_NAME,
  SOURCE,
  buildScraperOptions,
  run,
} from './script.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const scraperDir = path.dirname(fileURLToPath(import.meta.url))
const companyCsvText = "company_name\nTricentis\n"

test('resolves only the literal Tricentis CSV name to its official Workday provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: companyCsvText,
    catalog: getScraperCatalog(),
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nTricentis India\nTricentis Technologies\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched
      .filter((item) => item.companyName === 'Tricentis')
      .map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tricentis', 'tricentis', 'Tricentis']],
  )
  assert.equal(nearNameReport.matchedCount, 0)
  assert.equal(nearNameReport.unmatchedCount, 2)
})

test('loads the verified Tricentis Workday jobs API configuration', () => {
  const config = loadConfig(scraperDir)

  assert.equal(COMPANY_NAME, 'Tricentis')
  assert.equal(SOURCE, 'tricentis')
  assert.equal(BASE_URL, 'https://tricentis.wd1.myworkdayjobs.com/en-US/Tricentis_Careers')
  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://tricentis.wd1.myworkdayjobs.com/wday/cxs/tricentis/Tricentis_Careers/jobs',
  )
  assert.equal(config.detailUrlBase, 'https://tricentis.wd1.myworkdayjobs.com/Tricentis_Careers')
  assert.equal(config.locationCountry, null)
})

test('run delegates to the Workday engine with the Tricentis identity', async () => {
  const calls = []
  const jobs = await run({
    workdayRunner: async (options) => {
      calls.push(options)
      return [{ title: 'Senior Software Engineer' }]
    },
  })

  assert.deepEqual(jobs, [{ title: 'Senior Software Engineer' }])
  assert.deepEqual(calls, [buildScraperOptions()])
})
