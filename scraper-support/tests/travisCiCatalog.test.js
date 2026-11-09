import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/travisci/catalog.js')
  } catch {
    assert.fail('Expected Travis CI catalog module at ../../scraper/travisci/catalog.js')
  }
}

test('Travis CI resolves to dynamic discovery without historical fixed-zero claims',async()=>{
 const {TRAVISCI_CATALOG,default:defaultCatalog}=await loadCatalogModule(),provider=getScraperCatalog().find(p=>p.source==='travisci')
 assert.equal(defaultCatalog,TRAVISCI_CATALOG);assert.equal(provider.companyName,'Travis CI');assert.equal(provider.countryFilter,'India')
 assert.equal(provider.companyCareerPage,'https://www.travis-ci.com/');assert.equal(provider.workableBoardUrl,'https://apply.workable.com/travisci/')
 assert.equal(provider.atsPlatform,'workable-public-get');assert.equal(provider.verifiedOn,null);assert.equal(provider.verifiedPublicJobCount,null)
 assert.equal(provider.verifiedIndiaJobCount,null);assert.equal(provider.sourceScopeComplete,false);assert.equal(provider.lifecycleCleanupAllowed,false)
 const report=generateCompanyCoverageReport({csvText:'company_name\nTravis CI\n',catalog:getScraperCatalog()})
 assert.equal(report.matchedCount,1);assert.equal(report.unmatchedCount,0);assert.equal(report.matched[0].source,'travisci')
})

test('buildScrapers exposes a runnable Travis CI scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'travisci')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'travisci')
  assert.match(scraper.dryRunFile, /travisci[\\/]jobs\.json$/i)
})
