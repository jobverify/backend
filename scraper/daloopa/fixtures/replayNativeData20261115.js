import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../../scraper-support/utils/sourceObservationEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
export const daloopaFixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('./native-data-20261115.json.gz',import.meta.url))))
export function createDaloopaReplay(change){
 const fixture=daloopaFixture(),calls=[],pending=new Map()
 const key=(url,method,body)=>method+'\n'+url+'\n'+(body??'')
 for(const item of fixture.schedule){const packet=fixture.packets[item.packetIndex],id=key(packet.requestedUrl,packet.method,packet.requestBody),rows=pending.get(id)??[];rows.push(packet);pending.set(id,rows)}
 return{fixture,calls,async fetchImpl(url,init={}){
  const rows=pending.get(key(String(url),init.method??'GET',init.body));assert(rows?.length,'Uncaptured Daloopa request '+url)
  const packet=rows.shift(),bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(sha(bytes),packet.sha256);assert.equal(bytes.length,packet.bytes)
  const call={url:String(url),init,packet};calls.push(call)
  const changed=await change?.(bytes,packet,calls.length,call,calls)
  if(changed instanceof Response)return changed
  const response=new Response(changed??bytes,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl,configurable:true});return response
 }}
}

// Test-only replay clock: source/request deadlines and pacing remain unchanged
// in production. Reduced/early-timer cases use a real clock instead.
export async function withDaloopaReplayClock(operation){
 const own=Object.getOwnPropertyDescriptor(performance,'now'),clock=performance.now.bind(performance),timer=globalThis.setTimeout,fetch=globalThis.fetch
 let offset=0
 Object.defineProperty(performance,'now',{configurable:true,value:()=>clock()+offset})
 globalThis.setTimeout=(fn,ms,...args)=>ms>=400&&ms<=501?timer(()=>{offset+=Math.ceil(ms);fn(...args)},0):timer(fn,ms,...args)
 globalThis.fetch=()=>{throw Error('Unexpected real network in Daloopa replay')}
 try{return await operation()}finally{globalThis.fetch=fetch;globalThis.setTimeout=timer;if(own)Object.defineProperty(performance,'now',own);else delete performance.now}
}
export function assertDaloopaCurrentJobs(jobs,fixture=daloopaFixture()){
 // Expected tokens come only from complete genuine fixture bytes, independently
 // of collector output. Preserve native numeric spellings such as0.0 and5.0.
 const token=(text,start)=>{assert(start>=0);while(/\s/.test(text[start]))start++;assert.equal(text[start],'{');let depth=0,quoted=false,escaped=false;for(let index=start;index<text.length;index++){const char=text[index];if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false}else if(char==='"')quoted=true;else if(char==='{')depth++;else if(char==='}'&&--depth===0)return text.slice(start,index+1)}assert.fail('Incomplete original fixture object token')}

 assert.deepEqual(jobs.map(row=>row.jobId),['46','45'])
 for(const[index,job]of jobs.entries()){
  const id=[46,45][index],opening=JSON.parse(Buffer.from(fixture.packets[index===0?3:5].bodyBase64,'base64')),closing=JSON.parse(Buffer.from(fixture.packets[index===0?10:12].bodyBase64,'base64')),listing=JSON.parse(Buffer.from(fixture.packets[2].bodyBase64,'base64')).reqDetailsBOList.find(row=>row.reqId===id)
  assert.equal(job.title,opening.data.reqDetailsBO.reqTitle);assert.equal(job.country,'India');assert.equal(job.nativeCountryCode,null);assert.equal(job.location,'India (Remote)')
  assert.equal(Object.keys(job.nativeDetailData).length,4);assert.equal(Object.keys(job.nativeSourceRecord).length,13)
  assert.deepEqual(job.nativeDetailData,opening.data);assert.deepEqual(job.nativeClosingDetailData,closing.data);assert.deepEqual(job.nativeSourceRecord,opening.data.reqDetailsBO);assert.deepEqual(job.nativeClosingSourceRecord,closing.data.reqDetailsBO)
  assert.deepEqual(job.nativeOriginalEnvelope,opening);assert.deepEqual(job.nativeClosingOriginalEnvelope,closing);assert.notEqual(opening.requestId,closing.requestId)
  assert.deepEqual(job.nativeListingRecord,listing);assert.deepEqual(job.nativeClosingListingRecord,listing)
  const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  const listingText=Buffer.from(fixture.packets[2].bodyBase64,'base64').toString(),detailText=Buffer.from(fixture.packets[index===0?3:5].bodyBase64,'base64').toString(),rawListing=token(listingText,listingText.indexOf('{"reqId":'+id+',')),rawData=token(detailText,detailText.indexOf('"data":')+'"data":'.length),rawRole=token(detailText,detailText.indexOf('"reqDetailsBO":')+'"reqDetailsBO":'.length)
  assert.equal(Object.keys(JSON.parse(rawListing)).length,44);assert.equal(Object.keys(JSON.parse(rawData)).length,4);assert.equal(Object.keys(JSON.parse(rawRole)).length,13);assert(rawListing.includes('"ctcBandLowEnd":0.0'));assert(rawListing.includes('"expMin":5.0'))
  assert.equal(job.sourceDescription,opening.data.reqDetailsBO.jdDisplay+'\n<h2>Original native listing description (plain text)</h2><pre>'+escape(listing.jdDisplay)+'</pre>'+'\n<h2>Original native listing record (all 44 fields)</h2><pre>'+escape(rawListing)+'</pre>'+'\n<h2>Original native detail data (all four fields)</h2><pre>'+escape(rawData)+'</pre>'+'\n<h2>Original native role fields (all 13 fields)</h2><pre>'+escape(rawRole)+'</pre>');assert.equal(job.nativeRawListingRecordJSON,rawListing);assert.equal(job.nativeRawDetailDataJSON,rawData);assert.equal(job.nativeRawRoleRecordJSON,rawRole);assert.equal(job.description,job.sourceDescription);assert.equal(job.jobDescription,job.sourceDescription);assert.equal(job.nativeListingDescription,listing.jdDisplay)
  assert.equal(job.minimumQualification,'SSC (Secondary School Certificate)');assert.equal(job.sourceExperienceRequired,'Native listing expMin: '+listing.expMin+'; expMax: '+listing.expMax+'. Native detail expMin: '+opening.data.reqDetailsBO.expMin+'; expMax: '+opening.data.reqDetailsBO.expMax+'. Original rich criteria retained separately.')
  assert.deepEqual(job.nativeEducationList,['SSC (Secondary School Certificate)']);assert.deepEqual(job.nativeStructuredExperience,{min:5,max:8});assert.equal(job.nativeListingRecord.educationList,null)
  assert(job.sourceDescription.includes('8+ years of PM experience'));assert.equal(job.nativeApprovalDate,listing.approvedOn)
  for(const name of ['postingDate','datePosted','postedDate','nativeDetailPublicationDate','firstEverPublication','closingDate','validThrough','applyUrl','link','nativeApplicationURL','nativeCanonicalURL','sourceCanonicalURL'])assert.equal(job[name],null,name)
  assert.equal(job.sourceUrl,fixture.packets[index===0?4:6].requestedUrl);assert(job.sourceUrl.includes('?src%3Dcareers%26p%3D'))
  for(const name of ['firstParty','sourceCorporateBindingQualified','formalLegalEmployerQualified','activationVerified','currentCSSCoverage','clientDependencyCoverage','sourceRenderedCriteriaComplete','sourceApplicationQualificationComplete','sourceScopeComplete','sourceListingComplete','lifecycleCleanupAllowed','firstPublicationVerified','applicationVisited','nativeLandingContainsRoleData'])assert.equal(job[name],false,name)
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.nativeCriteriaTextComplete,true);assert.equal(job.nativeRoleClosingReconciled,true)
 }
 const audit=jobs.nativeCollectionEvidence;assert.equal(audit.nativeObservedRecordCount,11);assert.deepEqual(audit.qualifiedNativeIndiaIds,[46,45]);assert.deepEqual(audit.unqualifiedCountryIds,[61,57,48,33,31,29,28,20,18]);assert.equal(audit.originalResponses.length,14);assert.equal(audit.physicalReads,14);assert.equal(audit.originalDecodedBytes,283808);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.allOriginalNativeClosingReconciled,true)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.deepEqual(readSourceObservationEvidence(jobs,'daloopa'),{source:'daloopa',recordKind:'vacancy-rows',observedRecordCount:11,observedVacancyCount:11,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
}
