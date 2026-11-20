import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
const replay=(change=()=>{})=>{
 const queues=new Map(),calls=[]
 for(const row of fixture.originals){const key=JSON.stringify([row.requestedURL,row.method,row.requestBody]);if(!queues.has(key))queues.set(key,[]);queues.get(key).push(row)}
 return{calls,requestIntervalMs:0,fetchImpl:async(url,init)=>{
  const key=JSON.stringify([url,init.method??'GET',init.body??null]),original=queues.get(key)?.shift();assert.ok(original,'Undeclared native request '+url)
  const row={...structuredClone(original),body:Buffer.from(original.bodyBase64,'base64').toString('utf8')};change(row,url,init);calls.push({url,method:init.method??'GET',phase:row.phase,body:init.body??null})
  return Object.defineProperties(new Response(row.body,{status:row.status,headers:row.headers}),{url:{value:row.url},redirected:{value:row.redirected}})
 }}
}

test('registered current Pena4 qualifies18 unique native India roles with own publisher/city/application and full public closing',async()=>{
 const io=replay(),provider=getScraperCatalog().find(p=>p.source==='pena4techsolutions'),jobs=await createCatalogScraper(provider).run(io)
 assert.equal(jobs.length,18);assert.equal(new Set(jobs.map(job=>job.jobId)).size,18)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceEmployerBindingQualified&&job.sourceRoleUrlQualified))
 assert.ok(jobs.every(job=>job.sourceCountryEvidence.nativeCityRows.length===job.nativeWorkplaceAlternatives.length&&job.sourceCountryEvidence.nativeCityRows.every((city,index)=>city.cityCode===job.nativeWorkplaceAlternatives[index].id&&city.cityName===job.nativeWorkplaceAlternatives[index].text&&city.countryName==='India')))
 assert.ok(jobs.every(job=>new URL(job.applyUrl).pathname==='/apply-job'&&new URL(job.applyUrl).searchParams.get('dc')==='pena4tech'))
 assert.ok(jobs.every(job=>job.backendSubmissionVerified===false&&job.sourceDetailComplete===false))
 assert.equal(jobs.nativeCollectionEvidence.nativeObservedRecords,18);assert.equal(jobs.nativeCollectionEvidence.wholePublicNativeModelsClosingReconciled,true)
 assert.equal(io.calls.length,62);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition(provider,jobs);assert.equal(assessment.runnerOutcome.success,true);assert.equal(assessment.indiaJobs,18);assert.equal(assessment.cleanupOptions.replaceExisting,false)
})

const changed=async mutation=>run(replay(mutation))
const json=(row,change)=>{const value=JSON.parse(row.body);change(value);row.body=JSON.stringify(value)}
const detail=url=>url.includes('/JobOpening/Request/Details/')

test('actual native position cohort remains dynamic without frozen IDs or titles',async()=>{
 const jobs=await changed((row,url,init)=>{if(url.endsWith('/CareerPosition/Details')&&JSON.parse(init.body).pagination.pageNumber===2)json(row,rows=>rows.pop())})
 assert.equal(jobs.length,17);assert.equal(jobs.nativeCollectionEvidence.nativeObservedRecords,17)
})

