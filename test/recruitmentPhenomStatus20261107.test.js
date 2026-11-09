import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativeDocument} from '../scraper-support/utils/activeNativeHtml.js'
import {literalRecruitmentPageData,phenomPublicRole,phenomRecruitmentRole} from '../scraper-support/utils/recruitmentPageData.js'
import {createVerifiedRecruitmentScraper,RECRUITMENT_OBSERVATIONS} from '../scraper-support/utils/verifiedRecruitment.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const directory=new URL('./test-data/recruitmentPhenomStatus20261107/',import.meta.url)
const receipt=JSON.parse(fs.readFileSync(new URL('merck-current-receipt.json',directory)))
const fixtureBytes=fs.readFileSync(new URL(receipt.fixture.file,directory))
const sha=value=>createHash('sha256').update(value).digest('hex')
assert.equal(sha(fixtureBytes),receipt.fixture.sha256)
const packets=JSON.parse(gunzipSync(fixtureBytes))
const page=id=>packets.find(packet=>packet.method==='GET'&&new URL(packet.requestUrl).pathname.includes('/job/'+id+'/'))
const native=id=>literalRecruitmentPageData(readNativeDocument(page(id).body),'phApp').ddo.jobDetail.data.job
const proof=job=>({jobId:String(job.jobId),title:job.title,country:job.country,location:job.location,sourceUrl:job.sourceUrl,
 applyUrl:job.applyUrl,postingDate:job.postingDate??null,closingDate:job.closingDate??null,employmentType:job.employmentType??null,
 nativeHiringOrganization:job.nativeHiringOrganization??null,sourceDetailComplete:job.sourceDetailComplete,
 sourceScopeComplete:job.sourceScopeComplete,sourceListingComplete:job.sourceListingComplete,lifecycleCleanupAllowed:job.lifecycleCleanupAllowed,
 descriptionSHA256:sha(job.sourceDescription),nativeSourceRecordSHA256:sha(JSON.stringify(job.nativeSourceRecord)),
 nativeStatusFields:Object.fromEntries(['atsStatus','jobStatus','postingStatus','successFactorsStatus'].filter(field=>Object.hasOwn(job.nativeSourceRecord,field)).map(field=>[field,job.nativeSourceRecord[field]]))})

test('the genuine Merck external Approved model retains its explicit SuccessFactors On Hold contradiction',()=>{
 const packet=page(receipt.heldJobId),model=native(receipt.heldJobId),before=structuredClone(model)
 assert.equal(model.jobId,'305492');assert.equal(model.jobStatus,'Approved')
 assert.equal(model.successFactorsStatus,'On Hold');assert.equal(model.atsStatus,'Success');assert.equal(model.postingStatus,'Success')
 assert.equal(phenomPublicRole(model),true,'External visibility remains separate from the own native hold')
 const role=phenomRecruitmentRole(readNativeDocument(packet.body),packet.url)
 assert.deepEqual(role.heldStatuses,[{field:'successFactorsStatus',value:'On Hold'}])
 assert.deepEqual(role.record,before);assert.deepEqual(model,before)
 assert.equal(role.description,before.description);assert.equal(role.posted,before.postedDate)
 assert.equal(role.closing,before.expiryDate||null)
 assert.equal(sha(JSON.stringify(model)),receipt.expectedJobs.find(job=>job.jobId===receipt.heldJobId).nativeSourceRecordSHA256)
})

test('genuine Merck Open models retain Approved, Success and Updated native status fields',()=>{
 for(const id of ['301616','304933']){
  const packet=page(id),model=native(id),before=structuredClone(model)
  assert.equal(model.successFactorsStatus,'Open');assert.equal(model.jobStatus,'Approved')
  assert.equal(phenomPublicRole(model),true)
  const role=phenomRecruitmentRole(readNativeDocument(packet.body),packet.url)
  assert.deepEqual(role.heldStatuses,[]);assert.deepEqual(role.record,before)
  assert.equal(role.description,before.description);assert.equal(role.posted,before.postedDate);assert.equal(role.closing,before.expiryDate||null)
 }
})

test('the genuine Merck On Hold page cannot qualify through its own visible JobPosting fallback',async t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('No network in retained native status regressions'))
 const packet=page(receipt.heldJobId),provider=getScraperCatalog().find(row=>row.source===receipt.source),calls=[]
 const jobs=await createVerifiedRecruitmentScraper({...provider,companyCareerPage:packet.url,officialHomepageUrl:packet.url}).run({
  maxPages:1,now:()=>receipt.observedAt,fetchPage:async url=>{
   calls.push(url);assert.equal(url,packet.requestUrl);return {status:packet.status,url:packet.url,html:packet.body,contentType:packet.contentType}
  }})
 assert.deepEqual(calls,[packet.requestUrl]);assert.equal(jobs.length,0)
 const exclusions=jobs[RECRUITMENT_OBSERVATIONS].exclusions
 assert.ok(exclusions.some(row=>row.reason==='native-role-on-hold'&&row.nativeStatuses.some(status=>status.field==='successFactorsStatus'&&status.value==='On Hold')))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('the captured registered Merck pipeline holds only role 305492 while preserving every other returned native proof',async t=>{
 const cursor=new Map(),used=[]
 const replay=async(input,init={})=>{
  const url=String(input),method=init.method||'GET',key=method+':'+url,start=cursor.get(key)||0
  const index=packets.findIndex((packet,index)=>index>=start&&packet.requestUrl===url&&packet.method===method)
  assert.ok(index>=0,'Uncaptured offline request refused: '+key)
  cursor.set(key,index+1);used.push(index)
  const packet=packets[index];assert.equal(packet.error,undefined);assert.notEqual(packet.body,null)
  const response=new Response([204,205,304].includes(packet.status)||method==='HEAD'?null:packet.body,{status:packet.status,headers:{'content-type':packet.contentType||'text/html'}})
  Object.defineProperty(response,'url',{value:packet.url});return response
 }
 t.mock.method(globalThis,'fetch',replay)
 const provider=getScraperCatalog().find(row=>row.source===receipt.source)
 const jobs=await createCatalogScraper(provider).run({now:()=>receipt.observedAt,fetchImpl:replay,requestIntervalMs:0})
 assert.equal(jobs.some(job=>String(job.jobId)===receipt.heldJobId),false)
 const expected=receipt.expectedJobs.filter(job=>job.jobId!==receipt.heldJobId).sort((a,b)=>a.jobId.localeCompare(b.jobId))
 assert.equal(expected.length,20)
 assert.deepEqual(jobs.map(proof).sort((a,b)=>a.jobId.localeCompare(b.jobId)),expected)
 assert.ok(used.length>0)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
})
