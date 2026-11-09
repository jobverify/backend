import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { generateCompanyCoverageReport, getCompanyAliasMap } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

test('getCompanyAliasMap merges base aliases with sorted extension files', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'jobverify-company-aliases-'))

  try {
    writeFileSync(
      path.join(tempDir, 'b-second.json'),
      `${JSON.stringify({
        'Mercer | Mettl': 'mercermettl',
        'Example Commerce Express': 'example',
      }, null, 2)}\n`,
      'utf8',
    )
    writeFileSync(
      path.join(tempDir, 'a-first.json'),
      `${JSON.stringify({
        'Freshdesk': 'freshworks',
      }, null, 2)}\n`,
      'utf8',
    )

    const aliases = getCompanyAliasMap({
      baseAliasMap: {
        Existing: 'existing-source',
      },
      extensionDir: tempDir,
    })

    assert.equal(aliases.Existing, 'existing-source')
    assert.equal(aliases.Freshdesk, 'freshworks')
    assert.equal(aliases['Mercer | Mettl'], 'mercermettl')
    assert.equal(aliases['Example Commerce Express'], 'example')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('Upstox Pro resolves to the verified Upstox provider through alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nUpstox Pro\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'upstox')
})

test('Kite and Zerodha Varsity resolve to the verified Zerodha provider through alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nKite\nZerodha Varsity\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => item.source), ['zerodha', 'zerodha'])
})

test('Bitbucket backlog names resolve to the verified Atlassian provider through alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nBitbucket\nBitbucket India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => item.source), ['atlassian', 'atlassian'])
})

test('Loom resolves to the verified Atlassian provider through alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nLoom\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'atlassian')
})

test('Netflix India resolves to the verified Netflix provider through alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nNetflix India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'netflix')
})

test('Splunk India resolves to the verified Splunk provider through alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nSplunk India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'splunk')
})

test('Tableau resolves to the verified Salesforce provider through alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nTableau\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'salesforce')
})

test('Power BI resolves to the verified Microsoft provider through alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nPower BI\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'microsoft')
})

test('Looker and BigQuery resolve to the verified Google provider through alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nLooker\nBigQuery\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => item.source), ['google', 'google'])
})

test('VMware India resolves to the verified Broadcom provider through alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nVMware India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'broadcom')
})

test('Samsung Semiconductor India resolves to the verified Samsung Research Workday provider through alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nSamsung Semiconductor India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'samsungresearch')
})

test('Walmart Global Tech India resolves to the verified Walmart provider through alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nWalmart Global Tech India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'walmart')
})

test('Exact-name providers still reject fuzzy matches when no exact alias exists', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nWalmart Global Tech\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 0)
  assert.equal(report.unmatchedCount, 1)
})
