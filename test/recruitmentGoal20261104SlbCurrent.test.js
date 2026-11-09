import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog} from '../scraper-support/providers/index.js'
import {runApiPortalScraper} from '../scraper-support/apiPortal/engine.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {SLB_INDEX,SLB_CLIENT,SLB_COLLECTION,readSlbSearchConfiguration,readSlbCurrentRole,slbListingIdentity} from '../scraper-support/apiPortal/slbCurrentCareers.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/slb-current-native-quality.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const request=url=>fixture.requests.find(row=>row.requestedURL===url)
const search=fixture.requests.find(row=>new URL(row.requestedURL).hostname.endsWith('.org.coveo.com'))
const listing=JSON.parse(search.text)
const rows=new Map(listing.results.map(row=>[row.title,row]))
const source=()=>{const provider=structuredClone(getScraperCatalog().find(p=>p.source==='slb'));provider.config.rateLimit.minimumIntervalMs=0;return provider}
const supplier=rows.get('Associate Global Supplier Specialist'),software=rows.get('Software Engineer')
const roleHTML=row=>request(slbListingIdentity(row).url).text

test('the SLB native quality fixture preserves all 49 original HTTP bodies and both recruitment backends',()=>{
 assert.equal(fixture.requests.length,49)
 for(const q of fixture.requests){assert.equal(q.replayed,false);assert.equal(sha(q.text),q.bodySHA256)}
 assert.equal(listing.results.length,43)
 assert.equal(listing.results.filter(row=>slbListingIdentity(row).id.startsWith('WD')).length,1)
 assert.equal(listing.results.filter(row=>slbListingIdentity(row).id.startsWith('EF')).length,42)
})

test('current company configuration uses only the actively declared client, source, organization and country facet',()=>{
 const account=readSlbSearchConfiguration(request(SLB_INDEX).text,request(SLB_CLIENT).text)
 assert.equal(account.organizationId,'schlumbergerproduction0cs2zrh7')
 assert.equal(account.searchHub,'CoveoJobsHub')
 assert.equal(account.source,'ATS_Jobs_Source - Prod')
 assert.throws(()=>readSlbSearchConfiguration(request(SLB_INDEX).text,request(SLB_CLIENT).text+'changed'),/client changed/)
 assert.throws(()=>readSlbSearchConfiguration(request(SLB_INDEX).text+'<input id="organizationId" value="other">',request(SLB_CLIENT).text),/ambiguous/)
 assert.throws(()=>readSlbSearchConfiguration(request(SLB_INDEX).text.replace('field="country"','field="office"'),request(SLB_CLIENT).text),/country facet/)
})

test('SLB reads full own visible criteria and the published application anchor for both native role formats',()=>{
 for(const row of [supplier,software]){
  const role=readSlbCurrentRole(roleHTML(row),row,{now:fixture.completedAt})
  assert.ok(role.description.length>2000)
  assert.ok(!role.description.endsWith('Apply Now Share'))
  assert.equal(role.identity.id,new URL(row.uri).searchParams.get('id'))
  assert.equal(role.documentSHA256,sha(roleHTML(row)))
 }
 assert.match(readSlbCurrentRole(roleHTML(software),software,{now:fixture.completedAt}).description,/Key Responsibilities/)
 assert.match(readSlbCurrentRole(roleHTML(software),software,{now:fixture.completedAt}).applyURL,/championx\.wd1\.myworkdayjobs\.com/)
 const current=readSlbCurrentRole(roleHTML(supplier),supplier,{now:fixture.completedAt})
 assert.match(current.description,/Student Intern/)
 assert.equal(current.unqualifiedStructuredData.every(row=>row.usedForPublication===false),true)
 const inactive='<template><section class="job-description-redesign"><p>'+'Unrelated supplier criteria. '.repeat(20)+'</p></section></template>'
 assert.equal(readSlbCurrentRole(roleHTML(supplier)+inactive,supplier,{now:fixture.completedAt}).description,current.description)
})

for(const [label,change]of [
 ['wrong country',html=>html.replaceAll('India, Pune','United States, Pune')],
 ['hidden full criteria',html=>html.replace('class="job-description-redesign','hidden class="job-description-redesign')],
 ['unpublished application host',html=>html.replaceAll('https://apply.slb.com/careers/apply','https://other.example/apply')],
 ['different visible title',html=>html.replace(/(<h1[^>]*>\s*)Associate Global Supplier Specialist/,'$1Other role')],
])test('SLB rejects '+label,()=>assert.throws(()=>readSlbCurrentRole(change(roleHTML(supplier)),supplier,{now:fixture.completedAt}),/SLB current native contract/))

