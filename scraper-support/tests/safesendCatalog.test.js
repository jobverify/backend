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

const currentDir = path.dirname(fileURLToPath(import.meta.url))

test('getScraperCatalog includes SafeSend on the official Thomson Reuters Workday board linked from SafeSend careers', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'safesend')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'SafeSend')
  assert.equal(provider.companyCareerPage, 'https://safesend.com/about/careers/')
  assert.equal(provider.companyDomain, 'safesend.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.match(
    provider.baseUrl,
    /thomsonreuters\.wd5\.myworkdayjobs\.com\/en-US\/External_Career_Site/i,
  )
})

test('buildScrapers and company coverage resolve SafeSend to a runnable Workday source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'safesend')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /safesend.workday[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'safesend')

  const report = generateCompanyCoverageReport({
    csvText: 'SafeSend,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SafeSend', 'safesend', 'SafeSend']],
  )
})

test('SafeSend Workday local config uses the public Thomson Reuters jobs API with the India country facet', () => {
  const config = loadConfig(path.resolve(currentDir, '../../scraper/safesend.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://thomsonreuters.wd5.myworkdayjobs.com/wday/cxs/thomsonreuters/External_Career_Site/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://thomsonreuters.wd5.myworkdayjobs.com/en-US/External_Career_Site',
  )
  assert.equal(config.countryFacetParameter, 'Location_Country')
})
