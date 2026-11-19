import test,{mock} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,createKumaranSystemsScraper} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-declared-20261119.json.gz',import.meta.url))))
let activeFetch=()=>assert.fail('uncaptured public read')
mock.method(globalThis,'fetch',(...args)=>activeFetch(...args))
const firstDetail='https://careers.kumaran.com/recruit/v2/public/Job_Openings/31840000021996116?source=CareerSite&pagename=Careers'
const replay=(edit=()=>{})=>async(url,init)=>{
 if(init.redirect!==undefined)assert.equal(init.redirect,'manual')
 assert.equal(init.method??'GET','GET')
 const p=structuredClone(fixture.packets.find(p=>p.url===url));assert.ok(p,'only actual declared current resources '+url)
 edit(p)
 return Object.defineProperty(new Response(p.text,{status:p.status,headers:p.headers}),'url',{value:p.finalUrl??p.url})
}
test('Kumaran current declared Astro/Zoho tuple reaches the full native role read through its typed67-record portal',async()=>{
 const stop=Error('full current native role reached'),fetchImpl=replay(p=>{if(p.url===firstDetail)throw stop})
 activeFetch=fetchImpl
 await assert.rejects(run({fetchImpl,requestIntervalMs:0}),error=>error===stop)
})
test('Kumaran rejects a current foreign or unreviewed public widget executable before native enumeration',async()=>{
 for(const edit of [
  p=>{if(p.url.includes('/_astro/Careers.'))p.text=p.text.replace('site:"https://careers.kumaran.com"','site:"https://foreign.zohorecruit.com"')},
  p=>{if(p.url.includes('/embed_jobs.js'))p.text+=';unreviewedEmployerOverride()'},
 ]){
  const fetchImpl=replay(edit);activeFetch=fetchImpl
  await assert.rejects(run({fetchImpl,requestIntervalMs:0}),/program|tuple|client|publisher|changed/i)
 }
})

test('Kumaran factory entry also rejects body-only clients before any public read',async()=>{
 let read=false
 await assert.rejects(createKumaranSystemsScraper().run({fetchText:async()=>{read=true;throw Error('unsafe legacy entry')}}),/metadata-aware/)
 assert.equal(read,false)
})

const native=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
async function full(change=()=>{},options={}){
 const calls=[],visits=new Map()
 const fetchImpl=async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const count=visits.get(url)??0;visits.set(url,count+1)
  const all=native.packets.filter(p=>p.requestedUrl===url),p=structuredClone(all[count])
  assert.ok(p,'only captured native request '+url+' #'+count)
  change(p,url,count+1);calls.push(url)
  return Object.defineProperty(new Response(p.text,{status:p.status,headers:p.headers}),'url',{value:p.finalUrl})
 }
 activeFetch=fetchImpl
 const jobs=await run({fetchImpl,requestIntervalMs:0,now:native.capturedAt,...options})
 return{jobs,calls,evidence:jobs.nativeCollectionEvidence}
}

test('Kumaran128 original current responses preserve51 full India records,67 raw rows and array cleanup hold',async()=>{
 const {jobs,calls,evidence}=await full()
 assert.equal(jobs.length,51);assert.equal(calls.length,128)
 assert.equal(evidence.rawNativeOpeningInventory.data.length,67)
 assert.equal(evidence.rawNativeClosingInventory.data.length,67)
 assert.equal(evidence.originalResponses.length,128)
 assert.equal(evidence.sourceScopeComplete,false);assert.equal(evidence.lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.sourceClosingQualified&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
})

const editDetail=(change,visitOnly)=>((p,url,visit)=>{
 if(url!==firstDetail||visitOnly&&visit!==visitOnly)return
 const data=JSON.parse(p.text);change(data.data[0]);p.text=JSON.stringify(data)
})
for(const [name,change]of[
 ['foreign role employer',r=>{r.Entity='Unrelated Employer'}],
 ['additional unreviewed criteria',r=>{r.Mandatory_Certification='Another qualification must be met'}],
 ['hidden criteria',r=>{r.Job_Description+='<p hidden>Mandatory additional certification omitted from visible criteria</p>'}],
 ['full criteria only on request',r=>{r.Job_Description='<p>This is a preview only. The complete job requirements and qualifications are available on request. Contact the recruiter to obtain the complete required criteria for this position.</p>'}],
])test('Kumaran quarantines '+name+' and retains its raw native payload without dropping the other50 roles',async()=>{
 const {jobs,evidence}=await full(editDetail(change))
 assert.equal(jobs.length,50);assert.ok(!jobs.some(j=>j.jobId==='31840000021996116'))
 assert.ok(evidence.originalResponses.some(p=>p.url===firstDetail))
 assert.equal(evidence.lifecycleCleanupAllowed,false)
})

for(const [name,change]of[
 ['contradictory native country',r=>{r.Country='United States'}],
 ['foreign native application',r=>{r.$appy_url=r.$appy_url.replace('careers.kumaran.com','foreign.example')}],
 ['malformed native required skills',r=>{r.Required_Skills=[{name:''}]}],
])test('Kumaran rejects '+name,async()=>{
 await assert.rejects(full(editDetail(change)),/Zoho native inventory:/)
})

test('Kumaran whole closing detail changes quarantine that role and preserve both original models',async()=>{
 const {jobs,evidence}=await full(editDetail(r=>{r.Job_Description+='<p>Additional mandatory current qualification.</p>'},2))
 assert.equal(jobs.length,50)
 const held=evidence.heldRecords.find(r=>r.jobId==='31840000021996116')
 assert.equal(held.reason,'whole-native-detail-closing-changed')
 assert.notEqual(held.opening.data[0].Job_Description,held.closing.data[0].Job_Description)
})

test('Kumaran does not qualify an edited whole closing listing even if its role identity stays stable',async()=>{
 await assert.rejects(full((p,url,visit)=>{
  if(url==='https://careers.kumaran.com/recruit/v2/public/Job_Openings?source=CareerSite&pagename=Careers'&&visit===2){
   const data=JSON.parse(p.text);data.data[0].Job_Description+=' Changed listing preview';p.text=JSON.stringify(data)
  }
 }),/whole closing native listing model changed/)
})

test('Kumaran preserves exact pre-cancellation with no fetch and stops after caller cancellation inside a current read',async()=>{
 const before=new AbortController(),reason=Error('Kumaran caller cancellation');before.abort(reason)
 let reads=0
 await assert.rejects(run({signal:before.signal,fetchImpl:()=>{reads++;assert.fail('no read after pre-cancel')}}),e=>e===reason)
 assert.equal(reads,0)
 const during=new AbortController()
 await assert.rejects(full((p,url)=>{if(url===firstDetail)during.abort(reason)},{signal:during.signal}),e=>e===reason)
})
