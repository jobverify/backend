import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parseCurrentIndex,parseCurrentRole,runCurrentNative} from './currentNative20261119.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261119.json.gz',import.meta.url))))
const pages=new Map(fixture.records.map(r=>[r.requestedUrl,r]))
const body=url=>Buffer.from(pages.get(url).bodyBase64,'base64').toString()
const listing=()=>parseCurrentIndex(body(fixture.indexURL))[0]
const response=(url,html=body(url),status=200)=>{const r=new Response(html,{status,headers:pages.get(url).headers});Object.defineProperty(r,'url',{value:url});return r}
const mutate=(html,change)=>html.replace(/(<script\b[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,(_,a,s,b)=>{const m=JSON.parse(s);change(m);return a+JSON.stringify(m)+b})
test('EPAM native SSR model uses the actual title and ten currently published own India roles',()=>{
 const rows=parseCurrentIndex(body(fixture.indexURL));assert.equal(rows.length,10)
 for(const row of rows){const fact=parseCurrentRole(body(row.sourceUrl),row,fixture.observedAt);assert.equal(fact.country,'India');assert.equal(fact.title,row.nativeRecord.name);assert.equal(fact.nativeEmployerDisplayName,'EPAM');assert.equal(fact.backendApplicationActivationVerified,false)}
})
test('EPAM current public records remain available with company scope and cleanup held',async()=>{
 const jobs=await runCurrentNative({now:fixture.observedAt,requestIntervalMs:0,fetchImpl:async url=>{const row=pages.get(url);assert.ok(row,'Unbound '+url);const r=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(r,'url',{value:url});return r}})
 assert.equal(jobs.length,10);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})
test('EPAM model-only location-specific benefits and disclaimers do not acquire a full criteria claim',()=>{
 const row=listing(),fact=parseCurrentRole(body(row.sourceUrl),row,fixture.observedAt)
 assert.equal(fact.sourceDetailComplete,false);assert.ok(fact.sourceMissingCriteria.length>0)
 assert.ok(fact.jobDescription.length>300);assert.ok(fact.sourceNativeRecord.benefits.length>0)
 assert.equal(fact.backendApplicationActivationVerified,false)
})
test('EPAM current publication, application mode, countries and authored expiry contradictions stay held',()=>{
 for(const change of [r=>{r.is_hidden=true},r=>{r.is_expired=true},r=>{r.application_type='other'},r=>{r.tenant='other'},
  r=>{r.country.push({id:'Canada',name:'Canada'})},r=>{r.city[0].country.name='Canada'},r=>{r.metadata.country[0].title='Canada'},
  r=>{r.validThrough='2020-01-01'},r=>{r.validThrough='2026-02-30'},r=>{r.updated_at='2027-01-01T00:00:00Z'}]){
  const row=structuredClone(listing());change(row.nativeRecord);assert.throws(()=>parseCurrentRole(body(row.sourceUrl),row,fixture.observedAt))
 }
})
test('EPAM disabled or wrong-role own application and a hidden title stay held',()=>{
 const row=listing(),html=body(row.sourceUrl)
 for(const candidate of [html.replace('id="cta_job_apply_unauthorized"','aria-disabled="true" id="cta_job_apply_unauthorized"'),
  html.replace('data-event-result="'+row.title+' / '+row.nativeRecord.uid+'"','data-event-result="Wrong / '+row.nativeRecord.uid+'"'),
  html.replace('<h1 ','<h1 hidden ')])assert.throws(()=>parseCurrentRole(candidate,row,fixture.observedAt))
})
test('EPAM absent or hidden criteria retain basic independently current public roles as partial',()=>{
 const row=listing(),html=body(row.sourceUrl),missing=structuredClone(row);missing.nativeRecord.description=''
 const own=mutate(html,m=>{m.props.pageProps.job.description=''})
 assert.equal(parseCurrentRole(own,missing,fixture.observedAt).sourceDetailComplete,false)
 const hidden=html.replace('class="Description_container__VxWne"','hidden class="Description_container__VxWne"')
 assert.equal(parseCurrentRole(hidden,row,fixture.observedAt).sourceDetailComplete,false)
})
test('EPAM changed current program bytes, missing original HTTP and changed closing own role are held',async()=>{
 const first=listing().sourceUrl,app=fixture.records.find(r=>r.requestedUrl.includes('/pages/_app-')).requestedUrl
 for(const kind of ['program','closing-role','closing-HTTP']){const counts=new Map();await assert.rejects(runCurrentNative({now:fixture.observedAt,requestIntervalMs:0,fetchImpl:async url=>{
  const n=(counts.get(url)??0)+1;counts.set(url,n)
  if(kind==='program'&&url===app)return response(url,body(url)+'\n/* changed */')
  if(url===first&&n===2){if(kind==='closing-HTTP')return response(url,'Unavailable',503);if(kind==='closing-role')return response(url,body(url).replace('class="Description_container__VxWne"','hidden class="Description_container__VxWne"'))}
  return response(url)
 }}))}
})
test('EPAM production uses native global transport and preserves opaque caller cancellation',async()=>{
 const saved=globalThis.fetch,calls=[];globalThis.fetch=async url=>{calls.push(url);return response(url,'Unavailable',503)}
 try{await assert.rejects(runCurrentNative(),/HTTP 503/);assert.equal(calls.length,1)}finally{globalThis.fetch=saved}
 const reason={source:'epam'},c=new AbortController(),task=runCurrentNative({signal:c.signal,fetchImpl:()=>new Promise(()=>{})});setTimeout(()=>c.abort(reason),10);await assert.rejects(task,e=>e===reason)
})
