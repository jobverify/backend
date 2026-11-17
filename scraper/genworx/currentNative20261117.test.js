import assert from'node:assert/strict'
import test from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{parse}from'acorn'
import{run}from'./script.js'
import{readNativeDocument}from'../../scraper-support/utils/activeNativeHtml.js'
import{readSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'
import{readInventoryEvidence,sourceLifecycleCleanupForbidden}from'../../scraper-support/utils/inventoryEvidence.js'
import{currentGenworxTransport}from'./currentTransport20261117.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
const body=p=>Buffer.from(p.bodyBase64,'base64').toString()
function replay(edit=(p,s)=>s){const reads=[],counts=new Map();return{reads,options:{requestIntervalMs:0,fetchText:async()=>body(fixture.responses[0]),fetchImpl:async(url,init)=>{const p=fixture.responses.find(p=>p.requestedURL===String(url));assert.ok(p,'Only current declared original '+url);const count=(counts.get(String(url))??0)+1;counts.set(String(url),count);reads.push(String(url));assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');return Object.defineProperty(new Response(edit(p,body(p),count),{status:p.status,headers:p.headers}),'url',{value:p.url})}}}}
const encode=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
function editBoardRows(html,edit){return html.replace(/<input\b[^>]*>/gi,tag=>{if(!/\bid=["']jobs["']/.test(tag))return tag;const n=readNativeDocument(tag).nodes(n=>n.tag==='input')[0],rows=JSON.parse(n.attrs.value);edit(rows);return tag.replace(/\bvalue=(["'])([\s\S]*?)\1/,(_m,q)=>'value='+q+encode(JSON.stringify(rows))+q)})}
function editDetailRows(html,edit){return html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(_all,open,source,close)=>{if(!source.includes('var jobs ='))return open+source+close;const ast=parse(source,{ecmaVersion:'latest'}),d=ast.body.flatMap(s=>s.type==='VariableDeclaration'?s.declarations:[]).find(d=>d.id?.name==='jobs');assert.equal(d.init.callee?.property?.name,'parse');const rows=JSON.parse(d.init.arguments[0].value);edit(rows);return open+source.slice(0,d.init.start)+'JSON.parse('+JSON.stringify(JSON.stringify(rows))+')'+source.slice(d.init.end)+close})}
test('GENWORX current first-party module/Zoho native originals retain full records and applications with bounded partial scope',async()=>{
 const {reads,options}=replay(),jobs=await run(options)
 assert.equal(reads.length,16);assert.equal(readInventoryEvidence(jobs).pagesFetched,16)
 assert.equal(readSourceObservationEvidence(jobs,'genworx').observedRecordCount,2)
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'802719000002492042');assert.equal(jobs[0].country,'India')
 assert.match(jobs[0].jobDescription,/Five to eight years in B2B marketing/)
 assert.equal(jobs[0].nativeApplicationModel.webforms[0].sections.length,8)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.details.length,2)
 assert.equal(jobs.nativeCollectionEvidence.failures[0].id,'802719000000585025')
 assert.equal(jobs.nativeCollectionEvidence.closingFullNativeInventoryMatch,true)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.ok(jobs.every(j=>j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
})
test('GENWORX rejects new executable/foreign employer handoff and full closing application or passive record drift',async()=>{
 for(const mode of['program','handoff','application','passive']){const{options}=replay((p,s,count)=>{
  if(mode==='program'&&p.requestedURL.endsWith('/assets/index-DHSlVCQC.js'))return s+';globalThis.changed=true'
  if(mode==='handoff'&&p.requestedURL.endsWith('/assets/index-DHSlVCQC.js'))return s.replaceAll('https://genworx.zohorecruit.com/jobs/Careers','https://foreign.invalid/jobs/Careers')
  if(mode==='application'&&p.requestedURL.includes('/802719000000585025/apply/')&&count===2){const v=JSON.parse(s);v.webforms[0].sections[0].fields[0].required=false;return JSON.stringify(v)}
  if(mode==='passive'&&p.requestedURL==='https://genworx.zohorecruit.com/jobs/Careers'&&count===2)return editBoardRows(s,rows=>{rows[1].unreviewedPassiveContext={eligibility:'changed'}})
  return s
 });await assert.rejects(run(options),error=>error.failureKind==='parser_or_contract_error',mode)}
})
test('GENWORX whole native count and explicit filled negative remain typed data rather than a frozen two-role snapshot',async()=>{
 const{options}=replay((p,s)=>p.requestedURL==='https://genworx.zohorecruit.com/jobs/Careers'?editBoardRows(s,rows=>{
  const extra={...structuredClone(rows[0]),id:'802719999999999999',Posting_Title:'Synthetic closed native role',Job_Opening_Name:'Synthetic closed native role',Publish:false,Is_Locked:true,Country:null}
  rows.push(extra)
 }):s)
 const jobs=await run(options);assert.equal(jobs.length,1);assert.equal(readSourceObservationEvidence(jobs,'genworx').observedRecordCount,3)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.rows.length,3);assert.equal(jobs.nativeCollectionEvidence.exclusions.length,1)
 assert.equal(jobs.nativeCollectionEvidence.exclusions[0].nativeRecord.Country,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('GENWORX preserves opaque caller cancellation across stalled cleanup and stops one observed AWS challenge',async()=>{
 const pre=new AbortController();pre.abort(null);let reads=0
 await assert.rejects(run({signal:pre.signal,fetchImpl:async()=>{reads++}}),reason=>reason===null);assert.equal(reads,0)
 const url='https://genworx.ai/',caller=new AbortController(),reason=Object.freeze({owner:'genworx-during-cleanup'})
 const io=currentGenworxTransport({signal:caller.signal,timeoutMs:10,requestIntervalMs:0,allowedURL:value=>value===url,
  fetchImpl:async()=>Object.defineProperty(new Response(new ReadableStream({pull:()=>new Promise(()=>{}),cancel:()=>new Promise(()=>{})}),{headers:{'content-type':'text/html'}}),'url',{value:url})})
 const timer=setTimeout(()=>caller.abort(reason),40)
 try{await assert.rejects(io.read(url),error=>error===reason)}finally{clearTimeout(timer);io.close()}
 await assert.rejects(run({requestIntervalMs:0,fetchImpl:async u=>{reads++;return Object.defineProperty(new Response(null,{status:202,headers:{'x-amzn-waf-action':'challenge'}}),'url',{value:String(u)})}}),error=>error.httpStatus===202&&error.failureKind==='blocked_or_access_denied')
 assert.equal(reads,1)
})
test('GENWORX paced native reads preserve the exact caller reason without starting the next request',async()=>{
 const caller=new AbortController(),reason=Object.freeze({owner:'genworx-pacing'}),url='https://genworx.ai/';let reads=0
 const io=currentGenworxTransport({signal:caller.signal,requestIntervalMs:1000,allowedURL:value=>value===url,
  fetchImpl:async()=>{reads++;return Object.defineProperty(new Response('native',{headers:{'content-type':'text/html'}}),'url',{value:url})}})
 try{await io.read(url);const timer=setTimeout(()=>caller.abort(reason),20);try{await assert.rejects(io.read(url),error=>error===reason)}finally{clearTimeout(timer)}assert.equal(reads,1)}finally{io.close()}
})
test('GENWORX explicit unknown country and criteria word boundary changes stay held with original observation identities',async()=>{
 for(const mode of['country','criteria']){const{options}=replay((p,s)=>{
  if(p.requestedURL==='https://genworx.zohorecruit.com/jobs/Careers')return editBoardRows(s,rows=>{if(mode==='country')rows[0].Country=null;else rows[0].Job_Description=rows[0].Job_Description.replace('not cost','notcost').replace('Five to eight','Fivetoeight')})
  if(mode==='country'&&p.requestedURL.includes('/802719000002492042/')&&!p.requestedURL.includes('/apply/'))return editDetailRows(s,rows=>{rows[0].Country=null})
  return s
 });const jobs=await run(options);assert.equal(jobs.length,0,mode);assert.equal(readSourceObservationEvidence(jobs,'genworx').observedRecordCount,2);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.rows.length,2)}
})

test('GENWORX nontext and unqualified rich criteria stay observations even when extracted plain text agrees',async()=>{
 for(const addition of['<img src="https://example.invalid/mandatory.png" alt="Additional mandatory criteria">',
  '<iframe src="https://example.invalid/mandatory"></iframe>',
  '<div style="opacity:0">Additional mandatory criteria</div>',
  '<style>div { clip-path: inset(100%) }</style>']){
  let changed=false
  const{options}=replay((p,s)=>{
   if(p.requestedURL.includes('/802719000002492042/')&&!p.requestedURL.includes('/apply/'))return editDetailRows(s,rows=>{rows[0].Job_Description+=addition;changed=true})
   return s
  })
  const jobs=await run(options)
  assert.equal(changed,true)
  assert.equal(jobs.length,0,addition)
  assert.equal(readSourceObservationEvidence(jobs,'genworx').observedRecordCount,2)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
  assert.ok(jobs.nativeCollectionEvidence.nativeOpeningInventory.details.find(d=>d.row.id==='802719000002492042').row.Job_Description.endsWith(addition))
 }
})
