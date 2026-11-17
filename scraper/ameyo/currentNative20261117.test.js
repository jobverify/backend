import assert from'node:assert/strict'
import test from'node:test'
import {readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{run}from'./script.js'
import{readSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'
import{sourceLifecycleCleanupForbidden,readInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import{parse}from'acorn'
import{currentAmeyoTransport}from'./currentTransport20261117.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
function replay(edit=(p,s)=>s){const counts=new Map(),reads=[];return{reads,options:{requestIntervalMs:0,fetchPage:async()=>({status:200,url:'https://exotel.com/ameyo-contact-center-by-exotel/',html:Buffer.from(fixture.responses[1].bodyBase64,'base64').toString()}),fetchImpl:async(url,init)=>{const p=fixture.responses.find(p=>p.requestedURL===String(url));assert.ok(p,'Only actually declared current public original '+url);assert.equal(init.redirect,'manual');const count=(counts.get(String(url))??0)+1;counts.set(String(url),count);reads.push(String(url));return Object.defineProperty(new Response(edit(p,Buffer.from(p.bodyBase64,'base64').toString(),count),{status:p.status,headers:p.headers}),'url',{value:p.url})}}}}
test('Ameyo current redirect/module2176 retains37 native Exotel criteria/application observations with zero Ameyo promotion',async()=>{
 const {options,reads}=replay(),jobs=await run(options)
 assert.equal(reads.length,40);assert.equal(readInventoryEvidence(jobs).pagesFetched,reads.length)
 assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,'ameyo').observedRecordCount,37)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.fullRows.length,37)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.fullRows[0].company_name,'Exotel Techcom Pvt Ltd')
 assert.ok(jobs.nativeCollectionEvidence.nativeOpeningInventory.fullRows.every(row=>typeof row.description==='string'&&Array.isArray(row.application_fields)))
 assert.equal(jobs.nativeCollectionEvidence.nativeDeclaredIndiaRows,33);assert.equal(jobs.nativeCollectionEvidence.nativeCountryUnqualifiedRows,4)
 assert.equal(jobs.nativeCollectionEvidence.failures.length,37);assert.equal(jobs.nativeCollectionEvidence.closingFullNativeInventoryMatch,true)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('Ameyo rejects dormant-provider substitution, changed full SDK program and unknown current redirect',async()=>{
 for(const mode of['dormant','program','redirect']){
  const {options}=replay((p,s)=>{
   if(mode==='dormant'&&p.requestedURL==='https://exotel.com/about-us/careers/')return s.replace('20189','84048')
   if(mode==='program'&&p.requestedURL.endsWith('/rbox_impl.js'))return s+';globalThis.unreviewed=true'
   if(mode==='redirect'&&p.requestedURL==='https://exotel.com/ameyo-contact-center-by-exotel/')return s.replaceAll('/about-us/careers/','/unreviewed-careers/')
   return s
  })
  await assert.rejects(run(options),/current|profile|program|declaration|handoff/i,mode)
 }
})
test('Ameyo unselected unknown-country role criteria/application closing drift remains a hold',async()=>{
 const {options}=replay((p,s,count)=>{if(p.requestedURL.endsWith('/widget/2176/openings/')&&count===2){const rows=JSON.parse(s),row=rows.find(r=>!r.location.country);row.application_fields[0].label+=' altered closing requirement';return JSON.stringify(rows)}return s})
 await assert.rejects(run(options),/closing.*native.*model/i)
})
test('Ameyo native role/group counts remain typed data while all unproved employer relationships stay held',async()=>{
 const full=JSON.parse(Buffer.from(fixture.responses.find(p=>p.requestedURL.endsWith('/widget/2176/openings/')).bodyBase64,'base64'))
 const extra={...structuredClone(full[0]),id:999001,hash_id:'synthetic-typed-replay',job_code:'synthetic-typed-replay',title:'Synthetic native model replay'}
 const {options}=replay((p,s)=>{
  if(p.requestedURL.endsWith('/rbox_api.js')){
   const ast=parse(s,{ecmaVersion:'latest'}),calls=[];const walk=n=>{if(!n||typeof n!=='object')return;if(n.type==='NewExpression'&&n.callee?.name==='Rbox')calls.push(n);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)};walk(ast)
   const call=calls[0],args=call.arguments.map(n=>JSON.parse(s.slice(n.start,n.end))),{description,application_fields,application_acknowledgement_enabled,...metadata}=extra
   args[0].push(metadata);args[1].find(group=>group.display_text===extra.team).openings.push(extra.id)
   for(let index=1;index>=0;index--){const node=call.arguments[index];s=s.slice(0,node.start)+JSON.stringify(args[index])+s.slice(node.end)}return s
  }
  if(p.requestedURL.endsWith('/widget/2176/openings/'))return JSON.stringify([...full,extra])
  return s
 })
 const jobs=await run(options);assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,'ameyo').observedRecordCount,38)
 assert.equal(jobs.nativeCollectionEvidence.failures.length,38);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('Ameyo current source keeps opaque cancellation and never retries an observed access denial',async()=>{
 const c=new AbortController(),reason=Object.freeze({owner:'ameyo'});c.abort(reason);let count=0
 await assert.rejects(run({signal:c.signal,fetchImpl:async()=>{count++}}),error=>error===reason);assert.equal(count,0)
 await assert.rejects(run({requestIntervalMs:0,fetchImpl:async url=>{count++;return Object.defineProperty(new Response(null,{status:429}),'url',{value:String(url)})}}),error=>error.httpStatus===429&&error.failureKind==='blocked_or_access_denied')
 assert.equal(count,1)
})
test('Ameyo caller abort during timeout cleanup retains the exact opaque owner reason',async()=>{
 const c=new AbortController(),reason=Object.freeze({owner:'ameyo-during-cleanup'}),url='https://www.ameyo.com/'
 const io=currentAmeyoTransport({signal:c.signal,timeoutMs:10,requestIntervalMs:0,allowedURL:value=>value===url,
  fetchImpl:async()=>Object.defineProperty(new Response(new ReadableStream({pull:()=>new Promise(()=>{}),cancel:()=>new Promise(()=>{})}),{headers:{'content-type':'text/html'}}),'url',{value:url})})
 const timer=setTimeout(()=>c.abort(reason),40)
 try{await assert.rejects(io.read(url),error=>error===reason)}finally{clearTimeout(timer);io.close()}
})
test('Ameyo paced native reads preserve the exact caller reason without starting the next request',async()=>{
 const caller=new AbortController(),reason=Object.freeze({owner:'ameyo-pacing'}),url='https://www.ameyo.com/';let reads=0
 const io=currentAmeyoTransport({signal:caller.signal,requestIntervalMs:1000,allowedURL:value=>value===url,
  fetchImpl:async()=>{reads++;return Object.defineProperty(new Response('native',{headers:{'content-type':'text/html'}}),'url',{value:url})}})
 try{await io.read(url);const timer=setTimeout(()=>caller.abort(reason),20);try{await assert.rejects(io.read(url),error=>error===reason)}finally{clearTimeout(timer)}assert.equal(reads,1)}finally{io.close()}
})
