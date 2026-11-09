import assert from 'node:assert/strict'
import test from 'node:test'
globalThis.fetch=()=>{throw Error('OFFLINE_NETWORK_TRIPWIRE')}
const{getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
const{scenario}=await import('../../scraper-support/tests/peopleStrongNativePair20261027.fixtures.js')
test('synthetic shared Amara inventory excludes six sibling roles without certifying an unbound target zero',async()=>{
 const s=scenario('amararajaenergymobility',{copies:6,exactEmployerDelegation:false,mutate:({listing,detail,org})=>{
  listing.organizationUnit='Mangal Industries Limited'
  listing.organizationUnitComplete='Amara Raja Group>Mangal Industries Limited>Engineering'
  detail.organizationUnitComplete=listing.organizationUnitComplete
  org.orgUnitHierarchy.find(row=>row.orgUnitType==='Company Name').orgUnitName='Mangal Industries Limited'
 }})
 let report
 const jobs=await createCatalogScraper(getScraperCatalog().find(x=>x.source==='amararajaenergymobility')).run({fetchPage:s.fetchPage,onReport:r=>{report=r},now:'2026-10-27T06:00:00Z'})
 assert.equal(jobs.length,0);assert.equal(report.reportedNativeTotal,6);assert.equal(report.nativeInventoryComplete,true);assert.equal(report.fullNativeDetails,6);assert.equal(report.renderedFullDetails,6);assert.equal(report.excludedEmployerCount,6);assert.equal(report.targetEmployerCount,0);assert.equal(report.sourceScopeComplete,false);assert.equal(report.rawJobs,null);assert.equal(report.verifiedZeroInventory,false)
 assert.equal(report.roles.every(j=>j.country==='India'&&j.nativeRoleCompany==='Mangal Industries Limited'&&j.requisitionId!==j.postingId),true)
})
test('listing-only legacy injection fails closed before global network access',async()=>{
 const p=getScraperCatalog().find(x=>x.source==='amararajaenergymobility')
 await assert.rejects(createCatalogScraper(p).run({fetchJson:async()=>({totalRecords:0,response:null})}),/Listing-only injection/)
})
