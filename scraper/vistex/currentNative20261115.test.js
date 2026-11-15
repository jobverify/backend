import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const packets=new Map(fixture.packets.map(p=>[p.url,p]))
const cacheVariant=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-cache-variant-20261115.json.gz',import.meta.url)))).packet
const target='a97cfec6-4efe-45a3-93f6-29f9fe104545',marker='Applicants must hold a cryptography doctorate before applying.'
const roleURL='https://recruiting2.ultipro.com/VIS1012VISX/JobBoard/23e64b4e-ff01-4579-9e5a-835480ac7a51/OpportunityDetail?opportunityId='+target
const boardURL='https://recruiting2.ultipro.com/VIS1012VISX/JobBoard/23e64b4e-ff01-4579-9e5a-835480ac7a51/?q=&o=postedDateDesc&f4=AFRPpIe5p0uCZgc2LdGixQ'
const coreURL='https://rec-cdn-prod.cdn.ultipro.com/rec-web/3cc6a84d2504342bc9ffba4a7245c0b8374a8238/site.min.js'
const options={now:'2026-11-15T14:00:00.000Z',requestIntervalMs:0}
let native
try{native=await import('./currentNative20261115.js')}catch{}
function transport(mutate){
 const counts=new Map(),calls=[]
 const fetchImpl=async(url,init)=>{
  url=String(url);const count=(counts.get(url)??0)+1;counts.set(url,count);calls.push({url,init,count})
  const original=packets.get(url);assert.ok(original,'Only retained declared native URLs may be read: '+url)
  let packet={...original,headers:{...original.headers},html:Buffer.from(original.bodyBase64,'base64').toString()}
  if(mutate)packet=mutate(packet,{url,count,init})??packet
  const response=new Response(packet.html,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 }
 return{fetchImpl,calls,counts}
}
const run=async mutate=>{assert.ok(native,'Current native reader is required for this genuine contract regression');const t=transport(mutate);return{jobs:await native.runCurrentVistex({...options,fetchImpl:t.fetchImpl}),...t}}
const roleMutation=(fn,closing=false)=>(p,{url,count})=>url===roleURL&&(!closing||count===2)?{...p,html:fn(p.html)}:p
const unavailable=html=>html.replace(/<body\b([^>]*)>/i,'<body$1><p>This position is currently unavailable.</p>')
function alterLiteral(packet,kind,alter){
 const initial=native.currentVistexInitializers(packet.html,kind),value=structuredClone(kind==='board'?initial.rows:initial.model);alter(value)
 const program=initial.source.slice(0,initial.dataNode.start)+JSON.stringify(value)+initial.source.slice(initial.dataNode.end)
 return{...packet,html:packet.html.replace(initial.source,program)}
}

test('genuine current native cohort publishes all eight complete India roles and preserves the twenty original observations',async()=>{
 const {jobs,calls}=await run();assert.equal(jobs.length,8)
 const job=jobs.find(j=>j.requisitionId==='PROJE003525');assert.ok(job);assert.equal(job.country,'India');assert.equal(job.nativeOpportunityId,target)
 assert.match(job.jobDescription,/Bachelors or better in Computer Engineering or related field/);assert.match(job.jobDescription,/10 years: SAP Functional Consulting/);assert.match(job.jobDescription,/Preferred[\s\S]*Big 4/)
 assert.match(job.jobDescription,/world’s leading enterprises/)
 assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceRenderedApplicationQualified,false)
 assert.equal(jobs.sourceAudit.opening.rows.length,20);assert.equal(jobs.sourceAudit.closing.rows.length,20)
 assert.ok(calls.every(c=>c.init.method==='GET'&&c.init.redirect==='manual'&&c.init.credentials==='omit'));assert.ok(!calls.some(c=>/Login|OpportunityApply|LoadSearchResults|GetFilters/.test(c.url)))
 assert.ok(calls.length<=190)
 assert.ok(!calls.some(c=>/faroBundle|\/tokens\/fonts\/|linkedin\.com|arcgis\.com|polyfills-/.test(c.url)))
 assert.ok([...new Set(calls.map(c=>c.url))].every(url=>calls.filter(c=>c.url===url).length===2))
})
for(const [name,modify]of Object.entries({
 'foreign declared corporate handoff':(p,{url})=>url.includes('careers-in-india')?{...p,html:p.html.replaceAll('recruiting2.ultipro.com','foreign.example')}:p,
 'duplicate initial featured identity':(p,{url})=>url===boardURL?{...p,html:p.html.replace('"Id":"9e1c3fb0-6140-4957-9c55-9d2007df286f"','"Id":"70b69767-8037-4bb4-acd7-cd5d24e42a0e"')}:p,
 'inert literal initializer':roleMutation(h=>h.replace('<script>\n    $(function () {\n        var opportunity =','<script type="application/json">\n    $(function () {\n        var opportunity =')),
 'duplicate decoded model JSON':roleMutation(h=>h.replace('"PublishingStatus":1','"PublishingStatus":1,"Publishing\\u0053tatus":1')),
 'foreign native country':roleMutation(h=>h.replace('"Name":"India","Code":"IND"','"Name":"United States","Code":"USA"')),
 'foreign native employer introduction':roleMutation(h=>h.replace('Vistex is a global enterprise software and services company','ForeignCorp is a global enterprise software and services company')),
 'missing separate criteria':roleMutation(h=>h.replace('"EducationCriteria":[{','"UnknownEducationCriteria":[{')),
 'new unsupported native criterion array':roleMutation(h=>h.replace('"BehaviorCriteria":[]','"BehaviorCriteria":[{"Description":"'+marker+'"}]')),
 'closed native opportunity':roleMutation(h=>h.replace('"OpportunityIsClosed":false','"OpportunityIsClosed":true')),
 'external publication revoked':roleMutation(h=>h.replace('"PublishedInternal":false,"PublishedExternal":true','"PublishedInternal":false,"PublishedExternal":false')),
 'wrong application native identity':roleMutation(h=>h.replaceAll('OpportunityApply%3FopportunityId%3D'+target,'OpportunityApply%3FopportunityId%3D70b69767-8037-4bb4-acd7-cd5d24e42a0e')),
 'extra required control value':roleMutation(h=>h.replace('id="opportunityDetailView"','id="opportunityDetailView" data-required-qualification="'+marker+'"')),
 'new own qualification metadata':roleMutation(h=>h.replace('<body','<body data-native-required-qualification="'+marker+'"')),
 'model consumer client bytes changed':(p,{url})=>url===coreURL?{...p,html:p.html+';window.US={};'}:p,
 'role stylesheet media changed':roleMutation(h=>h.replace('rel="stylesheet"','rel="stylesheet" media="print"')),
 'unknown body controller event':roleMutation(h=>h.replace('<body','<body onload="document.body.hidden=true"')),
 'hidden native description criteria':roleMutation(h=>h.replace('Vistex is a global enterprise','\\u003cspan hidden\\u003e'+marker+'\\u003c/span\\u003eVistex is a global enterprise')),
 'role Refresh navigation':(p,{url})=>url===roleURL?{...p,headers:{...p.headers,refresh:'0;url=https://foreign.example/'}}:p,
 'role full MIME charset changed':(p,{url})=>url===roleURL?{...p,headers:{...p.headers,'content-type':'text/html; charset=iso-8859-1'}}:p,
 'role attachment disposition':(p,{url})=>url===roleURL?{...p,headers:{...p.headers,'content-disposition':'attachment'}}:p,
 'closing enforced CSP changed':(p,{url,count})=>url===roleURL&&count===2?{...p,headers:{...p.headers,'content-security-policy':"script-src 'none'; style-src 'none'; form-action 'none'"}}:p,
 'closing foreign canonical Link':(p,{url,count})=>url===roleURL&&count===2?{...p,headers:{...p.headers,link:'<https://foreign.example/>; rel="canonical"'}}:p,
 'native invalid rollover posting date':roleMutation(h=>h.replaceAll('2026-10-06T06:53:46.284Z','2026-09-31T06:53:46.284Z')),
 'current visible unavailable opening and closing':roleMutation(unavailable),
 'current visible unavailable closing only':roleMutation(unavailable,true),
 'closing complete original criterion changed':roleMutation(h=>h.replace('Excellent client-facing and interpersonal skills',marker),true),
 'closing extra own criterion outside current model':roleMutation(h=>h.replace('id="opportunityDetailView">','id="opportunityDetailView"><p>'+marker+'</p>'),true),
}))test('holds '+name,async()=>{await assert.rejects(run(modify),/Vistex current native:/)})

