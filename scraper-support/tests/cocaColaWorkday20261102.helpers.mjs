import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import * as sourceModule from '../../scraper/cocacola.workday/script.js'
import * as vanityModule from '../myworkday/officialVanityCareers.js'
import {runWorkdayScraper,WorkdayHostCircuitBreaker} from '../myworkday/engine.js'
import {createCatalogScraper,getScraperCatalog} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

export const source=sourceModule,vanity=vanityModule
export const SOURCE='cocacola',COMPANY='Coca-Cola'
export const URLS=Object.freeze({primary:'https://www.coca-colacompany.com/careers',vanity:'https://careers.coca-colacompany.com/',board:'https://coke.wd1.myworkdayjobs.com/coca-cola-careers',api:'https://coke.wd1.myworkdayjobs.com/wday/cxs/coke/coca-cola-careers/jobs'})
export const PROFILE=Object.freeze({listingStrategy:'jobs-api',inventoryScope:'complete-board-country-proof',retainProvenIndiaOnUnresolvedLocations:true,officialCareersUrl:URLS.primary,officialVanityCareersUrl:URLS.vanity,officialVanityRedirectStatus:301,jobsApiUrl:URLS.api,detailUrlBase:URLS.board,locationCountry:null,searchText:''})
export const configPath=fileURLToPath(new URL('../../scraper/cocacola.workday/config.json',import.meta.url))
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/cocacola.workday/native-captures/2026-11-02-native-chain.json.gz',import.meta.url))))
export const packet=kind=>{
 const row=fixture.responses.find(p=>p.kind===kind);assert.ok(row,kind)
 const body=Buffer.from(row.bodyBase64,'base64'),metadata=row.metadata.packet||row.metadata
 assert.equal(sha(body),row.bodySHA256);assert.equal(body.length,row.bodyBytes)
 assert.equal(sha(Buffer.from(row.metadataRawBase64,'base64')),row.metadataSHA256)
 return {...row,body,packet:metadata}
}
export const nativeListing=JSON.parse(packet('listing').body)
export const provider=()=>getScraperCatalog().find(p=>p.source===SOURCE)
export const responseFor=(kind,changes={})=>{
 const input=packet(kind),p=input.packet,metadata={...p,...changes}
 const headers={...(p.responseHeaders||p.headers||{})}
 delete headers['set-cookie']
 if(changes.body!==undefined&&(typeof changes.body==='string'||changes.body instanceof Uint8Array)&&!Object.hasOwn(changes.headers||{},'content-length'))headers['content-length']=String(Buffer.byteLength(changes.body))
 if(changes.headers)Object.assign(headers,changes.headers)
 if(p.location&&!Object.hasOwn(headers,'location'))headers.location=p.location
 if(changes.location!==undefined)headers.location=changes.location
 if(changes.omitLocation)delete headers.location
 const response=new Response(changes.body??input.body,{status:metadata.status,headers})
 const url=changes.url??p.responseUrl??p.finalURL??p.finalUrl
 Object.defineProperty(response,'url',{value:url})
 for(const [key,value]of Object.entries({capturedAt:p.completedAt,captureStartedAt:p.attemptedAt}))Object.defineProperty(response,key,{value,writable:false,configurable:true,enumerable:true})
 return response
}
export const clocks=kind=>({capturedAt:packet(kind).packet.completedAt,captureStartedAt:packet(kind).packet.attemptedAt})
export const actualHandoff=(options={})=>vanity.currentWorkdayVanityHandoffReceipt({officialCareersUrl:URLS.primary,vanityCareersUrl:URLS.vanity,boardUrl:URLS.board,response:responseFor('primary'),html:packet('primary').body.toString('utf8'),clocks:clocks('primary'),...options})
export const requireRedirect=()=>{
 for(const name of ['currentWorkdayVanityRedirectReceipt','currentWorkdayVanityRedirectBoardReceipt','readBoundedWorkdayVanityRedirect','readBoundedWorkdayVanityChainHtml'])assert.equal(typeof vanity[name],'function','Missing explicit exact301 capability: '+name)
}
export const actualRedirect=(handoff=actualHandoff(),options={})=>{
 requireRedirect()
 return vanity.currentWorkdayVanityRedirectReceipt({handoff,response:responseFor('redirect'),body:packet('redirect').body,clocks:clocks('redirect'),...options})
}
export const actualReceipt=(options={})=>{
 const handoff=actualHandoff(),redirect=actualRedirect(handoff)
 return vanity.currentWorkdayVanityRedirectBoardReceipt({handoff,redirect,response:responseFor('bootstrap'),html:packet('bootstrap').body.toString('utf8'),clocks:clocks('bootstrap'),...options})
}
export const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
export const flush=async()=>{for(let turn=0;turn<6;turn++)await new Promise(setImmediate)}

