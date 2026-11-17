import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {parseNativeJSON} from './nativeJSON.js'
import {readRole,reconcileModels,mapRole} from './nativeModels.js'
import {ROLE_BASE} from './nativeDeclarations.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/empty-fields-20261116.json.gz',import.meta.url))))
const emptyFields=['job_type','job_category','job_function'],now=Date.parse(fixture.completedAt)
const model=packet=>{
 const bytes=Buffer.from(packet.bodyBase64,'base64')
 assert.equal(packet.status,200);assert.equal(packet.finalURL,packet.requestedURL);assert.equal(packet.redirected,false)
 assert.equal(bytes.length,packet.bodyBytes)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256)
 return parseNativeJSON(bytes.toString('utf8'))
}
const packets=phase=>fixture.originals.filter(p=>p.phase===phase)
const cases=packets('opening').filter(p=>p.requestedURL.startsWith(ROLE_BASE)).map(packet=>{
 const detail=model(packet),listing=model(packets('opening')[0]).jobs.find(row=>row.guid===detail.guid)
 const closingDetail=model(packets('closing').find(p=>p.requestedURL===packet.requestedURL))
 const closingListing=model(packets('closing')[0]).jobs.find(row=>row.guid===detail.guid)
 return{listing,detail,closingDetail,closingListing}
})

for(const row of cases)test('current AECOM '+row.detail.reqid+' qualifies exact omitted Solr optional fields against own literal empty strings without changing models',()=>{
 const {listing,detail,closingDetail,closingListing}=row
 for(const field of emptyFields){assert.equal(Object.hasOwn(listing,field),false);assert.equal(Object.hasOwn(detail,field),true);assert.equal(detail[field],'')}
 const originalListing=structuredClone(listing),originalDetail=structuredClone(detail)
 const opening=readRole(detail,listing,now),closing=readRole(closingDetail,closingListing,now)
 reconcileModels(listing,closingListing,'listing');reconcileModels(detail,closingDetail,'role')
 assert.deepEqual(listing,originalListing);assert.deepEqual(detail,originalDetail)
 assert.equal(opening.descriptionHTML,detail.html_description)
 assert.ok(opening.description.includes('Job Description')&&opening.description.includes('Qualifications'))
 for(const source of ['aecom','aecomindia']){
  const job=mapRole(source,listing,opening,closing,closingListing,{boardURL:'https://aecom.jobs/'},fixture.completedAt)
  assert.equal(job.jobId,detail.guid);assert.equal(job.requisitionId,detail.reqid)
  assert.equal(job.country,'India');assert.equal(job.workplaceType,null);assert.equal(job.employmentType,null)
  assert.equal(job.applyUrl,detail.link);assert.equal(job.sourceDescription,detail.html_description)
  assert.deepEqual(job.nativeSourceRecord.listing,originalListing);assert.deepEqual(job.nativeSourceRecord.detail,originalDetail)
  assert.deepEqual(job.nativeClosingRecord.detail,closingDetail)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 }
})

for(const field of emptyFields)test('AECOM omitted '+field+' permits only own exact empty string and never a conflicting or unknown value',()=>{
 const {listing,detail}=cases[0]
 for(const value of [null,' ','Hybrid','On-Site',false,0,[],{}]){
  const changed=structuredClone(detail);changed[field]=value
  assert.throws(()=>readRole(changed,listing,now),/differs from own listing/)
 }
 for(const value of [null,'Hybrid',false,[],{}]){
  const changed=structuredClone(listing);changed[field]=value
  assert.throws(()=>readRole(detail,changed,now),/differs from own listing/)
 }
})

test('AECOM omitted optional fields do not bypass employer, country, identity or complete-criteria checks',()=>{
 const {listing,detail}=cases[0]
 for(const change of [d=>d.company='Other',d=>d.country='Canada',d=>d.guid='0'.repeat(32),d=>d.reqid+='changed',d=>d.html_description='',d=>d.html_description+='<p>Mandatory work assignment: Canada</p>']){
  const changed=structuredClone(detail);change(changed)
  assert.throws(()=>readRole(changed,listing,now),/AECOM native/)
 }
})

test('AECOM closing retains full raw field presence and criteria even where omitted and empty could compare at acquisition',()=>{
 const {listing,detail}=cases[0]
 for(const field of emptyFields){
  const changedListing=structuredClone(listing);changedListing[field]=''
  assert.throws(()=>reconcileModels(listing,changedListing,'listing'),/closing listing model changed/)
  const changedDetail=structuredClone(detail);delete changedDetail[field]
  assert.throws(()=>reconcileModels(detail,changedDetail,'role'),/closing role model changed/)
 }
 for(const change of [d=>d.html_description+='<p>New required licence.</p>',d=>d.futureRequirement={value:'required'}]){
  const changed=structuredClone(detail);change(changed)
  assert.throws(()=>reconcileModels(detail,changed,'role'),/closing role model changed/)
 }
})
