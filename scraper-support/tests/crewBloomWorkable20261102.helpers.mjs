import fs from 'node:fs'
import assert from 'node:assert/strict'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import * as sourceModule from '../../scraper/crewbloom/script.js'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

export const SOURCE='crewbloom'
export const PROFILE=Object.freeze({source:SOURCE,company:'CrewBloom',tenant:'crewbloom',accountUid:'53568b5e-6585-43a9-930b-705aec25df28',careersUrl:'https://crewbloom.com/',companyDomain:'crewbloom.com',reciprocalWebsiteUrl:'https://crewbloom.com/',reconcileClosingInventory:true})
export const source=sourceModule
export const configPath=fileURLToPath(new URL('../../scraper/crewbloom/config.json',import.meta.url))
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/crewbloom/native-captures/2026-11-01-02-native.json.gz',import.meta.url))))
export const bytes=entry=>{const b=Buffer.from(entry.bodyBase64,'base64');assert.equal(sha(b),entry.bodySHA256);return b}
export const account=JSON.parse(bytes(fixture.account)),nativeListing=JSON.parse(bytes(fixture.listing)),nativeDetail=JSON.parse(bytes(fixture.detail))
export const selected=nativeListing.results.find(row=>row.shortcode===nativeDetail.shortcode)
export const foreign=nativeListing.results.find(row=>row.locations.every(location=>location.hidden===false&&location.countryCode!=='IN'))
export const hiddenIndia=nativeListing.results.filter(row=>row.locations.some(location=>location.countryCode==='IN'&&location.hidden===true))
assert.ok(selected&&foreign)
assert.equal(hiddenIndia.length,2)
export const provider=()=>getScraperCatalog().find(p=>p.source===SOURCE)
export const URLS=Object.freeze({corporate:PROFILE.careersUrl,board:'https://apply.workable.com/crewbloom/',account:'https://apply.workable.com/api/v1/accounts/crewbloom?full=true',listing:'https://apply.workable.com/api/v3/accounts/crewbloom/jobs',detail:'https://apply.workable.com/api/v2/accounts/crewbloom/jobs/'+nativeDetail.shortcode})
export const SYNTHETIC_PRIMARY='<title>CrewBloom Careers - SYNTHETIC CONTROL</title><h1>CrewBloom careers</h1><a href="https://apply.workable.com/crewbloom/">Explore remote roles</a>'
export const referenceNow=()=>fixture.detail.metadata.completedAt

