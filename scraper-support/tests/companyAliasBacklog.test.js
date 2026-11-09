import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

const aliasBacklogCsv = `Robert Bosch,
L&T Technology Services,
L&T Infotech Ltd (LTI),
TCS Atlas,
TCS Design,
TCS Digital,
TCS Ninja,
TCS Prime,
TCS R&I,
Vestas Wind Technology,
NxtWave Disruptive Technologies,
SKYROOT,
`

test('company alias backlog resolves high-confidence brand and legacy names to existing scrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: aliasBacklogCsv,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.totalRows, 12)
  assert.equal(report.candidateRows, 12)
  assert.equal(report.matchedCount, 12)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [
      ['Robert Bosch', 'boschglobalsoftwaretechnologies'],
      ['L&T Technology Services', 'ltts'],
      ['L&T Infotech Ltd (LTI)', 'ltimindtree'],
      ['TCS Atlas', 'tcs'],
      ['TCS Design', 'tcs'],
      ['TCS Digital', 'tcs'],
      ['TCS Ninja', 'tcs'],
      ['TCS Prime', 'tcs'],
      ['TCS R&I', 'tcs'],
      ['Vestas Wind Technology', 'vestas'],
      ['NxtWave Disruptive Technologies', 'nxtwave'],
      ['SKYROOT', 'skyrootaerospace'],
    ],
  )
})
