import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

const loadMagnaAutomotiveModule = async () => {
  try {
    return await import('../../scraper/magnaautomotive.workday/script.js')
  } catch {
    assert.fail('Expected Magna Automotive scraper module at ../../scraper/magnaautomotive.workday/script.js')
  }
}

test('getScraperCatalog includes Magna Automotive on the verified Magna careers page backed by first-party Workday', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'magnaautomotive')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Magna Automotive')
  assert.equal(provider.companyCareerPage, 'https://www.magna.com/careers')
  assert.equal(provider.companyDomain, 'magna.com')
  assert.match(provider.modulePath, /magnaautomotive\.workday[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Magna Automotive scraper without changing the runner contract', async () => {
  const magnaAutomotive = await loadMagnaAutomotiveModule()
  const scraper = buildScrapers().find((item) => item.name === 'magnaautomotive')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /magnaautomotive.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'magnaautomotive')
  assert.equal(scraper.provider.atsPlatform, 'workday')

  const options = magnaAutomotive.buildScraperOptions()
  assert.equal(magnaAutomotive.CAREER_PAGE_URL, 'https://www.magna.com/careers')
  assert.equal(magnaAutomotive.WORKDAY_BASE_URL, 'https://wd3.myworkdaysite.com/recruiting/magna/Magna')
  assert.equal(magnaAutomotive.WORKDAY_DETAIL_URL_BASE, 'https://wd3.myworkdaysite.com/en-US/recruiting/magna/Magna')
  assert.equal(magnaAutomotive.WORKDAY_JOBS_API_URL, 'https://wd3.myworkdaysite.com/wday/cxs/magna/Magna/jobs')
  assert.equal(magnaAutomotive.COMPANY_NAME, 'Magna Automotive')
  assert.equal(magnaAutomotive.SOURCE, 'magnaautomotive')
  assert.equal(options.company, 'Magna Automotive')
  assert.equal(options.baseUrl, 'https://wd3.myworkdaysite.com/recruiting/magna/Magna')
  assert.equal(options.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(options.source, 'magnaautomotive')
  assert.match(options.scraperDir, /magnaautomotive\.workday$/)
})

test('Magna Automotive coverage resolves the exact CSV row without aliases', async () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Magna Automotive,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Magna Automotive', 'magnaautomotive', 'Magna Automotive']],
  )
})
