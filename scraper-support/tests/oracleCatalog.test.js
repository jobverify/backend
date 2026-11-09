import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Oracle catalog resolves Oracle Cloud Infrastructure through the shared Oracle provider', () => {
  const oracle = getScraperCatalog().find((provider) => provider.source === 'oracle')

  assert.ok(oracle)
  assert.equal(oracle.companyName, 'Oracle')
  assert.equal(oracle.adapter, 'script')
  assert.equal(oracle.atsPlatform, 'oracle-cloud')
  assert.equal(oracle.companyCareerPage, 'https://careers.oracle.com/en/sites/jobsearch/jobs/')
  assert.equal(companyAliases['Oracle Cloud Infrastructure'], 'oracle')

  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name,url_in_text,note\n1,Oracle,,\n2,Oracle Cloud Infrastructure,,\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Oracle', 'oracle', 'Oracle'],
      ['Oracle Cloud Infrastructure', 'oracle', 'Oracle'],
    ],
  )
})

test('Oracle catalog keeps one runnable Oracle scraper without a duplicate Oracle Cloud Infrastructure runner', () => {
  const oracleCloudInfrastructure = getScraperCatalog().find(
    (provider) => provider.source === 'oraclecloudinfrastructure',
  )
  const scraper = buildScrapers().find((candidate) => candidate.name === 'oracle')

  assert.equal(oracleCloudInfrastructure, undefined)
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'oracle')
  assert.match(scraper.dryRunFile, /oracle[\\/]jobs\.json$/i)
})
