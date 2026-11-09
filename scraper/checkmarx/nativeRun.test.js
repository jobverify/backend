import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readNativeData} from './nativeData.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/runtime-native-20261021.json.gz',import.meta.url))))
const now='2026-10-21T04:00:00.000Z'
function transport(change){
 const used=new Set()
 return{used,fetchImpl:async(url,options)=>{
   assert.ok(options.method==null||options.method==='GET')
   assert.equal(options.body,undefined)
   const index=fixture.packets.findIndex((p,i)=>p.url===url&&!used.has(i))
   assert.notEqual(index,-1,'Only exact captured public GETs may be requested')
   used.add(index)
   const p=structuredClone(fixture.packets[index]),response=change?.(p,index)||p
   return{status:response.status,url:response.finalURL,text:async()=>response.body}
 }}
}
function replaceData(html,key,change){
 const next=change(structuredClone(readNativeData(html,key)))
 const re=new RegExp('(\\b'+key+'\\s*=\\s*)([^\\r\\n]+)')
 return html.replace(re,(_match,prefix,line)=>prefix+JSON.stringify(next).replaceAll('<','\\u003C').replaceAll('>','\\u003E')+(line.match(/[,;]\s*$/)?.[0]||''))
}
const changeIndia=change=>p=>{
 const key=p.url.endsWith('/C0.008')?'COMPANY_POSITIONS_DATA':'POSITION_DATA'
 p.body=replaceData(p.body,key,value=>{for(const row of Array.isArray(value)?value:[value])if(row.location.country==='IN')change(row);return value})
 return p
}

test('four actual native GETs enumerate30 records and preserve both full Pune roles with unknown company scope',async()=>{
 const t=transport(),jobs=await run({fetchImpl:t.fetchImpl,now})
 assert.equal(jobs.length,2);assert.equal(t.used.size,4)
 assert.deepEqual(jobs.map(j=>j.jobId),['78.66E','DA.278'])
 assert.deepEqual(jobs.map(j=>j.requisitionId),['P2165','P2196'])
 for(const j of jobs){
   assert.equal(j.source,'checkmarx');assert.equal(j.company,'Checkmarx')
   assert.equal(j.country,'India');assert.equal(j.city,'Pune')
   assert.equal(j.postedAt,null);assert.equal(j.postingDate,null);assert.equal(j.closingDate,null)
   assert.equal(j.nativeIsInternal,false);assert.equal(j.sourceListingComplete,false)
   assert.equal(j.sourceGlobalJobCount,null);assert.equal(j.sourceObservedNativeBoardRecords,30)
   assert.equal(j.sourceDetailComplete,true);assert.ok(j.jobDescription.length>2500)
 }
})

test('current HTTP403 challenge cannot be returned as a successful zero',async()=>{
 let requested=0
 await assert.rejects(()=>run({fetchImpl:async url=>{requested++;return{status:403,url,text:async()=>'<title>Just a moment...</title><div id="challenge-running">Verify you are human</div>'}}}),/HTTP|unavailable|blocked/i)
 assert.equal(requested,1)
})

test('caller cancellation cannot become a successful zero or start a request',async()=>{
 const c=new AbortController();c.abort(Error('Checkmarx caller cancelled'))
 await assert.rejects(()=>run({signal:c.signal,fetchImpl:()=>{assert.fail('A cancelled source must not request')}}),/cancelled/)
})

test('HTTP202 details, explicit caps and stable-ID board drift fail without a successful zero',async()=>{
 await assert.rejects(()=>run({now,fetchImpl:transport((p,index)=>{if(index===1)p.status=202;return p}).fetchImpl}),/HTTP/)
 await assert.rejects(()=>run({now,maxJobs:0,fetchImpl:()=>assert.fail('No truncated request')}),/truncation/)
 await assert.rejects(()=>run({now,maxNativeRecords:29,fetchImpl:transport().fetchImpl}),/capped/)
 await assert.rejects(()=>run({now,fetchImpl:transport((p,index)=>{if(index===3)p.body=p.body.replace('"name": "Application Security Engineer Team Leader"','"name": "Changed native title"');return p}).fetchImpl}),/changed during extraction/)
})

test('caller abort during final response and an uncooperative transport deadline both reject',async()=>{
 const c=new AbortController()
 const t=transport((p,index)=>{if(index===3)c.abort(Error('Checkmarx final caller cancelled'));return p})
 await assert.rejects(()=>run({now,signal:c.signal,fetchImpl:t.fetchImpl}),/cancelled/)
 await assert.rejects(()=>run({now,timeoutMs:20,fetchImpl:()=>new Promise(()=>{})}),/deadline/)
})

for(const [name,change]of [
 ['conflicting native India city and public location label',changeIndia(row=>{row.location.city='Mumbai'})],
 ['foreign native state under typed India',changeIndia(row=>{row.location.state='United States'})],
 ['native company errorCode/errorMessage envelope',p=>{p.body=replaceData(p.body,'COMPANY_DATA',v=>({...v,errorCode:500,errorMessage:'upstream failure'}));return p}],
 ['nomodule-only native preloads',p=>{p.body=p.body.replace(/<script\b([^>]*)>/g,'<script nomodule$1>');return p}],
 ['conditional false native company assignment',p=>{p.body=p.body.replace('COMPANY_DATA =','if (false) COMPANY_DATA =');return p}],
])test('full runtime rejects '+name,async()=>{
 await assert.rejects(()=>run({now,fetchImpl:transport(change).fetchImpl}))
})

test('full runtime preserves missing content for closed-role notice despite genuine requirements',async()=>{
 const closed='This job is no longer available. We are no longer accepting applications for this position. Please visit our careers page to find other current opportunities.'
 const t=transport((p,index)=>{if(index===1||index===2)p.body=replaceData(p.body,'POSITION_DATA',v=>{v.custom_fields.details.find(f=>f.name==='Description').value=closed;return v});return p})
 const jobs=await run({now,fetchImpl:t.fetchImpl})
 assert.equal(t.used.size,4);assert.equal(jobs.length,2)
 for(const j of jobs){assert.equal(j.sourceDetailComplete,false);assert.equal(j.jobDescription,null);assert.equal(j.sourceDescription,null)}
})
