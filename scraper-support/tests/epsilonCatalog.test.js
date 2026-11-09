import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const EXACT_LANE = 'Epsilon : Campus Recruitment for 2023 POB'

test('getScraperCatalog includes Epsilon as an official careers handoff to a public iCIMS/Jibe board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'epsilon')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'icims-jibe')
  assert.equal(provider.companyName, 'Epsilon')
  assert.equal(provider.companyCareerPage, 'https://www.epsilon.com/apac/careers-at-epsilon')
  assert.equal(provider.companyDomain, 'epsilon.com')
  assert.equal(companyAliases[EXACT_LANE], 'epsilon')
  assert.match(provider.modulePath, /epsilon[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Epsilon scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'epsilon')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'epsilon')
  assert.equal(scraper.provider.atsPlatform, 'icims-jibe')
  assert.match(scraper.dryRunFile, /epsilon[\\/]jobs\.json$/)
})

test('company coverage resolves the exact Epsilon campus lane and the base Epsilon name', () => {
  const report = generateCompanyCoverageReport({
    csvText: `row,company_name\n1,${EXACT_LANE}\n2,Epsilon\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [
      [EXACT_LANE, 'epsilon'],
      ['Epsilon', 'epsilon'],
    ],
  )
})
