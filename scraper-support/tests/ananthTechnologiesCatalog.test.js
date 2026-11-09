import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {getScraperCatalog,buildScrapers} from '../providers/index.js'
import {generateCompanyCoverageReport} from '../providers/companyCoverage.js'
import metadata from '../../scraper/ananthtechnologies/catalog.js'
const directory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../scraper/ananthtechnologies')

test('Ananth Technologies local and registered metadata preserve authority with runtime-only vacancy counts',()=>{
 const registered=getScraperCatalog().find(row=>row.source==="ananthtechnologies")
 assert.ok(registered)
 for(const value of [metadata,registered]){
  assert.equal(value.source,"ananthtechnologies")
  assert.equal(value.companyName,"Ananth Technologies")
  assert.equal(value.companyDomain,"ananthtech.com")
  assert.equal(value.adapter,'script')
  assert.equal(value.modulePath,path.join(directory,'script.js'))
  assert.equal(value.zeroResultPolicy,'evidence-required')
  assert.equal(value.verifiedOn,null)
  assert.equal(value.verifiedPublicJobCount,null)
  assert.equal(value.verifiedIndiaJobCount,null)
  assert.equal(value.sourceScopeComplete,false)
  assert.equal(value.sourceListingComplete,false)
  assert.equal(value.lifecycleCleanupAllowed,false)
 }
 assert.equal(registered.companyCareerPage,metadata.companyCareerPage)
})

test('Ananth Technologies remains runnable under its original source identity and local dry-run file',()=>{
 const registered=buildScrapers().find(row=>row.name==="ananthtechnologies")
 assert.ok(registered)
 assert.equal(registered.dryRunFile,path.join(directory,'jobs.json'))
})

test('Ananth Technologies retains its original company-coverage mapping',()=>{
 const report=generateCompanyCoverageReport({csvText:"Ananth Technologies\n",catalog:getScraperCatalog()})
 assert.equal(report.matchedCount,1)
 assert.equal(report.unmatchedCount,0)
 assert.deepEqual(report.matched.map(row=>[row.companyName,row.source,row.provider.companyName]),[["Ananth Technologies","ananthtechnologies","Ananth Technologies"]])
})