test('the native public City country must agree rather than a corporate Hyderabad address',async()=>{
 const jobs=await changed((row,url)=>{if(url.endsWith('/City/BindDropDown'))json(row,rows=>{for(const city of rows)if(city.cityCode==='1008')city.countryName='United States'})})
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.heldRecords.length,18);assert.equal(jobs.nativeCollectionEvidence.companyZeroProven,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('the whole native workplace ID and exact name must join the country row',async()=>{
 const jobs=await changed((row,url)=>{if(url.endsWith('/City/BindDropDown'))json(row,rows=>{for(const city of rows)if(city.cityCode==='1008')city.cityName='Hyderabad / London'})})
 assert.equal(jobs.length,0)
})

test('a foreign second native workplace alternative holds every affected multi-workplace role',async()=>{
 const jobs=await changed((row,url)=>{if(url.endsWith('/City/BindDropDown'))json(row,rows=>{for(const city of rows)if(city.cityCode==='31')city.countryName='United States'})})
 assert.equal(jobs.length,11);assert.equal(jobs.nativeCollectionEvidence.heldRecords.length,7)
 assert.ok(jobs.every(job=>job.nativeWorkplaceAlternatives.length===1&&job.nativeWorkplaceAlternatives[0].id==='1008'))
})

test('current native duplicate City identity is unavailable',async()=>{
 await assert.rejects(changed((row,url)=>{if(url.endsWith('/City/BindDropDown'))json(row,rows=>rows.push(structuredClone(rows[0])))}),/duplicate native city/)
})

test('native employer metadata cannot bind another tenant with the same renderer',async()=>{
 await assert.rejects(changed((row,url)=>{if(url.includes('/referral/CareerPortal/'))json(row,value=>{value.portalDetails[0].companyName='Another Employer'})}),/employer/)
})

test('individual native DTO employer and exact identity remain mandatory',async()=>{
 await assert.rejects(changed((row,url)=>{if(detail(url))json(row,value=>{value.company='Another Employer'})}),/employer/)
})

for(const [name,edit]of [['closed-for-all',value=>{value.isClosedForAll=1}],['public application disabled',value=>{value.canAddCandidate=0}],['not published for public careers',value=>{value.isCareerPortal=false}],['expired native application date',value=>{value.lastApplicationDate='2020-01-01'}],['new foreign typed country',value=>{value.jobLocation={addressCountry:'United States'}}]]){
 test(name+' cannot become a partial criteria exception',async()=>{
  await assert.rejects(changed((row,url)=>{if(detail(url))json(row,edit)}),/closed|published|application date|typed country/)
 })
}

test('missing native description and public attachment are retained as partial jobs',async()=>{
 const jobs=await changed((row,url)=>{if(detail(url))json(row,value=>{value.jobDescriptionBodyWithHtml='';value.documentFileName='native-criteria-attachment.pdf'})})
 assert.equal(jobs.length,18);assert.ok(jobs.every(job=>job.sourceDetailComplete===false&&job.nativePublicJobCriteria.documentFileName==='native-criteria-attachment.pdf'))
})

test('all published description bytes remain even when other public enums are unqualified',async()=>{
 const jobs=await changed(()=>{});assert.ok(jobs.some(job=>typeof job.sourceDescription==='string'&&job.sourceDescription.length>0))
 assert.ok(jobs.every(job=>job.sourceDetailComplete===false&&job.nativeAdditionalPublicCriteria))
 assert.doesNotMatch(JSON.stringify(jobs),/requestOwnerDetails|replacedEmployee|imageVirtualPath|reportingName/)
})

test('closing full public criteria changes are rejected',async()=>{
 await assert.rejects(changed((row,url)=>{if(detail(url)&&row.phase==='closing-details')json(row,value=>{value.jobDescriptionBodyWithHtml+=' Changed current public requirement.'})}),/public native own-role criteria/)
})

test('a newly declared native public control is retained and reconciled',async()=>{
 await assert.rejects(changed((row,url)=>{
  if(url.endsWith('/LabelSetting'))json(row,rows=>rows.push({fieldName:'NEW_PUBLIC_FIELD',displayName:'New public requirement',controlKey:'newPublicRequirement',isCarrierPortal:true}))
  if(detail(url))json(row,value=>{value.newPublicRequirement=row.phase==='closing-details'?'Changed public requirement':'Current public requirement'})
 }),/public native own-role criteria/)
})

test('closing native country lookup changes cannot be ignored',async()=>{
 await assert.rejects(changed((row,url)=>{if(url.endsWith('/City/BindDropDown')&&row.phase==='closing-public-cities')json(row,rows=>{rows[0].districtName+=' changed'})}),/closing whole native workplace/)
})

test('new original HTTP redirect metadata is required',async()=>{
 await assert.rejects(changed(row=>{row.redirected=undefined}),/HTTP identity or redirect metadata/)
})

test('opaque caller cancellation bounds an uncooperative original request',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'Pena4 current opaque abort'});let entered
 const started=new Promise(resolve=>{entered=resolve}),pending=run({signal:controller.signal,requestIntervalMs:0,fetchImpl:()=>{entered();return new Promise(()=>{})}})
 await started;controller.abort(reason);await assert.rejects(pending,error=>error===reason)
})