export const exercise=async(t,{entry='engine',config={},options={},responses={},customFetch=null,onResponse=()=>{},cookies=false}={})=>{
 const directory=entry==='engine'?fs.mkdtempSync(path.join(os.tmpdir(),'cocacola-redirect-')):null
 if(directory){
  fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify({...PROFILE,...config}))
  t.after(()=>{const target=fs.realpathSync(directory);assert.equal(path.dirname(target),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(target).startsWith('cocacola-redirect-'));fs.rmSync(target,{recursive:true})})
 }
 const calls=[],slots=new Set()
 let released=0,jobs,error,rejected=false,boardRequests=0
 const stop=Object.assign(new Error('CONTROLLED uncaptured offset20; no extra native page or detail invented'),{code:'CONTROLLED_UNCAPTURED_COKE_PREFIX',abortRetries:true})
 const diagnosticUnavailable=Object.assign(new Error('CONTROLLED unobserved post-failure diagnostic board read; no response invented'),{abortRetries:true})
 const mock=t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const url=String(input),call={url,method:init.method||'GET',signal:init.signal,headers:init.headers,redirect:init.redirect,...(init.body?{body:JSON.parse(init.body)}:{})};calls.push(call)
  if(customFetch)return customFetch(url,init,calls)
  let kind=url===URLS.primary?'primary':url===URLS.vanity?'redirect':url===URLS.board?'bootstrap':url===URLS.api?'listing':null
  assert.ok(kind,'Undeclared native request: '+url)
  if(kind==='bootstrap'&&++boardRequests>1)throw diagnosticUnavailable
  if(kind==='listing'){
   assert.equal(call.method,'POST');assert.deepEqual({...call.body,offset:0},{appliedFacets:{},limit:20,offset:0,searchText:''})
   if(call.body.offset===20)throw stop
   assert.equal(call.body.offset,0)
  }else assert.equal(call.method,'GET')
  const response=responseFor(kind,responses[kind]||{})
  if(cookies&&kind==='redirect'){response.headers.append('set-cookie','CALYPSO_CSRF_TOKEN=SYNTHETIC_REDIRECT_ONLY; Path=/');response.headers.append('set-cookie','SYNTHETIC_REDIRECT_COOKIE=excluded; Path=/')}
  if(cookies&&kind==='bootstrap'){response.headers.append('set-cookie','CALYPSO_CSRF_TOKEN=SYNTHETIC_BOARD_ONLY; Path=/');response.headers.append('set-cookie','SYNTHETIC_BOARD_COOKIE=included; Path=/')}
  onResponse(response,kind)
  return response
 })
 try{
  const runOptions={requestTimeoutMs:1000,retryBaseDelayMs:0,requestScheduler:{acquire:async()=>{const slot=Symbol('owned-native-slot');slots.add(slot);return ()=>{slots.delete(slot);released++}},recordRateLimit(){}},circuitBreaker:new WorkdayHostCircuitBreaker(),detailCircuitBreaker:new WorkdayHostCircuitBreaker(),...options}
  if(entry==='source')jobs=await source.run(runOptions)
  else if(entry==='registered')jobs=await createCatalogScraper(provider()).run(runOptions)
  else jobs=await runWorkdayScraper({source:SOURCE,company:COMPANY,baseUrl:URLS.board,scraperDir:directory,locationCountry:null,...runOptions})
 }catch(cause){rejected=true;error=cause}
 finally{mock.mock.restore()}
 return {jobs,error,rejected,calls,stop,diagnosticUnavailable,slots,released,evidence:readInventoryEvidence(jobs)}
}
export const assertPrefixUnavailable=result=>{
 assert.equal(result.rejected,true)
 assert.equal(result.error,result.stop)
 assert.equal(result.jobs,undefined)
 assert.equal(result.evidence,null)
 assert.deepEqual(result.calls.map(c=>c.url),[URLS.primary,URLS.vanity,URLS.board,URLS.api,URLS.api,URLS.board])
 assert.deepEqual(result.calls.filter(c=>c.url===URLS.api).map(c=>c.body.offset),[0,20])
 const firstCxs=result.calls.findIndex(c=>c.url===URLS.api)
 assert.equal(result.calls.slice(0,firstCxs).filter(c=>c.url===URLS.board).length,1,'Only one startup board response establishes proof and session')
 assert.equal(result.calls.at(-1).url,URLS.board,'The unchanged post-error outage probe is controlled unavailable, not a second bootstrap response')
 assert.equal(result.slots.size,0)
 assert.equal(nativeListing.total,210)
 assert.equal(nativeListing.jobPostings.length,20)
 assert.equal(nativeListing.jobPostings.filter(r=>r.locationsText==='2 Locations').length,2)
}
