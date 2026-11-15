import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {validateCbaDescriptions} from './nativeContract.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/cba20261114-native.json.gz',import.meta.url))))
const originals=fixture.responses.filter(row=>row.url.includes('/wday/cxs/cba/CommBank_Careers/job/'))
const original=id=>JSON.parse(Buffer.from(originals.find(row=>JSON.parse(Buffer.from(row.bodyBase64,'base64')).jobPostingInfo.jobReqId===id).bodyBase64,'base64'))
const bad=original('REQ268156'),positive=original('REQ268153'),data=original('REQ266581')
const jobOf=payload=>({title:payload.jobPostingInfo.title,sourceDescription:payload.jobPostingInfo.jobDescription})
const provider=getScraperCatalog().find(row=>row.source==='commonwealthbankofaustralia')

async function replay(t,mutate){
 const reads=[],counts=new Map()
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  const method=init.method??'GET',key=method+' '+url,index=counts.get(key)??0
  counts.set(key,index+1)
  const packet=fixture.responses.filter(row=>row.url===String(url)&&row.method===method).toSorted((a,b)=>Date.parse(a.startedAt)-Date.parse(b.startedAt))[index]
  assert.ok(packet,'Only captured original native routes may be read: '+url)
  reads.push({url:String(url),method,body:init.body})
  const bytes=Buffer.from(packet.bodyBase64,'base64'),body=mutate?.(packet,bytes,reads)??bytes
  const response=new Response(body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalURL})
  return response
 })
 const jobs=await createCatalogScraper(provider).run({now:()=>fixture.checkedAt,requestScheduler:{acquire:async()=>()=>{},recordRateLimit:()=>{},minIntervalMs:0},retryBaseDelayMs:0})
 return{jobs,reads}
}

test('current criterion fixture preserves196 complete genuine response entities without fabricated request metadata',()=>{
 assert.equal(fixture.responses.length,196)
 for(const row of fixture.responses){const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(bytes.length,row.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.equal(row.status,200);assert.equal(row.finalURL,row.url);assert.equal(row.requestBody,undefined)}
 assert.equal(bad.jobPostingInfo.jobReqId,'REQ268156');assert.equal(bad.jobPostingInfo.country.descriptor,'India')
})

test('actual REQ268156 application accessibility footer cannot qualify as substantive role criteria',()=>{
 assert.throws(()=>validateCbaDescriptions([jobOf(bad)]),/role.*criteria|substantive.*criteria/i)
})

test('actual Pega and data engineering duties and skills retain their entire original visible criteria',()=>{
 for(const payload of [positive,data]){const job=jobOf(payload),html=job.sourceDescription;assert.deepEqual(validateCbaDescriptions([job]),[job]);assert.equal(job.sourceDescription,html)}
})

test('genuine duties after the exact application footer remain visible and preserved',()=>{
 const job=jobOf(bad);job.sourceDescription+=positive.jobPostingInfo.jobDescription
 const html=job.sourceDescription
 assert.deepEqual(validateCbaDescriptions([job]),[job]);assert.equal(job.sourceDescription,html)
})

test('actual generic organization marketing plus the common application footer is still not role criteria',()=>{
 const document=readNativeDocument(data.jobPostingInfo.jobDescription)
 const paragraph=document.nodes(node=>node.tag==='p').map(node=>document.text(node)).find(text=>text.includes('brighter future'))
 assert.ok(paragraph&&paragraph.length>150)
 const job=jobOf(bad);job.sourceDescription='<p>'+paragraph+'</p>'+job.sourceDescription
 assert.throws(()=>validateCbaDescriptions([job]),/role.*criteria|substantive.*criteria/i)
})

test('registered current92-role route quarantines boilerplate-only REQ268156 after all native closing checks',async t=>{
 const {jobs,reads}=await replay(t)
 assert.equal(jobs.length,91)
 assert.ok(!jobs.some(job=>job.jobId==='REQ268156'))
 assert.equal(reads.length,196);assert.equal(reads.filter(row=>row.method==='POST').length,11)
 assert.equal(reads.filter(row=>row.url.includes('/wday/cxs/cba/CommBank_Careers/job/')).length,184)
 assert.deepEqual(reads.filter(row=>row.method==='POST').map(row=>JSON.parse(row.body).offset),[0,20,40,60,80,0,0,20,40,60,80])
 const audit=jobs[Symbol.for('jobverify.verified-recruitment-observations')]
 assert.equal(audit.candidateDetails,92);assert.equal(audit.extractedDetailJobs,91)
 assert.deepEqual(audit.failures.map(row=>[row.nativeJobId,row.failureKind]),[['REQ268156','native-role-criteria-unavailable']])
 assert.equal(audit.closingInventoryMatches,true);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 for(const job of jobs){const native=original(job.jobId).jobPostingInfo;assert.equal(job.sourceDescription,native.jobDescription);assert.equal(job.sourceDetailComplete,true);assert.equal(job.country,'India');assert.equal(job.nativeEmployer,'CBA Services Private Limited');assert.equal(job.sourceScopeComplete,false);assert.equal(job.sourceListingComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.companyDomain,'commbank.com.au');assert.equal(job.atsPlatform,'workday');assert.equal(job.sourceFinalListingEvidence.observedNativeIndiaFacetRecords,92)}
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

test('all current native descriptions reduced to the original common footer remain unknown coverage with cleanup held',async t=>{
 const {jobs}=await replay(t,(packet,bytes)=>{if(!packet.url.includes('/wday/cxs/cba/CommBank_Careers/job/'))return bytes;const payload=JSON.parse(bytes);payload.jobPostingInfo.jobDescription=bad.jobPostingInfo.jobDescription;return Buffer.from(JSON.stringify(payload))})
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 const audit=jobs[Symbol.for('jobverify.verified-recruitment-observations')]
 assert.equal(audit.candidateDetails,92);assert.equal(audit.extractedDetailJobs,0);assert.equal(audit.failures.length,92);assert.equal(audit.lifecycleCleanupAllowed,false)
})

for(const [name,change,expected]of[
 ['employer',payload=>{payload.hiringOrganization.name='Unrelated Employer Limited'},/employer/i],
 ['country',payload=>{payload.jobPostingInfo.country.descriptor='United States of America'},/country|India/i],
])test('boilerplate quarantine cannot override the actual role native '+name+' contradiction',async t=>{
 await assert.rejects(()=>replay(t,(packet,bytes)=>{if(!packet.url.includes('/wday/cxs/cba/CommBank_Careers/job/'))return bytes;const payload=JSON.parse(bytes);if(payload.jobPostingInfo.jobReqId==='REQ268156')change(payload);return Buffer.from(JSON.stringify(payload))}),expected)
})

test('quarantined REQ268156 remains subject to the final full native listing identity check',async t=>{
 await assert.rejects(()=>replay(t,(packet,bytes,reads)=>{
  if(packet.method!=='POST'||reads.filter(row=>row.method==='POST').length!==7)return bytes
  const payload=JSON.parse(bytes),row=payload.jobPostings.find(row=>row.bulletFields.includes('REQ268156'))
  assert.ok(row);row.title+=' changed after hydration'
  return Buffer.from(JSON.stringify(payload))
 }),/Final native role\/title changed/)
})
