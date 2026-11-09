import assert from 'node:assert/strict'
import test from 'node:test'
import {fixture,replay} from './fixtureReplay.js'
import {createNetomiScraper} from '../../../scraper/netomi/script.js'
import {createIonicScraper} from '../../../scraper/ionic/script.js'
import {createVeryGoodSecurityIndiaScraper} from '../../../scraper/verygoodsecurityindia/script.js'
import {getScraperCatalog,createCatalogScraper} from '../../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../../scraper-support/utils/inventoryEvidence.js'
globalThis.fetch=async()=>{throw Error('Only immutable original entities; network/DB/website execution prohibited')}

for(const [source,create] of [['netomi',createNetomiScraper],['verygoodsecurityindia',createVeryGoodSecurityIndiaScraper]])test(source+' retains every original native own model and complete criteria before selection',async()=>{
 const r=replay(),jobs=await create().run(r.options),oracle=fixture.oracle[source]
 assert.equal(r.audits.length,1,'A detached awaited complete audit is required')
 const audit=r.audits[0];assert.equal(audit.observations.length,oracle.records.length)
 for(const row of oracle.records){
  const job=audit.observations.find(j=>j.jobId===row.id);assert.ok(job)
  assert.deepEqual(job.sourceNativeRecord,row.originalNative)
  assert.deepEqual(job.sourceNativeJobPosting,row.originalSchema)
  for(const fact of row.criteriaFacts)assert.ok(job.jobDescription.includes(fact),source+' full original criteria '+row.id)
  for(const [key,value]of Object.entries(row.expectedFields))assert.deepEqual(job[key],value,key)
  for(const [key,value]of Object.entries(row.expectedGeography))assert.deepEqual(job[key],value,key)
  if(source==='verygoodsecurityindia')assert.deepEqual(job.sourceNativeLocationCountryCorroborations,row.expectedCountryCorroborations)
 }
 assert.equal(audit.sourceScopeComplete,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 if(source==='netomi'){
  assert.equal(jobs.length,0);assert.equal(audit.closing.publisherQualified,false)
  assert.ok(audit.observations.every(j=>j.sourceCurrentNativePostingIdentityQualified===false))
 }else{
  assert.equal(audit.opening.publisherQualified,true)
  assert.equal(audit.closing.publisherQualified,true)
  assert.equal(audit.closing.nativeGroupedCollectionComplete,true)
  assert.deepEqual(audit.closing.originalCurrentNativeRoutes.map(row=>row.path),['/careers','/careers/engineering'])
  assert.ok(audit.observations.every(row=>row.sourceCurrentNativePostingIdentityQualified))
  const expected=oracle.records.filter(row=>!row.expectedGeography.sourceNativeCountryConflict&&(row.expectedGeography.country==='India'||row.expectedGeography.sourceCountryScopeUnresolved))
  assert.deepEqual(jobs.map(row=>row.jobId),expected.map(row=>row.id))
  assert.deepEqual(audit.opening.originalNativeGroupedFeed,oracle.originalGroupedFeed)
  assert.deepEqual(audit.closing.originalNativeGroupedFeed,oracle.originalGroupedFeed)
  assert.ok(r.requests.includes('https://www.verygoodsecurity.com/careers/engineering'))
 }
})
test('Ionic failed proxy is retained as unavailable selected channel without an empty-feed claim',async()=>{
 const r=replay(),jobs=await createIonicScraper().run(r.options);assert.equal(jobs.length,0)
 assert.equal(r.audits.length,1);const audit=r.audits[0]
 for(const phase of ['opening','closing']){
  assert.deepEqual(audit[phase].originalNativeProxy,fixture.oracle.ionic.originalProxy)
  assert.equal(audit[phase].nativeListingComplete,false)
  assert.equal(audit[phase].nativeFeedUnavailable,true)
 }
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.authoritativeSourceTotal,null)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('registered metadata removes stale dates/counts and keeps the actual configured country scopes',()=>{
 for(const [source,scope]of [['netomi','Global'],['ionic','Global'],['verygoodsecurityindia','India']]){
  const provider=getScraperCatalog().find(p=>p.source===source);assert.ok(provider)
  assert.equal(provider.countryFilter,scope);assert.equal(provider.verifiedOn,null)
  assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.verifiedIndiaJobCount,null)
  assert.equal(provider.sourceScopeComplete,false);assert.equal(provider.lifecycleCleanupAllowed,false)
 }
})
test('actual registered dispatch exposes the Netomi native observations while publisher binding stays held',async()=>{
 const p=getScraperCatalog().find(p=>p.source==='netomi'),r=replay(),jobs=await createCatalogScraper(p).run(r.options)
 assert.equal(jobs.length,0);assert.equal(r.audits.length,1);assert.equal(r.audits[0].observations.length,20)
})