// Positive corporate pages and the bounded1/2-role opening/closing envelopes
// below are explicitly SYNTHETIC. The selected record/detail and all original
// six observations remain unchanged. No hidden-role detail is fabricated.
export const exercise=async(t,{change=()=>{},mode='one',registered=false,options={},onCall=null,defaultTransport=false,hiddenIndex=0}={})=>{
  const one={total:1,results:[structuredClone(selected)]}
  const two=[{total:2,results:[structuredClone(foreign)],nextPage:nativeListing.nextPage},{total:2,results:[structuredClone(selected)]}]
  const initial=mode==='two'?two:mode==='native-prefix'?[structuredClone(nativeListing)]:mode==='hidden-one'?[{total:1,results:[structuredClone(hiddenIndia[hiddenIndex])]}]:[one]
  const state={primary:{status:200,url:URLS.corporate,html:SYNTHETIC_PRIMARY},account:structuredClone(account),initial:structuredClone(initial),closing:structuredClone(initial),details:{[nativeDetail.shortcode]:structuredClone(nativeDetail)},closingDetails:null,closingPrimary:null}
  change(state)
  const before=JSON.stringify(state),calls=[]
  let snapshot=-1
  const unavailable=Object.assign(new Error('CONTROLLED unobserved native cursor/detail; no payload invented'),{code:'CONTROLLED_CAPTURE_NOT_AVAILABLE',abortRetries:true})
  const callPage=async(url,init={})=>{
    const call={kind:'page',url,method:init.method||'GET',signal:init.signal,headers:init.headers};calls.push(call)
    if(onCall){const value=await onCall({call,state,calls});if(value!==undefined)return value}
    assert.equal(url,URLS.corporate)
    snapshot++
    return snapshot===1&&state.closingPrimary?state.closingPrimary:state.primary
  }
  const callJson=async(url,init={})=>{
    const call={kind:'json',url,method:init.method||'GET',signal:init.signal,headers:init.headers,...(init.body?{body:JSON.parse(init.body)}:{})};calls.push(call)
    if(onCall){const value=await onCall({call,state,calls});if(value!==undefined)return value}
    if(url===URLS.account){assert.equal(call.method,'GET');return state.account}
    if(url===URLS.listing){
      assert.equal(call.method,'POST')
      assert.deepEqual({...call.body,token:undefined},{query:'',department:[],location:[],workplace:[],worktype:[],token:undefined})
      const pages=snapshot===0?state.initial:state.closing
      const index=Object.hasOwn(call.body,'token')?pages.findIndex(page=>page.nextPage===call.body.token)+1:0
      assert.ok(index>=0)
      if(!pages[index])throw unavailable
      return pages[index]
    }
    const prefix='https://apply.workable.com/api/v2/accounts/crewbloom/jobs/'
    assert.ok(url.startsWith(prefix),'Unexpected exact native request: '+url)
    const id=url.slice(prefix.length),details=snapshot===1&&state.closingDetails?state.closingDetails:state.details
    if(!Object.hasOwn(details,id))throw unavailable
    return details[id]
  }
  let mock,jobs,error,rejected=false
  if(defaultTransport)mock=t.mock.method(globalThis,'fetch',async(input,init={})=>{
    const url=String(input),page=url===URLS.corporate
    const value=page?await callPage(url,init):await callJson(url,init)
    const response=new Response(page?value.html:JSON.stringify(value),{status:page?value.status:200,headers:{'content-type':page?'text/html':'application/json'}})
    Object.defineProperty(response,'url',{value:page?value.url:url})
    return response
  })
  try{
    const runOptions={now:referenceNow,...(!defaultTransport?{fetchPage:callPage,fetchJson:callJson}:{}),...options}
    jobs=registered?await createCatalogScraper(provider()).run(runOptions):await source.run(runOptions)
  }catch(cause){rejected=true;error=cause}
  finally{mock?.mock.restore()}
  assert.equal(JSON.stringify(state),before,'Native/control records must not be mutated')
  return {jobs,error,rejected,calls,state,evidence:readInventoryEvidence(jobs),unavailable}
}
export const assertUnavailable=result=>{
  assert.equal(result.rejected,true)
  assert.equal(result.jobs,undefined)
  assert.notEqual(result.evidence?.status,'verified-empty')
  assert.notEqual(result.error?.inventoryEvidence?.status,'verified-empty')
}
export const assertNativeJob=result=>{
  assert.equal(result.rejected,false)
  assert.equal(result.jobs.length,1)
  const job=result.jobs[0]
  assert.equal(job.source,SOURCE)
  assert.equal(job.company,'CrewBloom')
  assert.equal(job.jobId,nativeDetail.shortcode)
  assert.equal(job.requisitionId,nativeDetail.shortcode)
  assert.equal(job.postingDate,nativeDetail.published)
  assert.equal(job.location,'India')
  assert.equal(job.city,null)
  assert.equal(job.country,'India')
  assert.deepEqual(job.sourceNativeRecord,nativeDetail)
  assert.deepEqual(job.sourceNativeLocations,nativeDetail.locations)
  assert.deepEqual(job.sourceNativeDescriptionSections,{description:nativeDetail.description,requirements:nativeDetail.requirements,benefits:nativeDetail.benefits??null})
  assert.equal(job.sourceNativeEmployerEvidence.legalEmployer,null)
  assert.equal(job.sourceNativeRecord.id,6226544)
  assert.equal(job.sourceNativeRecord.code,'')
  assert.equal(job.sourceNativeRecord.locations.length,3)
  assert.equal(job.sourceNativeRecord.benefits,'')
  assert.match(job.jobDescription,/Requirements/)
  assert.equal(job.sourceUrl,'https://apply.workable.com/crewbloom/j/B486B3B547/')
  assert.equal(job.applyUrl,job.sourceUrl+'apply/')
  return job
}
