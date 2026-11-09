import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const loadCatalogModule = async () => import('../../scraper/skyscanner/catalog.js')
const loadScriptModule = async () => import('../../scraper/skyscanner/script.js')

test('Skyscanner exact CSV row resolves to its verified current native provider', async () => {
  const { SKYSCANNER_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SKYSCANNER_CATALOG)
  const report = generateCompanyCoverageReport({
    csvText: 'Skyscanner\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'skyscanner')
  assert.equal(provider.companyCareerPage, 'https://www.skyscanner.com/jobs/current-jobs')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.sourceBoundaryReviewedOn, '2026-11-03')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.modulePath, path.resolve(currentDir, '../../scraper/skyscanner/script.js'))
})

test('Skyscanner historical shell helpers cannot authorize empty native inventory', async () => {
  const skyscanner = await loadScriptModule()
  const shell = '<h1>Current jobs</h1><select>All teams</select><select>All locations</select><input placeholder="Search by title, team or location">'

  assert.equal(skyscanner.hasVerifiedJobsShellSignal(shell), true)
  assert.equal(skyscanner.hasEnumerableJobsSignal(shell), false)
  await assert.rejects(
    skyscanner.createSkyscannerScraper().run({
      fetchPage: async url => ({ status: 200, url, html: `<title>Skyscanner Jobs</title>${shell}` }),
    }),
    /bundle binding/i,
  )
  await assert.rejects(
    skyscanner.createSkyscannerScraper().run({ fetchPage: async url => ({ status: 200, url, html: '<h1>Careers</h1>' }) }),
    /page identity/i,
  )
})
