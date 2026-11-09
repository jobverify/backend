import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('XTO10X resolves exactly and reports unavailable recruiting as a coverage gap', async () => {
  const catalog = getScraperCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,XTO10X\n',
    catalog,
  })
  const scraper = buildScrapers().find((item) => item.name === 'xto10x')

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['XTO10X', 'xto10x']],
  )
  assert.equal(report.unmatchedCount, 0)
  assert.ok(scraper, 'Expected an exact XTO10X scraper registration')
  assert.equal(scraper.provider.companyName, 'XTO10X')
  assert.equal(scraper.provider.companyDomain, 'xto10x.com')
  assert.equal(scraper.provider.verifiedPublicJobCount, null)
  await assert.rejects(scraper.run({fetchImpl:async url=>({url,status:503})}), error=>{
    assert.equal(error.code,'XTO10X_COVERAGE_GAP')
    assert.equal(error.lifecycleCleanupAllowed,false)
    return true
  })
})