test('full added current experience is retained when opening and closing agree',async()=>{
 const {jobs}=await run(roleMutation(h=>h.replace('"Description":"Excellent client-facing and interpersonal skills"','"Description":"'+marker+'"')))
 assert.match(jobs.find(j=>j.nativeOpportunityId===target).jobDescription,/cryptography doctorate/)
})
test('opaque primitive and frozen caller abort reasons preserve identity',async()=>{
 assert.ok(native)
 for(const reason of ['opaque native caller cancellation',Object.freeze({kind:'opaque-frozen'})]){const controller=new AbortController();controller.abort(reason);await assert.rejects(native.runCurrentVistex({...options,signal:controller.signal,fetchImpl:async()=>assert.fail('No read after caller cancellation')}),e=>e===reason)}
})
test('the original public HTML User-Agent and Accept contract is preserved',async()=>{
 const {calls}=await run();const first=calls[0]
 assert.equal(first.init.headers['User-Agent'],'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36')
 assert.equal(first.init.headers.Accept,'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
})
test('the actual registered script wrapper publishes the genuine native positives',async()=>{
 const {run:registered}=await import('./script.js'),t=transport(),jobs=await registered({...options,fetchImpl:t.fetchImpl})
 assert.equal(jobs.length,8);assert.equal(jobs.sourceAudit.opening.rows.length,20)
})
for(const [name,notice]of Object.entries({filled:'This position has now been filled.',hiringEnded:'Hiring for this role has ended.',applicationsClosed:'Applications are closed.',notAvailable:'This job is not available.'}))test('holds visible '+name+' notice only on closing',async()=>{
 await assert.rejects(run(roleMutation(h=>h.replace(/<body\b([^>]*)>/i,'<body$1><p>'+notice+'</p>'),true)),/Vistex current native:/)
})
for(const markup of ['<div hidden>This position is filled.</div>','<div style="display:none">This position is filled.</div>','<template><p>This position is filled.</p></template>','<noscript>This position is filled.</noscript>'])test('isolated definitely inactive closure does not invalidate genuine full criteria: '+markup,async()=>{
 const {jobs}=await run(roleMutation(h=>h.replace(/<body\b([^>]*)>/i,'<body$1>'+markup)));assert.equal(jobs.length,8)
})
for(const [header,value]of Object.entries({location:'https://foreign.example/','content-location':'https://foreign.example/','x-content-type-options':'invalid','x-frame-options':'DENY','content-security-policy-report-only':"script-src 'none'",'x-content-security-policy':"script-src 'none'",'x-webkit-csp':"script-src 'none'",'report-to':'{"group":"foreign","endpoints":[{"url":"https://foreign.example/"}]}','reporting-endpoints':'foreign="https://foreign.example/"'}))test('holds closing effective native header '+header,async()=>{
 await assert.rejects(run((p,{url,count})=>url===roleURL&&count===2?{...p,headers:{...p.headers,[header]:value}}:p),/Vistex current native:/)
})
for(const carrier of ['<data itemprop="qualifications" value="'+marker+'"></data>','<link itemprop="qualifications" href="https://foreign.example/criteria">','<form><input required hidden value="'+marker+'"></form>','<textarea hidden>'+marker+'</textarea>'])test('holds new retained native non-text criteria carrier '+carrier.slice(0,35),async()=>{
 await assert.rejects(run(roleMutation(h=>h.replace('id="opportunityDetailView">','id="opportunityDetailView">'+carrier))),/Vistex current native:/)
})
test('stream cancellation preserves caller reason and cancels/releases the pending reader',async()=>{
 assert.ok(native)
 const reason=Object.freeze({kind:'opaque-current-stream-abort'}),controller=new AbortController(),p=packets.values().next().value
 let cancelled,releaseCount=0
 const fetchImpl=async url=>({status:200,url,headers:new Headers(p.headers),body:{getReader:()=>({read:()=>new Promise(()=>{queueMicrotask(()=>controller.abort(reason))}),cancel:value=>{cancelled=value},releaseLock:()=>{releaseCount++}})}})
 await assert.rejects(native.runCurrentVistex({...options,signal:controller.signal,fetchImpl}),e=>e===reason)
 await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,reason);assert.equal(releaseCount,1)
})
test('streaming source entity bound rejects before buffering an oversized current document',async()=>{
 assert.ok(native)
 const p=packets.values().next().value;let cancelled=false,releaseCount=0,reads=0
 const fetchImpl=async url=>({status:200,url,headers:new Headers(p.headers),body:{getReader:()=>({read:async()=>({done:false,value:new Uint8Array(++reads===1?12_000_001:0)}),cancel:()=>{cancelled=true},releaseLock:()=>{releaseCount++}})}})
 await assert.rejects(native.runCurrentVistex({...options,fetchImpl}),/native streaming entity\/total byte bound/)
 await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,true);assert.equal(releaseCount,1);assert.equal(reads,1)
})
test('a stalled native stream is bounded by the existing source deadline',async()=>{
 assert.ok(native)
 const p=packets.values().next().value;let cancelled=false
 const fetchImpl=async url=>({status:200,url,headers:new Headers(p.headers),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:()=>{cancelled=true},releaseLock:()=>{}})}})
 await assert.rejects(native.runCurrentVistex({...options,sourceDeadlineMs:25,fetchImpl}),/source deadline exceeded/)
 await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,true)
})
test('every original native India alternative survives, with no first-location truncation',async()=>{
 // Reuse a second genuinely retained own India worksite/address model.
 const board=packets.get(boardURL),initial=native.currentVistexInitializers(Buffer.from(board.bodyBase64,'base64').toString(),'board'),other=structuredClone(initial.rows.find(r=>r.RequisitionNumber==='ASSOC003538').Locations[0])
 const {jobs}=await run((p,{url})=>url===boardURL?alterLiteral(p,'board',rows=>rows.find(r=>r.Id===target).Locations.push(structuredClone(other))):url===roleURL?alterLiteral(p,'role',m=>{const detail={...structuredClone(other),Shapes:null,IsAvailableForOpportunities:true};detail.Address.Country={Id:m.Locations[0].Address.Country.Id,Name:'India',Code:'IND'};m.Locations.push(detail)}):p)
 const job=jobs.find(j=>j.nativeOpportunityId===target);assert.equal(job.nativeLocations.length,2);assert.equal(job.locations.length,2);assert.equal(job.nativeLocations[1].Id,other.Id)
})
test('unresolved typed country does not become India from a known city',async()=>{
 await assert.rejects(run((p,{url})=>url===boardURL?alterLiteral(p,'board',rows=>{rows.find(r=>r.Id===target).Locations[0].Address.Country={Code:'',Name:''}}):p),/Vistex current native:/)
})
test('zero observations never acquire terminal empty authority',async()=>{
 await assert.rejects(run((p,{url})=>url===boardURL?alterLiteral(p,'board',rows=>{rows.splice(0)}):p),/empty is not whole inventory/)
})
test('native feature-set ordering alone preserves the complete genuine roles',async()=>{
 const {jobs}=await run((p,{url})=>{
  if(url!==roleURL)return p
  const start=p.html.indexOf('Recruiting.TenantFeatureToggle.setFeatureToggles('),first=p.html.indexOf('[',start),end=p.html.indexOf(']',first),flags=JSON.parse(p.html.slice(first,end+1))
  return{...p,html:p.html.slice(0,first)+JSON.stringify(flags.reverse())+p.html.slice(end+1)}
 });assert.equal(jobs.length,8)
})
test('duplicate flags or a new native control flag cannot hide in feature-set normalization',async()=>{
 for(const extra of ['RecruitmentFireLocationSync','UnreviewedNativeCountryScopeOverride'])await assert.rejects(run(roleMutation(h=>h.replace('setFeatureToggles([','setFeatureToggles(["'+extra+'",'))),/Vistex current native:/)
})
test('native redirects are held without reading the foreign destination',async()=>{
 assert.ok(native);const t=transport((p,{url})=>url.includes('careers-in-india')?{...p,status:307,headers:{...p.headers,location:'https://foreign.example/'}}:p)
 await assert.rejects(native.runCurrentVistex({...options,fetchImpl:t.fetchImpl}),/native HTTP status or exact final URL changed/);assert.equal(t.calls.length,1)
})
test('genuine newly generated native cache timestamp preserves the current full India cohort',async()=>{
 const {jobs}=await run((p,{url})=>url===boardURL?{...cacheVariant,html:Buffer.from(cacheVariant.bodyBase64,'base64').toString()}:p)
 assert.equal(jobs.length,8);assert.equal(jobs.sourceAudit.opening.rows.length,20)
})
for(const [name,mutate]of Object.entries({
 'future cache date':p=>({...p,html:p.html.replace(/(http-equiv="Expires" content=")[^"]+/,(_,start)=>start+'Sun, 15 Nov 2026 13:48:57 GMT')}),
 'wrong complete weekday':p=>({...p,html:p.html.replace('Wed, 14 Oct 2026','Tue, 14 Oct 2026')}),
 'calendar rollover':p=>({...p,html:p.html.replace('Wed, 14 Oct 2026','Thu, 31 Sep 2026')}),
 'unbound Date header':p=>({...p,headers:{...p.headers,date:'Sun, 15 Nov 2026 13:48:59 GMT'}}),
 'duplicate cache meta':p=>({...p,html:p.html.replace('<meta http-equiv="Expires"','<meta http-equiv="Expires" content="Wed, 14 Oct 2026 13:48:57 GMT"><meta http-equiv="Expires"')}),
 'new attribute on cache meta':p=>({...p,html:p.html.replace('<meta http-equiv="Expires"','<meta itemprop="validThrough" http-equiv="Expires"')}),
}))test('holds '+name+' instead of broad cache metadata normalization',async()=>{
 await assert.rejects(run((p,{url})=>url===boardURL?mutate(p):p),/Vistex current native:/)
})
