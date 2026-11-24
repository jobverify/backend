import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-api-20261121.json.gz',import.meta.url))))
const makeResponse=(url,page)=>Object.defineProperty(new Response(page.body,{status:page.receipt.status,headers:page.receipt.headers}),'url',{value:page.receipt.finalURL})
const expected=10

test('registered current source retains every employer-bound native row without whole-page deployment pins',async()=>{
 const originalFetch=globalThis.fetch,calls=[],pages=new Map(fixture.pages.map(p=>[p.receipt.requestedURL,p]))
 const fetchImpl=async url=>{calls.push(String(url));const page=pages.get(String(url));assert.ok(page,'No uncaptured network permitted: '+url);return makeResponse(String(url),page)}
 globalThis.fetch=fetchImpl
 try{const provider=getScraperCatalog().find(p=>p.source===fixture.source);assert.equal(provider.adapter,'script');const jobs=await createCatalogScraper(provider).run({fetchImpl,sourceTimeoutMs:15000,requestTimeoutMs:5000});assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,expected);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false);assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null);assert.equal(jobs.nativeCollectionEvidence.companyIndiaZeroProven,false);assert.equal(jobs.nativeCollectionEvidence.wholeNativeRoleModelsClosingReconciled,true);assert.equal(calls.length,4)}finally{globalThis.fetch=originalFetch}
})

