import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run,extractSearchResults} from './script.js'
import {readCurrentRapteeCorporate} from './currentNative20261117.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
test('Raptee historical native payload never invents India for missing or city-only country',()=>{
 for(const jobLocations of [[],[{city:'Chennai',state:'Tamil Nadu'}],[{countryCode:'US',countryName:'India',city:'Chennai'}]]){
  const [job]=extractSearchResults([{id:123,title:'Observed native role',jobLocations}],{domain:'https://raptee.keka.com/careers/'})
  assert.equal(job.country,null);assert.notEqual(job.location,'India')
 }
})
test('Raptee current corporate redirect and exact widget expose genuine publisher access denial with unknown inventory',async t=>{
 const calls=[],read=async(url,init)=>{calls.push({url,method:init.method});const row=fixture.responses.find(row=>row.requestedUrl===url);assert.ok(row,'Undeclared source request '+url);const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalUrl});return response}
 t.mock.method(globalThis,'fetch',read)
 await assert.rejects(run({fetchImpl:read,fetchBrowserText:async()=>assert.fail('Native current denial needs no browser fallback')}),error=>{
  assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.lifecycleCleanupAllowed,false);assert.equal(error.status,200)
  const audit=error.recruitmentObservations;assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyGlobalTotal,null)
  assert.equal(audit.originalResponses.find(row=>row.requestedUrl.includes('/embedjobs/js/')).status,302)
  assert.match(error.message,/Forbidden Access|access.denied/i);return true
 })
 assert.equal(calls.length,4)
})
test('Raptee current corporate identity rejects foreign canonicals, widget tenant and unreviewed client declaration',()=>{
 const body=Buffer.from(fixture.responses.find(row=>row.requestedUrl==='https://www.rapteehv.com/careers/').bodyBase64,'base64').toString('utf8')
 for(const change of [value=>value.replace('rel="canonical" href="https://www.rapteehv.com/careers"','rel="canonical" href="https://foreign.example/careers"'),value=>value.replaceAll('3d03878f-6bf4-4fe3-9090-2989304de3b4','00000000-0000-4000-8000-000000000000'),value=>value.replace('/assets/app-0fiCKGX2.js','/assets/app-other.js')])assert.throws(()=>readCurrentRapteeCorporate(change(body)),/Raptee/)
})
for(const mode of ['pre-abort','fulfilled','rejected'])test('Raptee frozen opaque '+mode+' preserves exact caller reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,mode});let calls=0
 if(mode==='pre-abort')controller.abort(reason)
 await assert.rejects(run({signal:controller.signal,fetchImpl:async()=>{calls++;controller.abort(reason);if(mode==='rejected')throw Object.freeze(Error('replacement'));const row=fixture.responses[0];const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalUrl});return response}}),error=>error===reason)
 assert.equal(calls,mode==='pre-abort'?0:1)
})

for(const mode of ['source-deadline','caller'])test('Raptee pacing preserves '+mode+' without another native request',async()=>{
 const controller=new AbortController(),reason=Object.freeze({owner:'rapteehv',stage:'pacing'});let calls=0,timer
 const read=async url=>{calls++;const row=fixture.responses.find(row=>row.requestedUrl===url);assert.ok(row);return Object.defineProperty(new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers}),'url',{value:row.finalUrl})}
 if(mode==='caller')timer=setTimeout(()=>controller.abort(reason),300)
 try{
  await assert.rejects(run({fetchImpl:read,signal:controller.signal,sourceTimeoutMs:mode==='source-deadline'?300:2000}),error=>mode==='caller'?error===reason:error.name==='TimeoutError'&&/source deadline/.test(error.message))
  assert.equal(calls,1)
 }finally{clearTimeout(timer)}
})
