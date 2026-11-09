import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport, getCompanyAliasMap } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const resolveTopCompaniesCsvPath = () => {
  const candidates = [
    path.join(repoRoot, 'top_companies_not_in_attached_list.csv'),
    path.join(repoRoot, 'artifacts', 'top_companies_not_in_attached_list.csv'),
  ]

  return candidates.find((candidatePath) => existsSync(candidatePath)) || null
}

test('top_companies_not_in_attached_list.csv resolves fully through the shared catalog', (t) => {
  const csvPath = resolveTopCompaniesCsvPath()
  if (!csvPath) {
    t.skip('top_companies_not_in_attached_list.csv is not present in this workspace')
    return
  }

  const report = generateCompanyCoverageReport({
    csvText: readFileSync(csvPath, 'utf8'),
    catalog: getScraperCatalog(),
    aliasMap: getCompanyAliasMap(),
  })

  assert.equal(report.totalRows, 400)
  assert.equal(report.candidateRows, 400)
  assert.equal(report.matchedCount, 400)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.unmatched, [])
})

test('top_companies_not_in_attached_list.csv only resolves to runnable scraper sources', (t) => {
  const csvPath = resolveTopCompaniesCsvPath()
  if (!csvPath) {
    t.skip('top_companies_not_in_attached_list.csv is not present in this workspace')
    return
  }

  const report = generateCompanyCoverageReport({
    csvText: readFileSync(csvPath, 'utf8'),
    catalog: getScraperCatalog(),
    aliasMap: getCompanyAliasMap(),
  })
  const scrapers = buildScrapers()
  const scraperNames = new Set(scrapers.map((scraper) => scraper.name))
  const uniqueMatchedSources = [...new Set(report.matched.map((item) => item.source))]
  const missingRunnableSources = uniqueMatchedSources.filter((source) => !scraperNames.has(source))

  assert.equal(uniqueMatchedSources.length > 0, true)
  assert.deepEqual(missingRunnableSources, [])
})
