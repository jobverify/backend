import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/clariontechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/clariontechnologies/catalog.js')
  } catch {
    assert.fail('Expected Clarion Technologies catalog module at ../../scraper/clariontechnologies/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({ ...catalogEntry, modulePath })

test('Clarion Technologies local catalog captures the verified featured-jobs handoff', async () => {
  const { CLARION_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = buildProvider(CLARION_TECHNOLOGIES_CATALOG)

  assert.equal(provider.source, 'clariontechnologies')
  assert.equal(provider.companyName, 'Clarion Technologies')
  assert.equal(provider.featuredJobsUrl, 'https://jobs.clariontechnologies.co.in:444/featured-job')
  assert.equal(provider.openingsUrl, 'https://www.clariontech.com/open-positions')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.extractionStrategy, /scoped-native-https-fallback/i)
  assert.match(provider.verifiedSurfaceSummary, /Apply Now/i)
  assert.match(provider.verifiedSurfaceSummary, /Windows Schannel validates it/i)
  assert.match(provider.verifiedSurfaceSummary, /10 current openings/i)
})

test('Clarion Technologies exact backlog row resolves from the local provider contract', async () => {
  const { CLARION_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Clarion Technologies\n',
    catalog: [buildProvider(CLARION_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
