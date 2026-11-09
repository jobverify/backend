import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

const csvText = `CATALOG,
Extra Company,
Global business consulting for a dynamic world,
Information Technology,category label
Manufacturing,category label
Software Development / Product Development,
"Sriperumbuudur, Kanchipuram, Tamil Nadu",
Teaching Assistant - Amrita Mysore campus,
Transform your learnings into earnings,
Vehicles for a better future,
Amrita,
`

test('generateCompanyCoverageReport excludes known extraction noise rows from the company backlog', () => {
  const report = generateCompanyCoverageReport({
    csvText,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.totalRows, 11)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['Amrita', 'amrita']],
  )
})

const extractedNoiseCsv = `European Summer of code,
EV vehicles,
re,
sfgds,
Amrita,
`

test('generateCompanyCoverageReport excludes obvious extracted junk rows that are not company names', () => {
  const report = generateCompanyCoverageReport({
    csvText: extractedNoiseCsv,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.totalRows, 5)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['Amrita', 'amrita']],
  )
})
