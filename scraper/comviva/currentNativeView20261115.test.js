import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/current-native.json.gz',import.meta.url))))
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261115/current-native-role-view.json.gz',import.meta.url))))
const groups=new Map()
for(const fixture of [historical,current]){
 const incoming=new Map()
 for(const packet of fixture.packets){
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(bytes.length,packet.bodyBytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256)
  if(!incoming.has(packet.requestedURL))incoming.set(packet.requestedURL,[])
  incoming.get(packet.requestedURL).push(packet)
 }
 for(const [url,packets]of incoming)groups.set(url,packets)
}
const careers='https://www.comviva.com/careers/explore-opportunity/'
const key='VkZUbnpKcFNPaUFzWitxQUNzU25sZz09',cp='Z3RkUkt2OXZJVld2MjFpOVRSTXoxZz09'
const api='https://careerapi.ceipal.com/'+key+'/CareerPortalJobPostings/'
const firstPage=JSON.parse(Buffer.from(groups.get(api+'?page=1')[0].bodyBase64,'base64'))
const native=firstPage.results.find(row=>row.job_code==='4528')
const detailURL=api+native.id+'/?from_career_portal=1&cp_id='+cp
const handoffURL='https://careerapi.ceipal.com/careerPortalWidget/?themeid=&bgcolor=&job_id='+encodeURIComponent(native.id)+'&apikey='+key+'&cp_id='+cp
const viewURL=current.packets.find(packet=>packet.requestedURL.startsWith('https://jobsapi.ceipal.com/')&&packet.requestedURL.includes('job_id='+native.id)).requestedURL
const provider=()=>getScraperCatalog().find(row=>row.source==='comviva')

// The reduced listing envelope is a labelled synthetic control; the native
// role, detail, returned iframe, programs, styles and HTTP/CSP remain actual.
function replay({allRows=false,edit=value=>value,editResponse=value=>value}={}){
 const seen=new Map(),calls=[]
 return {calls,options:{now:()=>current.capturedAt,fetchImpl:async(url,init={})=>{
  const index=seen.get(url)||0;seen.set(url,index+1);calls.push({url,method:init.method||'GET'})
  const packets=groups.get(url)
  if(!packets)throw Error('Labelled fixture has no independent native-view receipt for '+url)
  const packet=packets[Math.min(index,packets.length-1)]
  let value=Buffer.from(packet.bodyBase64,'base64').toString('utf8')
  if(!allRows&&url===api+'?page=1')value=JSON.stringify({...JSON.parse(value),count:1,num_pages:1,page_count:1,next:null,results:[structuredClone(native)]})
  value=edit(value,url,index)
  const response=editResponse({status:packet.status,headers:Object.fromEntries(new Headers(packet.headers))},url,index)
  const result=new Response(value,response)
  Object.defineProperty(result,'url',{value:packet.finalURL})
  return result
 }}}
}

test('registered Comviva independently qualifies an actual same-job native role view while retaining the corporate UI hold',async()=>{
 const {calls,options}=replay(),jobs=await createCatalogScraper(provider()).run(options)
 assert.equal(jobs.length,1)
 const [job]=jobs,audit=jobs.nativeCollectionEvidence,proof=audit.nativeIndiaDetailProofs[0]
 assert.equal(job.sourceUrl,viewURL);assert.equal(job.applyUrl,viewURL)
 assert.equal(job.sourceCorporateUIQualified,false)
 assert.equal(job.sourceApplicationEvidence.corporatePublisherQualified,false)
 assert.equal(job.sourceApplicationEvidence.activePublicUI,true)
 assert.equal(job.sourceApplicationEvidence.backendAcceptanceAssumed,false)
 assert.equal(job.country,'India');assert.equal(job.sourceNativeId,native.id)
 assert.equal(job.sourceDescription,JSON.parse(Buffer.from(groups.get(detailURL)[0].bodyBase64,'base64')).public_job_desc)
 assert.equal(job.sourceScopeComplete,false);assert.equal(job.sourceListingComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 assert.equal(audit.openingSurface.publisher.complete,false);assert.equal(audit.closingSurface.publisher.complete,false)
 assert.equal(proof.nativeRoleViewQualified,true);assert.equal(proof.publisherComplete,false)
 assert.equal(proof.openingNativeRoleView.viewURL,viewURL);assert.equal(proof.closingNativeRoleView.viewURL,viewURL)
 assert.equal(calls.filter(call=>call.url===viewURL).length,2)
 assert.equal(calls.filter(call=>call.url===handoffURL).length,2)
 assert.ok(calls.filter(call=>call.url===viewURL||call.url===handoffURL).every(call=>call.method==='GET'))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 assert.equal(assessSoftFailureAcquisition(provider(),jobs).runnerOutcome.success,true)
})

test('independent native-view recovery retains all original rows and holds the unread native views',async()=>{
 const {options}=replay({allRows:true}),jobs=await createCatalogScraper(provider()).run(options)
 assert.equal(jobs.length,1)
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.sourceNativeRaw.length,159);assert.equal(audit.nativeIndiaDetailProofs.length,150)
 assert.equal(audit.withheldIndiaCount,149)
 assert.ok(audit.nativeIndiaDetailProofs.every(proof=>proof.openingNativeDetail&&proof.closingNativeDetail))
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
})

for(const [name,edit]of [
 ['wrong selected role',(value,url)=>url===handoffURL?value.replaceAll(native.id,'z5G7h3l6a1kMvyS65NP3c5OTHER_ROLE='):value],
 ['wrong native employer',(value,url)=>url===handoffURL?value.replaceAll(cp,'different-native-employer'):value],
 ['changed closing native shell',(value,url,index)=>url===viewURL&&index===1?value+'<style>body{display:none}</style>':value],
 ['changed corporate target ancestry',(value,url)=>{
  if(url!==careers)return value
  const target='<div><iframe id="careers_api_source"'
  assert.ok(value.includes(target),'actual fixture native iframe ancestry is present')
  return value.replace(target,'<div hidden><iframe id="careers_api_source"')
 }],
 ['executable Flight suffix',(value,url)=>url===careers?value.replace('</body>','<script>window.hideAllJobs()</script></body>'):value],
 ['inconsistent Flight nonce',(value,url)=>url===careers?value.replace('nonce\\":\\"','nonce\\":\\"invalid-'):value],
 ['foreign native detail',(value,url)=>url===detailURL?JSON.stringify({...JSON.parse(value),country:'Canada'}):value],
])test(name+' cannot qualify the independently delegated native view',async()=>{
 const {options}=replay({edit}),jobs=await createCatalogScraper(provider()).run(options)
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.sourceNativeRaw.length,1)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})

for(const [name,editResponse]of [
 ['missing observed publisher CSP',(response,url)=>{if(url===careers)delete response.headers['content-security-policy'];return response}],
 ['conflicting corporate CSP',(response,url)=>{if(url===careers)response.headers['content-security-policy']="default-src 'none'; script-src 'none'";return response}],
 ['restrictive selected native-view CSP',(response,url)=>{if(url===viewURL)response.headers['content-security-policy']="default-src 'none'; script-src 'none'";return response}],
])test(name+' preserves the native record without publishing a vacancy',async()=>{
 const {options}=replay({editResponse}),jobs=await createCatalogScraper(provider()).run(options)
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs.length,1)
})

test('a closing selected native-view denial cannot be repaired by its opening proof',async()=>{
 const {options}=replay({editResponse:(response,url,index)=>url===viewURL&&index===1?{...response,status:403}:response})
 await assert.rejects(createCatalogScraper(provider()).run(options),/403/)
})
