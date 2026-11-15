import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../../scraper-support/utils/sourceObservationEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
export const yourNestFixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('./native-data-20261115.json.gz',import.meta.url))))
export function createYourNestReplay(change){
 const fixture=yourNestFixture(),calls=[],pending=new Map(),counts=new Map()
 for(const item of fixture.schedule){const packet=fixture.packets[item.packetIndex],rows=pending.get(packet.requestedUrl)??[];rows.push(packet);pending.set(packet.requestedUrl,rows)}
 return{fixture,calls,async fetchImpl(url,init={}){
  const rows=pending.get(String(url));assert(rows?.length,'Uncaptured YourNest request '+url)
  const packet=rows.shift(),bytes=Buffer.from(packet.bodyBase64,'base64'),count=(counts.get(String(url))??0)+1;counts.set(String(url),count)
  assert.equal(sha(bytes),packet.sha256);assert.equal(bytes.length,packet.bytes);assert.equal(packet.redirected,false)
  const call={url:String(url),init,packet,count};calls.push(call)
  const changed=await change?.(bytes,packet,count,call,calls)
  if(changed instanceof Response)return changed
  const response=new Response(changed??bytes,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl,configurable:true});return response
 }}
}

// Test-only virtual pacing. There is no production pacing/deadline bypass.
// Cases using reduced deadlines use the real clock rather than this helper.
export async function withYourNestReplayClock(operation){
 const own=Object.getOwnPropertyDescriptor(performance,'now'),clock=performance.now.bind(performance),timer=globalThis.setTimeout,fetch=globalThis.fetch
 let offset=0
 Object.defineProperty(performance,'now',{configurable:true,value:()=>clock()+offset})
 globalThis.setTimeout=(fn,ms,...args)=>ms>=400&&ms<=501?timer(()=>{offset+=Math.ceil(ms);fn(...args)},0):timer(fn,ms,...args)
 globalThis.fetch=()=>{throw Error('Unexpected real network in YourNest fixture replay')}
 try{return await operation()}finally{globalThis.fetch=fetch;globalThis.setTimeout=timer;if(own)Object.defineProperty(performance,'now',own);else delete performance.now}
}

export function assertYourNestCurrentJobs(jobs,fixture=yourNestFixture()){
 assert.equal(jobs.length,1);const job=jobs[0],api=JSON.parse(Buffer.from(fixture.packets[2].bodyBase64,'base64'))
 assert.equal(job.jobId,'425748');assert.equal(job.country,'India');assert.equal(job.companyName,'YourNest');assert.equal(job.title,api.title)
 assert.deepEqual(job.nativeSourceRecord,api);assert.deepEqual(job.nativeClosingSourceRecord,api)
 assert.deepEqual(job.nativeSSRSourceRecord.props.pageProps.jobDetails,api)
 assert.equal(job.nativeJobPostingSourceRecord.description,api.description);assert.equal(job.sourceDescription,api.description)
 assert.deepEqual(job.nativeScreeningQuestions,api.job_screening_questions);assert.equal(job.nativeScreeningQuestions.length,2)
 assert.equal(job.postingDate,'2026-11-06T16:48:45.086766+05:30');assert.equal(job.validThrough,'2027-01-05T16:48:45.086766+05:30')
 assert.equal(job.firstPublicationVerified,false);assert.equal(job.firstEverPublication,null)
 assert.equal(job.applyUrl,null);assert.equal(job.link,null);assert.equal(job.nativeApplicationURL,null)
 assert(job.nativeUnqualifiedApplyHref.includes('company_uuid=undefined'));assert(job.nativeUnqualifiedApplyHref.includes('isHeaderVisible=undefined'))
 for(const name of ['firstParty','sourceCorporateBindingQualified','formalLegalEmployerQualified','activationVerified','currentCSSCoverage','clientDependencyCoverage','sourceRenderedCriteriaComplete','sourceApplicationQualificationComplete','sourceScopeComplete','sourceListingComplete','lifecycleCleanupAllowed'])assert.equal(job[name],false,name)
 assert.equal(job.sourceDetailComplete,true);assert.equal(job.nativeCriteriaTextComplete,true)
 const audit=jobs.nativeCollectionEvidence;assert.equal(audit.nativeObservedRecordCount,4);assert.equal(audit.nativeCandidates.length,4)
 assert.deepEqual(audit.nativeCandidates.map(row=>[row.id,row.exclusionReason]),[[425748,null],[376083,'native-expired'],[374870,'native-expired'],[43774,'generic-talent-pool']])
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.allOriginalNativeClosingReconciled,true)
 assert.equal(audit.originalResponses.length,20);assert.equal(audit.limits.sourceTimeoutMs,30000);assert.equal(audit.limits.maxRequests,20)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.deepEqual(readSourceObservationEvidence(jobs,'yournest'),{source:'yournest',recordKind:'mixed',observedRecordCount:4,observedVacancyCount:3,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
}
