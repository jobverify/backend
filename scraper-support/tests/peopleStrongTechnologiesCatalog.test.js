import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/peoplestrongtechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/peoplestrongtechnologies/catalog.js')
  } catch {
    assert.fail('Expected PeopleStrong Technologies catalog module at ../../scraper/peoplestrongtechnologies/catalog.js')
  }
}

test('PeopleStrong Technologies local catalog captures successful public inventory evidence behind unavailable list routes without alias churn', async () => {
  const { PEOPLESTRONG_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PEOPLESTRONG_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, PEOPLESTRONG_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'peoplestrongtechnologies')
  assert.equal(provider.companyName, 'PeopleStrong Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.peoplestrong.com/')
  assert.equal(provider.companyDomain, 'careers.peoplestrong.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-api')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.equal(provider.paginationStrategy, 'offset-limit-to-totalRecords')
  assert.equal(provider.jobsApiUrl, 'https://careers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /public list routes/i)
  assert.match(provider.verifiedSurfaceSummary, /known 404 shells/i)
  assert.match(provider.verifiedSurfaceSummary, /explicit successful zero-requisition payload/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'PeopleStrong Technologies'), false)
})

test('PeopleStrong Technologies backlog row matches directly from the local catalog', async () => {
  const { PEOPLESTRONG_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'PeopleStrong Technologies\n',
    catalog: [hydrateProviderCatalogEntry(PEOPLESTRONG_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('PeopleStrong Technologies hydrated local catalog stays script-runner compatible', async () => {
  const { PEOPLESTRONG_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PEOPLESTRONG_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(typeof module.run, 'function')
})
