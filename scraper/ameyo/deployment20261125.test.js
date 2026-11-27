import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/deployment-20261125.json.gz',import.meta.url))))
const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261120.json.gz',import.meta.url))))
const text=p=>Buffer.from(p.bodyBase64,'base64').toString()
function replay(edit=(p,body)=>body){
 const reads=[],seen=new Map()
 return{reads,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const packets=capture.packets.filter(p=>p.requestedUrl===url),count=seen.get(url)??0;seen.set(url,count+1)
  const p=packets[count];assert.ok(p,'Only captured employer-declared opening and closing reads');reads.push(url)
  return Object.defineProperties(new Response(edit(p,text(p),count),{status:p.status,headers:p.headers}),{url:{value:p.url},redirected:{value:p.redirected}})
 }}}
}

test('Ameyo finite current corporate build retains every parent-feed criterion and application without promoting Exotel rows',async()=>{
 const r=replay(),jobs=await run(r.options),e=jobs.nativeCollectionEvidence
 const original=JSON.parse(text(capture.packets.find(p=>p.requestedUrl.endsWith('/widget/2176/openings/'))))
 assert.equal(jobs.length,0);assert.deepEqual(e.nativeOpeningInventory.fullRows,original)
 assert.ok(original.length>30);assert.ok(original.every(row=>row.company_name==='Exotel Techcom Pvt Ltd'))
 assert.equal(e.failures.length,original.length);assert.equal(e.closingFullNativeInventoryMatch,true)
 assert.equal(e.publicEligibility,null);assert.equal(e.companyIndiaTotal,null);assert.equal(e.sourceScopeComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(e.retainedResponses.length,r.reads.length)
})

test('Ameyo finite build rejects old/new corporate mixing and unknown native code',async()=>{
 await assert.rejects(run(replay((p,body)=>p.requestedUrl==='https://exotel.com/about-us/careers/'
  ?text(historical.responses.find(row=>row.url===p.requestedUrl)):body).options),/profile/)
 await assert.rejects(run(replay((p,body)=>p.requestedUrl.endsWith('/0ron4gsg4ubd4.js')
  ?body+';globalThis.unreviewedHiringRule=true':body).options),/profile/)
})

test('Ameyo current exact product handoff and full unknown-country application closing controls remain strict',async()=>{
 await assert.rejects(run(replay((p,body)=>p.requestedUrl==='https://exotel.com/ameyo-contact-center-by-exotel/'
  ?body.replaceAll('/about-us/careers/','/unreviewed-careers/'):body).options),/profile|handoff/)
 await assert.rejects(run(replay((p,body,count)=>{
  if(p.requestedUrl.endsWith('/widget/2176/openings/')&&count===1){
   const rows=JSON.parse(body),row=rows.find(row=>!row.location.country);assert.ok(row)
   row.application_fields[0].label+=' changed native requirement';return JSON.stringify(rows)
  }
  return body
 }).options),/closing.*model/)
})
