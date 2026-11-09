import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {getScraperCatalog,buildScrapers,hydrateProviderCatalogEntry} from '../providers/index.js'
import {generateCompanyCoverageReport} from '../providers/companyCoverage.js'
import metadata from '../../scraper/acmesolar/catalog.js'
import contract from '../../scraper/acmesolar/provider.json' with {type:'json'}
const directory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../scraper/acmesolar')

test('ACME Solar local and registered contracts require runtime evidence and preserve unknown vacancy counts',()=>{
 const registered=getScraperCatalog().find(row=>row.source==="acmesolar")
 assert.ok(registered)
 for(const value of [metadata,registered,hydrateProviderCatalogEntry(contract)]){
  assert.equal(value.source,"acmesolar")
  assert.equal(value.companyName,"ACME Solar")
  assert.equal(value.companyDomain,"acmesolar.in")
  assert.equal(value.modulePath,path.join(directory,'script.js'))
  assert.equal(value.companyCareerPage,"https://www.acmesolar.in/career")
  assert.equal(value.zeroResultPolicy,'evidence-required')
  assert.equal(value.verifiedOn,null)
  assert.equal(value.verifiedPublicJobCount,null)
  assert.equal(value.verifiedIndiaJobCount,null)
  assert.equal(value.sourceScopeComplete,false)
  assert.equal(value.sourceListingComplete,false)
  assert.equal(value.lifecycleCleanupAllowed,false)
 }
})

test('ACME Solar retains its original runnable source identity and local dry-run output',()=>{
 const scraper=buildScrapers().find(row=>row.name==="acmesolar")
 assert.ok(scraper)
 assert.equal(scraper.dryRunFile,path.join(directory,'jobs.json'))
})

test('ACME Solar remains mapped to its original company in coverage reports',()=>{
 const report=generateCompanyCoverageReport({csvText:"ACME Solar\n",catalog:getScraperCatalog()})
 assert.equal(report.matchedCount,1)
 assert.equal(report.unmatchedCount,0)
 assert.deepEqual(report.matched.map(row=>[row.companyName,row.source,row.provider.companyName]),[["ACME Solar","acmesolar","ACME Solar"]])
})