const corporate=fixture.pages[0],native=fixture.pages[1]
const apiJSON=()=>JSON.parse(native.body)
const rows=p=>Array.isArray(p)?p:p.jobs
const direct=async()=>import('./currentNative20261121.js')
const transport=(change=()=>{},target='none')=>{
 let corporateReads=0,apiReads=0
 return async url=>{
  if(url===corporate.receipt.requestedURL){corporateReads++;let body=corporate.body;if(target==='corporate-closing'&&corporateReads===2)body=change(body);return makeResponse(url,{...corporate,body})}
  assert.equal(url,native.receipt.requestedURL);apiReads++;const payload=apiJSON();if(target==='all-api'||target==='api-closing'&&apiReads===2)change(payload);return makeResponse(url,{...native,body:JSON.stringify(payload)})
 }
}
test('whole original current DTOs, criteria, raw country/publication and applications are retained',async()=>{
 const m=await direct(),api=m.readNativeAPI(native.body);assert.equal(api.models.length,expected);assert.deepEqual(api.wholeNativePayload,apiJSON())
 for(const item of api.models){assert.ok(item.fullOwnRoleCriteriaQualified);assert.notEqual(item.country,'India');assert.ok(item.sourceDescription.length>100);assert.equal(item.activeApplyVerified,false);assert.equal(item.applicationVisited,false);assert.deepEqual(item.wholeNativeRecord,rows(apiJSON()).find(r=>r.id===item.jobId));assert.ok(item.nativeApplicationURL.startsWith('https://'))}
 if(fixture.source==='immuta'){assert.equal(api.models[0].postingDate,null);assert.equal(api.models[0].nativeCreatedAt,rows(apiJSON())[0].createdAt);assert.equal(api.models[0].nativeEmployerFieldPublished,false)}else assert.equal(api.models[0].postingDate,rows(apiJSON())[0].first_published)
})
test('unrelated publisher presentation changes do not replace recruitment authority',async()=>{
 const m=await direct(),changed=corporate.body.replace('</head>','<meta name="publisher-presentation" content="changed independently"></head>');assert.deepEqual(m.readCorporate(changed).contract,m.readCorporate(corporate.body).contract);assert.equal(m.readCorporate(changed).wholeOriginalHTML,changed)
})
test('missing active current native employer declaration is held, including inert decoys',async()=>{
 const m=await direct();let changed
 if(fixture.source==='housecallpro')changed=corporate.body.replace('<script src="'+m.DECLARATION+'"','<template><script src="'+m.DECLARATION+'"').replace('onload="greenhouseLoaded()" async></script>','onload="greenhouseLoaded()" async></script></template>')
 else if(fixture.source==='huntress')changed=corporate.body.replaceAll('https://job-boards.greenhouse.io/huntress','https://job-boards.greenhouse.io/foreign-employer')
 else changed=corporate.body.replaceAll(m.DECLARATION,m.DECLARATION.replace('/immuta?','/foreign-employer?'))
 assert.throws(()=>m.readCorporate(changed),/declaration|tenant|fetch|consumer/i)
})
test('new unreviewed authored native fields cannot disappear from qualified criteria',async()=>{
 const m=await direct(),payload=apiJSON();rows(payload)[0].additionalRequirements='New mandatory qualification';assert.throws(()=>m.readNativeAPI(JSON.stringify(payload)),/schema|authored fields/)
})
test('native employer/application identity conflicts fail before admission',async()=>{
 const m=await direct(),payload=apiJSON(),r=rows(payload)[0];if(fixture.source==='immuta')r.applyUrl='https://jobs.lever.co/foreign/'+r.id+'/apply';else r.company_name='Foreign employer';assert.throws(()=>m.readNativeAPI(JSON.stringify(payload)),/employer|application/)
})
test('countryless role workplace remains a full held observation and cannot infer India',async()=>{
 const m=await direct(),payload=apiJSON(),r=rows(payload)[0];if(fixture.source==='immuta')r.country=null;else r.location.name='Remote';const item=m.readNativeAPI(JSON.stringify(payload)).models[0];assert.equal(item.country,null);assert.equal(item.sourceRoleQualified,false);assert.ok(item.holds.includes('native-role-work-country-unqualified'));assert.deepEqual(item.wholeNativeRecord,r)
})
test('duplicate native role IDs and count disagreement fail closed',async()=>{
 const m=await direct(),payload=apiJSON();rows(payload)[1].id=rows(payload)[0].id;assert.throws(()=>m.readNativeAPI(JSON.stringify(payload)),/duplicate/)
 if(!Array.isArray(payload)){const other=apiJSON();other.meta.total++;assert.throws(()=>m.readNativeAPI(JSON.stringify(other)),/count/)}
})
test('changed closing full native criterion retains both versions but never claims reconciliation',async()=>{
 const m=await direct();await assert.rejects(m.run({fetchImpl:transport(payload=>{const r=rows(payload)[0];if(fixture.source==='immuta')r.additional+='<p>New mandatory criterion</p>';else r.content+='&lt;p&gt;New mandatory criterion&lt;/p&gt;'},'api-closing')}),error=>{assert.match(error.message,/models changed/);assert.equal(error.recruitmentObservations.wholeNativeRoleModelsClosingReconciled,false);assert.ok(error.recruitmentObservations.nativeClosing.native.models[0].sourceDescription.includes('New mandatory criterion'));return true})
})
test('closing native application/country changes never silently reuse complete opening facts',async()=>{
 const m=await direct();await assert.rejects(m.run({fetchImpl:transport(payload=>{const r=rows(payload)[0];if(fixture.source==='immuta')r.country='IN';else r.location.name='India'},'api-closing')}),error=>{assert.equal(error.recruitmentObservations.wholeNativeRoleModelsClosingReconciled,false);assert.equal(error.recruitmentObservations.nativeOpening.native.models.length,expected);return true})
})
test('failed closing fetch preserves observation prefix and exact HTTP cause',async()=>{
 const m=await direct();let count=0;await assert.rejects(m.run({fetchImpl:async url=>{if(++count===4)return {status:403,url,headers:new Headers({'content-type':'text/html'}),body:{cancel:async()=>{},getReader(){throw Error('Denied body must not be read')}}};return makeResponse(url,url===corporate.receipt.requestedURL?corporate:native)}}),error=>{assert.equal(error.status??error.httpStatus,403);assert.equal(error.recruitmentObservations.observedVacancyCount,expected);assert.equal(error.recruitmentObservations.wholeNativeRoleModelsClosingReconciled,false);return true})
})
test('current reader rejects body-only callbacks before native requests',async()=>{const m=await direct();await assert.rejects(m.run({fetchText:async()=>corporate.body}),/original current HTTP metadata/i)})
for(const reason of [null,Object.freeze({caller:'opaque'})]){
 test('exact caller preabort '+String(reason),async()=>{const m=await direct(),c=new AbortController();c.abort(reason);await assert.rejects(m.run({signal:c.signal,fetchImpl:async()=>{throw Error('must not fetch')}}),e=>e===reason)})
 for(const path of ['success-attachment','error-attachment','success-close','error-close'])test('exact caller after final '+path+' '+String(reason),async()=>{
  const m=await direct(),c=new AbortController(),define=Object.defineProperty,abort=AbortController.prototype.abort
  if(path.endsWith('attachment'))Object.defineProperty=function(target,key,descriptor){const result=define(target,key,descriptor);if(key==='recruitmentObservations'&&(path.startsWith('success')?Array.isArray(target):target instanceof Error))c.abort(reason);return result}
  else AbortController.prototype.abort=function(...args){const result=abort.apply(this,args);if(this!==c&&args.length===0)c.abort(reason);return result}
  try{const fetchImpl=path.startsWith('success')?transport():async url=>({status:403,url,headers:new Headers({'content-type':'text/html'}),body:null});await assert.rejects(m.run({signal:c.signal,fetchImpl}),e=>e===reason)}finally{Object.defineProperty=define;AbortController.prototype.abort=abort}
 })
}

test('duplicate authored JSON identity/country keys never silently overwrite a conflicting value',async()=>{
 const m=await direct(),raw=native.body.replace(/"id"\s*:/,'"id":"conflicting-native-id","id":');assert.throws(()=>m.readNativeAPI(raw),/Malformed native API JSON/)
})

test('unreviewed closing native field retains the complete failed raw entity before parser rejection',async()=>{
 const m=await direct();await assert.rejects(m.run({fetchImpl:transport(payload=>{rows(payload)[0].additionalRequirements='Closing-only mandatory qualification'},'api-closing')}),error=>{assert.equal(error.recruitmentObservations.wholeNativeRoleModelsClosingReconciled,false);assert.ok(error.recruitmentObservations.nativeClosing.nativeResponse.body.includes('Closing-only mandatory qualification'));return true})
})
