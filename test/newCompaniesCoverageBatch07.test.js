import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport, getCompanyAliasMap } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

const NEW_COMPANIES_CSV_URL = new URL('../../new_Companies.csv', import.meta.url)

test('new_Companies.csv resolves fully after workbook batch 07 aliases load', (t) => {
  if (!existsSync(NEW_COMPANIES_CSV_URL)) {
    t.skip(`Missing backlog CSV: ${NEW_COMPANIES_CSV_URL.pathname}`)
    return
  }

  const newCompaniesCsv = readFileSync(NEW_COMPANIES_CSV_URL, 'utf8')
  const report = generateCompanyCoverageReport({
    csvText: newCompaniesCsv,
    catalog: getScraperCatalog(),
    aliasMap: getCompanyAliasMap(),
  })

  const matchedByCompanyName = new Map(
    report.matched.map((item) => [item.companyName, item.source]),
  )

  assert.ok(report.candidateRows > 0)
  assert.equal(report.matchedCount, report.candidateRows)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.unmatched, [])

  assert.equal(matchedByCompanyName.get('Amazon Development Center'), 'amazon')
  assert.equal(matchedByCompanyName.get('VMware by Broadcom'), 'broadcom')
  assert.equal(matchedByCompanyName.get('Goldman Sachs Engineering'), 'goldmansachs')
  assert.equal(matchedByCompanyName.get('Hitachi Digital'), 'hitachiindia')
  assert.equal(matchedByCompanyName.get('Philips Innovation Campus'), 'philips')
  assert.equal(matchedByCompanyName.get('GE Healthcare Digital'), 'gehealthcare')
  assert.equal(matchedByCompanyName.get('Banyan Cloud'), 'banyancloud')
  assert.equal(matchedByCompanyName.get('Wells Fargo Technology'), 'wellsfargotechnology')
})
