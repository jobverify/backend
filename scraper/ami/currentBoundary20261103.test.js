import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,LINKEDIN_COMPANY_PAGE_URL,LINKEDIN_INDIA_JOBS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

globalThis.fetch=()=>{throw Error('Offline AMI source boundary network tripwire')}
const packets=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url)))),pages=new Map(packets.map(packet=>[packet.requestedUrl,packet])),page=url=>structuredClone(pages.get(url))

test('AMI preserves actual native Jobs filtering as an unknown configured employer inventory',async()=>{
 const calls=[];let audit
 const jobs=await run({fetchPage:async url=>{calls.push(url);assert.ok(pages.has(url));return page(url)},onAudit:value=>{audit=value}})
 assert.deepEqual(calls,[LINKEDIN_COMPANY_PAGE_URL,LINKEDIN_INDIA_JOBS_URL,LINKEDIN_COMPANY_PAGE_URL,LINKEDIN_INDIA_JOBS_URL]);assert.equal(jobs.length,0)
 assert.deepEqual(audit.opening.search.nativeKeywords,['Jobs']);assert.equal(audit.opening.search.unfilteredEmployerInventoryQualified,false)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.privateApplicationRequests,0)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

test('AMI run forwards caller cancellation without making an unowned public request',async()=>{
 const caller=new AbortController(),reason=Object.freeze({caller:'AMI-before'});caller.abort(reason);let reads=0
 await assert.rejects(run({signal:caller.signal,fetchPage:async()=>{reads++;return page(LINKEDIN_COMPANY_PAGE_URL)}}),error=>error===reason);assert.equal(reads,0)
})

test('AMI first denied public route stops source locally without browser or corporate fallback',async()=>{
 let reads=0,browser=0;await assert.rejects(run({fetchPage:async url=>{reads++;return{url,status:403,html:'Denied'}},fetchBrowserText:()=>{browser++}}),error=>error.status===403&&error.abortRetries&&!error.abortPipeline);assert.equal(reads,1);assert.equal(browser,0)
})

test('AMI supplied signal-honoring reader is bounded by its owned deadline',async()=>{
 const caller=new AbortController();let transportSignal
 const work=run({signal:caller.signal,collectionBudgetMs:30,fetchPage:(_url,request)=>{transportSignal=request.signal;return new Promise((resolve,reject)=>request.signal.addEventListener('abort',()=>reject(request.signal.reason),{once:true}))}})
 await assert.rejects(Promise.race([work,new Promise((_,reject)=>setTimeout(()=>reject(Error('AMI deadline ignored')),250))]),error=>error.code==='AMI_COLLECTION_TIMEOUT');assert.equal(transportSignal.aborted,true);assert.equal(caller.signal.aborted,false)
})

test('AMI active organization identity is required while unrelated hidden application fields are not',async()=>{
 await assert.rejects(run({fetchPage:async url=>{const packet=page(url);packet.html='<template>'+packet.html+'</template>';return packet}}))
 const jobs=await run({fetchPage:async url=>{const packet=page(url);packet.html=packet.html.replace(/<input\b[^>]*>/gi,'');return packet}});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('AMI filtered public cards remain unqualified observations instead of acquiring an invented requisition or employer',async()=>{
 const card='<div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:4445556667"><a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/4445556667"><h3 class="base-search-card__title">Firmware Engineer</h3></a><h4 class="base-search-card__subtitle"><a>Other employer</a></h4><span class="job-search-card__location">Chennai, Tamil Nadu, India</span></div>';let audit
 const jobs=await run({fetchPage:async url=>{const packet=page(url);if(url===LINKEDIN_INDIA_JOBS_URL)packet.html=packet.html.replace('</body>',card+'</body>');return packet},onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0);assert.equal(audit.observedCandidates.length,1);assert.equal(audit.observedCandidates[0].jobId,'4445556667');assert.equal(audit.observedCandidates[0].requisitionId,null);assert.equal(audit.observedCandidates[0].company,null);assert.equal(audit.observedCandidates[0].sourceNativeObservedEmployer,'Other employer');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
