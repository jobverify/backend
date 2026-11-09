import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {getScraperCatalog,buildScrapers} from '../providers/index.js'
import {generateCompanyCoverageReport} from '../providers/companyCoverage.js'
import metadata from '../../scraper/aayushmantech/catalog.js'

const directory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../scraper/aayushmantech')

test('Aayushman Tech local and registered contracts require runtime evidence and preserve unknown vacancy counts',()=>{
 const registered=getScraperCatalog().find(row=>row.source==="aayushmantech")
 assert.ok(registered)
 for(const value of [metadata,registered]){
  assert.equal(value.source,"aayushmantech")
  assert.equal(value.companyName,"Aayushman Tech")
  assert.equal(value.companyDomain,"aayushmantech.com")
  assert.equal(value.modulePath,path.join(directory,'script.js'))
  assert.equal(value.companyCareerPage,"https://www.aayushmantech.com/")
  assert.equal(value.zeroResultPolicy,'evidence-required')
  assert.equal(value.verifiedOn,null)
  assert.equal(value.verifiedPublicJobCount,null)
  assert.equal(value.verifiedIndiaJobCount,null)
  assert.equal(value.sourceScopeComplete,false)
  assert.equal(value.sourceListingComplete,false)
  assert.equal(value.lifecycleCleanupAllowed,false)
 }
})

test('Aayushman Tech retains its original runnable source identity and local dry-run output',()=>{
 const scraper=buildScrapers().find(row=>row.name==="aayushmantech")
 assert.ok(scraper)
 assert.equal(scraper.dryRunFile,path.join(directory,'jobs.json'))
})

test('Aayushman Tech remains mapped to its original company in coverage reports',()=>{
 const report=generateCompanyCoverageReport({csvText:"Aayushman Tech\n",catalog:getScraperCatalog()})
 assert.equal(report.matchedCount,1)
 assert.equal(report.unmatchedCount,0)
 assert.deepEqual(report.matched.map(row=>[row.companyName,row.source,row.provider.companyName]),[["Aayushman Tech","aayushmantech","Aayushman Tech"]])
})
