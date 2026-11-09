import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

test('Joyalukkas exact CSV company name resolves to its local provider', async () => {
  const { JOYALUKKAS_CATALOG } = await import('../../scraper/joyalukkas/catalog.js')
  const report = generateCompanyCoverageReport({
    csvText: 'Joyalukkas\n',
    catalog: [JOYALUKKAS_CATALOG],
    aliasMap: {},
  })

  assert.equal(JOYALUKKAS_CATALOG.source, 'joyalukkas')
  assert.equal(JOYALUKKAS_CATALOG.companyName, 'Joyalukkas')
  assert.equal(JOYALUKKAS_CATALOG.adapter, 'script')
  assert.equal(JOYALUKKAS_CATALOG.companyDomain, 'joyalukkas.com')
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'joyalukkas')
})
