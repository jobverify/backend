import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Infobell IT Solutions Pvt.Ltd. as a first-party careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'infobellitsolutionspvtltd')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Infobell IT Solutions Pvt.Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.infobellit.com/careers.html')
  assert.equal(provider.companyDomain, 'infobellit.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-detail-pages')
  assert.equal(provider.extractionStrategy, 'html-job-cards+detail-pages+mailto-apply')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /infobellitsolutionspvtltd[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve the exact Infobell IT Solutions Pvt.Ltd. CSV row', () => {
  const scraper = buildScrapers().find((item) => item.name === 'infobellitsolutionspvtltd')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /infobellitsolutionspvtltd[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'infobellitsolutionspvtltd')

  const report = generateCompanyCoverageReport({
    csvText: 'Infobell IT Solutions Pvt.Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Infobell IT Solutions Pvt.Ltd.', 'infobellitsolutionspvtltd', 'Infobell IT Solutions Pvt.Ltd.']],
  )
})
