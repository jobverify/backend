import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Namaah Pvt Ltd as a verified no-public-careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'namaahpvtltd')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Namaah Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyCareerPage, 'https://namaah.co.in/')
  assert.equal(provider.companyDomain, 'namaah.co.in')
  assert.match(provider.modulePath, /namaahpvtltd[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Namaah Pvt Ltd scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'namaahpvtltd')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /namaahpvtltd[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'namaahpvtltd')
})

test('generateCompanyCoverageReport resolves the CSV row Namaah Pvt Ltd to the Namaah scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Namaah Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [
      item.companyName,
      item.source,
      item.provider?.companyName ?? null,
    ]),
    [['Namaah Pvt Ltd', 'namaahpvtltd', 'Namaah Pvt Ltd']],
  )
})