test('SLB refuses foreign/untyped listing countries and unbound own-role URLs',()=>{
 for(const country of [[],['Bengaluru'],['India','United States']])assert.throws(()=>slbListingIdentity({...supplier,raw:{...supplier.raw,country}}),/country/)
 assert.throws(()=>slbListingIdentity({...supplier,uri:supplier.uri.replace('careers.slb.com','other.example')}),/unbound/)
})

test('SLB publication uses only the original jobposteddate; index dates cannot fill a missing publication date',()=>{
 const copy=structuredClone(supplier);delete copy.raw.jobposteddate
 assert.ok(copy.raw.indexeddate)
 assert.equal(readSlbCurrentRole(roleHTML(supplier),copy,{now:fixture.completedAt}).posted,null)
 copy.raw.jobposteddate=Date.parse('2027-01-01')
 assert.throws(()=>readSlbCurrentRole(roleHTML(supplier),copy,{now:fixture.completedAt}),/publication/)
})

const replay=async({subset=false,change=(_url,response)=>response,maxJobs=Infinity,signal}={})=>{
 const counts=new Map(),calls=[]
 const jobs=await runApiPortalScraper({provider:source(),now:()=>fixture.completedAt,maxJobs,signal,fetchImpl:async(url,init)=>{
  const found=request(url);assert.ok(found,'No unpublished request or application visit: '+url)
  assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
  calls.push(url);const count=(counts.get(url)||0)+1;counts.set(url,count)
  let text=found.text
  if(subset&&new URL(url).hostname.endsWith('.org.coveo.com')){
   const model=JSON.parse(text);model.results=[software,supplier,rows.get('Early Careers - Digital Technology')]
   model.totalCount=model.totalCountFiltered=3;text=JSON.stringify(model)
  }
  const edited=change(url,{text,status:found.status,url:found.finalURL,count,init})
  const response=new Response(edited.text,{status:edited.status,headers:{'content-type':found.contentType}})
  Object.defineProperty(response,'url',{value:edited.url});return response
 }})
 return {jobs,calls}
}

test('SLB default engine route qualifies all 43 current roles, keeps native records and dates, and forbids complete company scope',async()=>{
 const {jobs,calls}=await replay()
 assert.equal(jobs.length,43)
 assert.equal(calls.length,49)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs[SLB_COLLECTION].heldNativeRoles.length,0)
 for(const job of jobs){
  assert.equal(job.country,'India');assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.nativeRoleClosingReconciled,true)
  assert.equal(job.nativeEmployerBinding.publisher,'SLB');assert.equal(job.nativeEmployerBinding.legalEmployer,null)
  assert.equal(job.nativeHiringOrganization,null)
  assert.equal(job.jobDescription,job.nativeSourceRecord.nativeVisibleRole.description)
  assert.equal(job.sourceDescription,job.jobDescription)
  assert.equal(job.sourcePostedDateRaw,job.nativeSourceRecord.nativeListing.raw.jobposteddate??null)
  assert.equal(job.firstEverPostedAt,null);assert.equal(job.applicationVisited,false)
  assert.equal(job.requisitionId,null)
  const application=new URL(job.applyUrl)
  assert.equal(job.jobId,application.origin==='https://apply.slb.com'?application.searchParams.get('pid'):job.nativeCurrentPostingId)
  assert.equal(job.nativeCurrentPostingId,new URL(job.sourceUrl).searchParams.get('id'))
 }
})

test('SLB holds a changed closing native identity without discarding the other reconciled roles',async()=>{
 const {jobs}=await replay({subset:true,change:(url,response)=>{
  if(new URL(url).hostname.endsWith('.org.coveo.com')&&response.count===2){const model=JSON.parse(response.text);model.results[0].title='Changed role';return {...response,text:JSON.stringify(model)}}
  return response
 }})
 assert.equal(jobs.length,2)
 assert.equal(jobs[SLB_COLLECTION].heldNativeRoles.length,1)
})

test('SLB later HTTP 403 stops the denied origin and preserves earlier own-role facts with incomplete closing evidence',async()=>{
 const deniedURL=slbListingIdentity(supplier).url
 const {jobs,calls}=await replay({subset:true,change:(url,response)=>url===deniedURL?{...response,status:403,text:'Forbidden'}:response})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].nativeRoleClosingReconciled,false)
 assert.equal(jobs[0].nativeClosingInventoryUnavailable,true)
 assert.equal(calls.at(-1),deniedURL)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('SLB zero cap and caller cancellation never certify a complete empty inventory',async()=>{
 const {jobs}=await replay({maxJobs:0})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 const controller=new AbortController(),reason=Error('caller cancelled');controller.abort(reason)
 await assert.rejects(replay({signal:controller.signal}),error=>error===reason)
})
