import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../../../scraper-support/utils/inventoryEvidence.js'
export const replayCurrent=(source,mutate=()=>{})=>{
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../'+source+'/test-data/native-current-20261103.json.gz',import.meta.url)))),entities=new Map(fixture.responses.map(r=>[r.url,r])),requests=[]
 return{requests,options:{fetchPage:async url=>{requests.push(url);const original=entities.get(url);assert.ok(original,'Only captured declared native public URLs: '+url);const page={url:original.finalUrl,status:original.status,headers:original.headers,bodyBase64:original.bodyBase64};await mutate(url,page);return page}}}
}
export const checkCurrentSourceFactory=async(source,factory)=>{
 const state=replayCurrent(source),jobs=await factory(state.options).run(),audit=jobs.sourceAudit,count=source==='buildkite'?8:82
 assert.equal(audit.nativeAudit.opening.publisherQualified,true);assert.equal(audit.nativeAudit.closing.publisherQualified,true)
 assert.equal(audit.observations.length,count);assert.equal(audit.observations.filter(r=>r.sourceNativeDetailQualified).length,count)
 assert.ok(audit.observations.every(r=>r.sourceNativeRecord?.id===Number(r.jobId)&&r.sourceNativeRecord.content&&r.jobDescription&&r.sourceNativeOwnBodySHA256))
 assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,source==='tripadvisor')
}
export const checkChangedSourcePublisher=async(source,factory)=>{
 const primary=source==='buildkite'?'https://buildkite.com/about/careers/':'https://careers.tripadvisor.com/',state=replayCurrent(source,(url,page)=>{if(url===primary)page.bodyBase64=Buffer.from('<title>Unrelated publisher</title>').toString('base64')}),jobs=await factory(state.options).run(),audit=jobs.sourceAudit
 assert.equal(audit.nativeAudit.opening.publisherQualified,false);assert.equal(audit.nativeAudit.closing.publisherQualified,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null);assert.equal(jobs.length,0)
}
