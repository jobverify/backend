import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('registers NCR Voyix against the official NCR Voyix careers page and Workday board', () => {
  const catalog = getScraperCatalog()
  const ncrVoyix = catalog.find((provider) => provider.source === 'ncrvoyix')

  assert.ok(ncrVoyix)
  assert.equal(ncrVoyix.companyName, 'NCR Voyix')
  assert.equal(ncrVoyix.adapter, 'workday')
  assert.equal(ncrVoyix.atsPlatform, 'workday')
  assert.equal(ncrVoyix.companyCareerPage, 'https://www.ncrvoyix.com/about/careers')
  assert.equal(ncrVoyix.companyDomain, 'ncrvoyix.com')
  assert.match(ncrVoyix.baseUrl, /ncr\.wd1\.myworkdayjobs\.com\/ext_apac/i)
})

test('maps NCR Corporation and NCR Voyix coverage rows to the single NCR Voyix provider', () => {
  assert.equal(companyAliases['NCR Corporation'], 'ncrvoyix')

  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name,url_in_text,note\n1,NCR Corporation,,\n2,NCR Voyix,,\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['NCR Corporation', 'ncrvoyix', 'NCR Voyix'],
      ['NCR Voyix', 'ncrvoyix', 'NCR Voyix'],
    ],
  )
})

test('buildScrapers exposes one runnable NCR Voyix Workday scraper with no duplicate NCR Corporation runner', () => {
  const ncrVoyix = getScraperCatalog().find((provider) => provider.source === 'ncrvoyix')
  const ncrCorporation = getScraperCatalog().find((provider) => provider.source === 'ncrcorporation')
  const scraper = buildScrapers().find((candidate) => candidate.name === 'ncrvoyix')

  assert.ok(ncrVoyix)
  assert.equal(ncrCorporation, undefined)

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ncrvoyix')
  assert.match(scraper.dryRunFile, /ncrvoyix.workday[\\/]jobs\.json$/)
})

test('NCR Voyix uses the verified Workday jobs API instead of the browser-only list flow', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/ncrvoyix.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://ncr.wd1.myworkdayjobs.com/wday/cxs/ncr/ext_apac/jobs',
  )
  assert.equal(config.detailUrlBase, 'https://ncr.wd1.myworkdayjobs.com/ext_apac')
  assert.match(config.locationPattern, /india|ind|chennai|hyderabad/i)
})
