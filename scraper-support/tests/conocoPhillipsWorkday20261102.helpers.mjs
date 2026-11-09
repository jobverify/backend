import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import * as sourceModule from '../../scraper/conocophillips.workday/script.js'
import {WorkdayHostCircuitBreaker} from '../myworkday/engine.js'
import {createCatalogScraper,getScraperCatalog} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

export const SOURCE='conocophillips'
export const PROFILE=Object.freeze({
  listingStrategy:'jobs-api',inventoryScope:'complete-board-country-proof',retainProvenIndiaOnUnresolvedLocations:true,
  officialCareersUrl:'https://careers.conocophillips.com/',
  jobsApiUrl:'https://conocophillips.wd1.myworkdayjobs.com/wday/cxs/conocophillips/External/jobs',
  detailUrlBase:'https://conocophillips.wd1.myworkdayjobs.com/External/',
  locationCountry:null,searchText:'',
})
export const source=sourceModule
export const configPath=fileURLToPath(new URL('../../scraper/conocophillips.workday/config.json',import.meta.url))
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL(
  '../../scraper/conocophillips.workday/native-captures/2026-11-01-preflight.json.gz',import.meta.url,
))))
export const packet=kind=>{
  const p=fixture.capturedResponses.find(p=>p.kind===kind)
  assert.ok(p,'Missing captured packet: '+kind)
  const body=Buffer.from(p.bodyBase64,'base64')
  assert.equal(sha(body),p.bodySHA256)
  assert.equal(body.length,p.bodyBytes)
  return {...p,body}
}
export const nativeListing=JSON.parse(packet('unfiltered-listing-prefix').body)
export const nativeDetail=JSON.parse(packet('selected-native-detail').body)
export const selected=nativeListing.jobPostings.find(row=>row.externalPath===new URL(nativeDetail.jobPostingInfo.externalUrl).pathname.split('/External')[1])
assert.ok(selected,'Native listing/detail identity must be the exact captured pair')
export const provider=()=>getScraperCatalog().find(p=>p.source===SOURCE)
export const asResponse=(p,body=p.body)=>{
  const metadata=p.nativeMetadata
  const response=new Response(body,{status:metadata.status,headers:{'content-type':metadata.contentType}})
  Object.defineProperty(response,'url',{value:metadata.finalURL})
  return response
}

// Only these two inventory envelopes are SYNTHETIC. The selected row and all
// native detail fields stay exact. The actual20-of24 prefix is retained above.
// Strict secondary-country handling can stop before the modeled closing read;
// that outcome never certifies India0 or company0.
export const exercise=async(t,{change=()=>{},options={},registered=false,mode='one-role',handle=null}={})=>{
  const state={
    primary:packet('official-careers'),bootstrap:packet('session-bootstrap'),
    detail:structuredClone(nativeDetail),
    opening:{total:1,jobPostings:[structuredClone(selected)],facets:[]},
    closing:{total:1,jobPostings:[structuredClone(selected)],facets:[]},
  }
  change(state)
  const before=JSON.stringify(state),calls=[]
  let posts=0
  const mock=t.mock.method(globalThis,'fetch',async(input,init={})=>{
    const url=String(input),method=init.method||'GET'
    const call={url,method,signal:init.signal,...(init.body?{body:JSON.parse(init.body)}:{})}
    calls.push(call)
    if(handle){const value=await handle({url,method,init,state,calls});if(value!==undefined)return value}
    if(url===PROFILE.officialCareersUrl&&method==='GET')return asResponse(state.primary)
    if(url===PROFILE.detailUrlBase&&method==='GET')return asResponse(state.bootstrap)
    if(url===PROFILE.jobsApiUrl&&method==='POST'){
      assert.deepEqual(call.body.appliedFacets,{})
      assert.equal(call.body.searchText,'')
      assert.equal(call.body.limit,20)
      if(mode==='native-prefix'){
        if(call.body.offset===0){posts++;return asResponse(packet('unfiltered-listing-prefix'))}
        assert.equal(call.body.offset,20)
        throw Object.assign(new Error('CONTROLLED uncaptured native continuation; no page24 or empty response invented'),{abortRetries:true})
      }
      assert.equal(call.body.offset,0)
      assert.ok(++posts<=3,'Only synthetic opening, closing and final board recheck are available')
      return asResponse(packet('unfiltered-listing-prefix'),JSON.stringify(posts===1?state.opening:state.closing))
    }
    if(url===packet('selected-native-detail').nativeMetadata.url&&method==='GET'){
      return asResponse(packet('selected-native-detail'),JSON.stringify(state.detail))
    }
    assert.fail('Unexpected fixture request is forbidden: '+method+' '+url)
  })
  let jobs,error,rejected=false
  try{
    const runOptions={
      requestTimeoutMs:1000,retryBaseDelayMs:0,
      requestScheduler:{acquire:async()=>()=>{},recordRateLimit(){}},
      circuitBreaker:new WorkdayHostCircuitBreaker(),detailCircuitBreaker:new WorkdayHostCircuitBreaker(),
      ...options,
    }
    jobs=registered?await createCatalogScraper(provider()).run(runOptions):await source.run(runOptions)
  }catch(cause){rejected=true;error=cause}
  finally{mock.mock.restore()}
  assert.equal(JSON.stringify(state),before,'No native/mock input field may be mutated')
  return {jobs,error,rejected,calls,state,posts,evidence:readInventoryEvidence(jobs)}
}
export const assertNoAuthority=result=>{
  assert.equal(result.jobs,undefined,'No empty success or partial India vacancy may replace unavailable native scope')
  assert.notEqual(result.evidence?.status,'verified-empty')
  assert.notEqual(result.error?.inventoryEvidence?.status,'verified-empty')
  assert.notEqual(result.error?.inventoryEvidence?.indiaFacetCount,0)
}
export const assertNativeHeld=result=>{
  assert.equal(result.rejected,false)
  assert.deepEqual(result.jobs,[])
  assert.equal(result.evidence?.status,'coverage-gap')
  assert.equal(result.evidence?.listingComplete,false)
  assert.equal(result.evidence?.reportedTotal,null)
  assert.equal(result.evidence?.indiaFacetCount,null)
  const proof=result.jobs[Symbol.for('jobverify.workday.country-inventory-proof')]
  assert.equal(proof.completeSourceScope,false)
  assert.ok(proof.boards[0].unresolvedCountryRoles.length>0)
}
export const assertNativeIncomplete=result=>{
  assertNativeHeld(result)
  assert.ok(result.calls.some(c=>c.url===PROFILE.officialCareersUrl))
  assert.ok(result.calls.some(c=>c.url===PROFILE.detailUrlBase))
  assert.equal(result.calls.filter(c=>c.method==='POST').length,3,'Unknown secondary scope stays held while the known board reconciles')
  assert.equal(result.calls.filter(c=>c.url===packet('selected-native-detail').nativeMetadata.url).length,1)
  assert.ok(result.calls.every(c=>c.signal instanceof AbortSignal))
  assert.deepEqual(result.state.opening.jobPostings[0],selected)
  assert.deepEqual(result.state.detail,nativeDetail)
  assert.equal(result.state.detail.jobPostingInfo.country.descriptor,'United States of America')
  assert.equal(result.state.detail.jobPostingInfo.additionalLocations.length,7)
}

