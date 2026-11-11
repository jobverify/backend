import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {inspectNativeRole,run,NATIVE_API_URL} from './script.js'
import {createWatchguardTransport} from './transport20261111.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {extractionRawJobMetrics} from '../../scraper-support/utils/extractionRawJobMetrics.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/runtime20261111.json.gz',import.meta.url))))
const bytes=packet=>Buffer.from(packet.bodyBase64,'base64')
const records=JSON.parse(bytes(capture.responses.find(packet=>packet.kind==='api')))
const selected=records.find(record=>record.id==='8f641025-52d4-434d-b1eb-8a606eb64c4e')
const pageFor=record=>{const p=capture.responses.find(packet=>packet.requestedURL===record.hostedUrl);return{url:p.finalURL,status:p.status,contentType:p.contentType,html:bytes(p).toString('utf8')}}
const changeSchema=(page,edit)=>({...page,html:page.html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/i,(_,start,json,end)=>{const schema=JSON.parse(json);edit(schema);return start+JSON.stringify(schema)+end})})
const replay=mutate=>{
 const queues=new Map(),calls=[]
 for(const packet of capture.responses.filter(packet=>packet.kind!=='corporate')){if(!queues.has(packet.requestedURL))queues.set(packet.requestedURL,[]);queues.get(packet.requestedURL).push(packet)}
 return{calls,async fetchImpl(url,init){const packet=queues.get(url)?.shift();assert.ok(packet,'Exact original occurrence required: '+url);calls.push(url);const result={...packet,bytes:bytes(packet)};mutate?.(result,{url,init,calls});const response=new Response(result.bytes,{status:result.status,headers:{...result.headers,'content-type':result.contentType}});Object.defineProperty(response,'url',{value:result.finalURL});return response}}
}
test('genuine current entity-encoded schema title binds the same literal feed and visible own role',()=>{
 const role=inspectNativeRole(selected,pageFor(selected));assert.equal(role.title,'Talent Acquisition & HR Generalist');assert.equal(role.sourceNativeSchema.title,'Talent Acquisition &amp; HR Generalist');assert.equal(role.jobId,selected.id);assert.equal(role.country,null)
})
test('all 35 genuine current own roles retain exact source records and unknown schema country',()=>{
 assert.equal(records.length,35);for(const record of records){const role=inspectNativeRole(record,pageFor(record));assert.deepEqual(role.sourceNativeRecord,record);assert.equal(role.country,null);assert.equal(role.fullSourceDetailQualified,false)}
})
test('literal ampersand JSON-LD title is also a valid exact semantic title',()=>{
 assert.equal(inspectNativeRole(selected,changeSchema(pageFor(selected),schema=>{schema.title=selected.text})).title,selected.text)
})
for(const title of ['Talent Acquisition &amp;amp; HR Generalist','Talent Acquisition & HR Specialist','Other Company - Talent Acquisition & HR Generalist'])test('schema title semantic conflict remains held '+title,()=>{
 assert.throws(()=>inspectNativeRole(selected,changeSchema(pageFor(selected),schema=>{schema.title=title})),/binding mismatch/)
})
test('current native full array and distinct closing array reconcile without authoritative India zero',async()=>{
 const transport=replay();let audit;const jobs=await run({...transport,onAudit:value=>{audit=value}});assert.equal(transport.calls.length,37);assert.equal(jobs.length,0);assert.equal(audit.nativeRecords.length,35);assert.equal(audit.nativeArraysReconciled,true);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.authoritativeIndiaFacetCount,null);assert.deepEqual(audit.originalOpening,records);assert.deepEqual(audit.originalClosing,JSON.parse(bytes(capture.responses.find(packet=>packet.kind==='api-closing'))));assert.ok(records.every(record=>record.country!=='IN'))
})
test('actual registered adapter preserves full current native observations and unresolved source scope',async()=>{
 const provider=getScraperCatalog().find(row=>row.source==='watchguard');let audit
 assert.match(provider.modulePath,/watchguard[\\/]script\.js$/)
 const jobs=await createCatalogScraper(provider).run({...replay(),onAudit:value=>{audit=value}}),evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0);assert.equal(audit.observedNativeCount,35);assert.equal(audit.roleSchemas.length,35);assert.equal(audit.currentLiveQualification,false);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(evidence.listingComplete,false);assert.equal(evidence.indiaFacetCount,null)
 assert.deepEqual(readSourceObservationEvidence(jobs,'watchguard'),{source:'watchguard',recordKind:'vacancy-rows',observedRecordCount:35,observedVacancyCount:35,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 assert.deepEqual(extractionRawJobMetrics(provider,jobs,evidence),{rawJobs:35,rawJobsBasis:'observed-native-vacancy-rows'})
})
test('genuine full criteria in native salary section survive the own role model',()=>{
 const role=inspectNativeRole(selected,pageFor(selected)),doc=readNativeDocument(selected.salaryDescription),text=doc.text(doc.nodes(node=>node.tag==='root')[0]);assert.ok(text.length>1000);assert.ok(role.jobDescription.includes('Position Summary'));assert.ok(role.jobDescription.includes('Talent Acquisition'))
})
for(const field of ['openingPlain','descriptionPlain','descriptionBodyPlain','salaryDescriptionPlain','additionalPlain'])test('every original plain criteria variant must reconcile: '+field,()=>{
 const record=structuredClone(selected);record[field]+='\nMust complete the additional training module.';assert.throws(()=>inspectNativeRole(record,pageFor(selected)),/criteria/)
})
test('plain criteria use literal text semantics even when the original plain field contains markup-like characters',()=>{
 const record=structuredClone(selected);record.salaryDescriptionPlain+='<template>Must complete the additional training module.</template>';assert.throws(()=>inspectNativeRole(record,pageFor(selected)),/criteria/)
})
for(const field of ['opening','descriptionBody'])test('every original rich criteria variant must reconcile: '+field,()=>{
 const record=structuredClone(selected);record[field]+='<p>Must complete the additional training module.</p>';assert.throws(()=>inspectNativeRole(record,pageFor(selected)),/criteria/)
})
for(const field of ['opening','description','descriptionBody','salaryDescription','additional','openingPlain','descriptionPlain','descriptionBodyPlain','salaryDescriptionPlain','additionalPlain'])test('present nonstring original criteria shape cannot be silently ignored: '+field,()=>{
 const record=structuredClone(selected);record[field]=['Must complete the additional training module.'];assert.throws(()=>inspectNativeRole(record,pageFor(selected)),/criteria/)
})
for(const lists of [{requirements:'Must complete the additional training module.'},[{text:'Requirements',content:{mandatory:'Additional training'}}],[{text:['Requirements'],content:'Additional training'}],[['Additional training']],[{text:'Requirements',content:'Additional training',mandatory:'Additional training'}]])test('unsupported native list criteria shape remains held '+JSON.stringify(lists),()=>{
 const record=structuredClone(selected);record.lists=lists;assert.throws(()=>inspectNativeRole(record,pageFor(selected)),/criteria/)
})
test('optional absent/null criteria variants do not replace complete genuine own criteria',()=>{
 const record=structuredClone(selected);delete record.opening;record.openingPlain=null;record.lists=null;assert.equal(inspectNativeRole(record,pageFor(selected)).jobId,selected.id)
})
test('inverse affirmative own employer contradiction remains held',()=>{
 assert.throws(()=>inspectNativeRole(selected,withAddedCriteria('<p>Other Corporation is your employer.</p>')),/employer/)
})
test('source request deadline settles a fetch callback which ignores cancellation',async()=>{
 const result=await Promise.race([run({requestTimeoutMs:10,sourceTimeoutMs:30,fetchImpl:()=>new Promise(()=>{})}).then(()=>null,error=>error),new Promise(resolve=>setTimeout(()=>resolve('unsettled'),80))]);assert.notEqual(result,'unsettled');assert.equal(result.name,'TimeoutError')
})
test('caller cancellation settles an ignored fetch with the exact caller reason',async()=>{
 const controller=new AbortController(),reason=Error('Exact WatchGuard caller reason'),task=run({signal:controller.signal,fetchImpl:()=>new Promise(()=>{})});controller.abort(reason)
 const result=await Promise.race([task.catch(error=>error),new Promise(resolve=>setTimeout(()=>resolve('unsettled'),80))]);assert.equal(result,reason)
})
for(const reason of [null,'WatchGuard caller stop'])test('caller cancellation preserves non-Error reason '+String(reason),async()=>{
 const controller=new AbortController(),task=run({signal:controller.signal,fetchImpl:()=>new Promise(()=>{})});await pause(0);controller.abort(reason);await assert.rejects(task,error=>error===reason)
})
for(const kind of ['schema','headline','OG'])for(const tag of ['blockquote','pre','code','template'])test('quoted '+kind+' cannot provide own native identity in '+tag,()=>{
 const page=pageFor(selected),d=readNativeDocument(page.html),node=d.nodes(n=>kind==='schema'?n.tag==='script'&&n.attrs.type==='application/ld+json':kind==='headline'?n.tag==='div'&&d.hasClass(n,'posting-headline'):n.tag==='meta'&&n.attrs.property==='og:url')[0]
 const pattern=kind==='schema'?/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/i:kind==='headline'?/<div class="posting-headline">[\s\S]*?<\/h2>/:/<meta property="og:url"[^>]*>/
 assert.ok(node);assert.ok(pattern.test(page.html));page.html=page.html.replace(pattern,raw=>'<'+tag+'>'+raw+'</'+tag+'>');assert.throws(()=>inspectNativeRole(selected,page))
})
test('own schema cannot omit the genuine full salary-section role criteria',()=>{
 assert.throws(()=>inspectNativeRole(selected,changeSchema(pageFor(selected),schema=>{schema.description=selected.description+selected.additional})),/criteria|description/)
})
test('own visible role cannot lose the salary criteria while schema retains them',()=>{
 const page=pageFor(selected);page.html=page.html.replace('data-qa="salary-range"','data-qa="salary-range" hidden');assert.throws(()=>inspectNativeRole(selected,page),/criteria|description/)
})
test('nonblank own native country cannot contradict the explicit feed country',()=>{
 assert.throws(()=>inspectNativeRole(selected,changeSchema(pageFor(selected),schema=>{schema.jobLocation.address.addressCountry='Canada'})),/country/)
})
for(const field of ['hiringOrganization','ogURL','pageTitle','visibleTitle','UUID','applyURL','employment','location'])test('own '+field+' conflict remains held',()=>{
 const record=structuredClone(selected);let page=pageFor(record)
 if(field==='hiringOrganization')page=changeSchema(page,s=>{s.hiringOrganization.name='Other Corporation'})
 if(field==='ogURL')page.html=page.html.replace('property="og:url" content="'+record.hostedUrl,'property="og:url" content="https://jobs.lever.co/other/'+record.id)
 if(field==='pageTitle')page.html=page.html.replace('<title>','<title>Other Corporation - ')
 if(field==='visibleTitle')page.html=page.html.replace('<h2>','<h2>Other ')
 if(field==='UUID')record.id='00000000-0000-0000-0000-000000000000'
 if(field==='applyURL')record.applyUrl+='?other=1'
 if(field==='employment')page=changeSchema(page,s=>{s.employmentType='Contract'})
 if(field==='location')page=changeSchema(page,s=>{s.jobLocation.address.addressLocality='Toronto, Canada'})
 assert.throws(()=>inspectNativeRole(record,page))
})
const withAddedCriteria=addition=>{const page=changeSchema(pageFor(selected),schema=>{schema.description+=addition});return page}
for(const addition of ['<p>Employer: Other Corporation</p>','<p>Employer:</p><p>Other Corporation</p>','<p>You will be employed by Other Corporation.</p>',"<p>You won't be employed by WatchGuard Technologies, Inc.</p>",'<p>WatchGuard Technologies, Inc. is not your employer.</p>'])test('own criteria cannot contradict employer '+addition,()=>{
 assert.throws(()=>inspectNativeRole(selected,withAddedCriteria(addition)),/employer|country/)
})
test('own body country alternatives remain unresolved rather than inheriting primary native country',()=>{
 const role=inspectNativeRole(selected,withAddedCriteria('<p>Work Location:</p><p>Toronto (Canada), United States</p>'));assert.ok(role.sourceNativeCriteriaCountryIssues.some(issue=>issue.writtenCountries.includes('Canada')));assert.equal(role.country,null);assert.equal(role.fullSourceDetailQualified,false)
})
test('genuine own Ireland alternative omitted by API primary US remains explicit unresolved evidence',()=>{
 const record=records.find(row=>row.id==='5630d6ed-0fa7-42a3-9f44-56a2d41e9b74'),role=inspectNativeRole(record,pageFor(record));assert.equal(record.country,'US');assert.ok(role.sourceNativeCriteriaCountryIssues.some(issue=>issue.writtenCountries.includes('Ireland')));assert.equal(role.country,null)
})
test('unreconciled own workcountry cannot supply an emitted India candidate',async()=>{
 const india=structuredClone(selected);india.country='IN';india.categories.location='India';india.categories.allLocations=['India']
 let page=changeSchema(pageFor(selected),schema=>{schema.jobLocation.address.addressLocality='India';schema.jobLocation.address.addressCountry='IN';schema.description+='<p>Work Country: Canada</p>'});page.html=page.html.replaceAll('Miami, FL','India')
 await assert.rejects(run(replay((packet,{url})=>{if(url===NATIVE_API_URL)packet.bytes=Buffer.from(JSON.stringify([india]));if(url===india.hostedUrl)packet.bytes=Buffer.from(page.html)})),/candidate country alternatives unresolved/)
})
for(const boundary of ['main','address','aside'])for(const[left,right]of [['p','p'],['div','div'],['th','td'],['dt','dd']])test('own negative employer label keeps '+boundary+' and '+left+'/'+right+' boundaries',()=>{
 const pair='<'+left+'>Employer</'+left+'><'+right+'>:</'+right+'><'+right+'>Other Corporation</'+right+'>'
 const content=['th','td'].includes(left)?'<table><tr>'+pair+'</tr></table>':left==='dt'?'<dl>'+pair+'</dl>':pair
 assert.throws(()=>inspectNativeRole(selected,withAddedCriteria('Overview<'+boundary+'>'+content+'</'+boundary+'>')),/employer/)
})
for(const attribute of ['hidden','inert','aria-hidden="true"','style="display:none"'])test('inactive '+attribute+' employer example does not supply a contradiction',()=>{
 assert.equal(inspectNativeRole(selected,withAddedCriteria('<div '+attribute+'><p>Employer: Other Corporation</p></div>')).jobId,selected.id)
})
test('ignored quoted field value cannot borrow the following active employer value',()=>{
 assert.equal(inspectNativeRole(selected,withAddedCriteria('<p>Employer:</p><blockquote><p>Other Corporation</p></blockquote><p>WatchGuard Technologies</p>')).jobId,selected.id)
})
for(const tag of ['blockquote','pre','code','template'])test('quoted '+tag+' example cannot contradict real own criteria',()=>{
 assert.equal(inspectNativeRole(selected,withAddedCriteria('<'+tag+'><p>Employer: Other Corporation</p></'+tag+'>')).jobId,selected.id)
})
test('closing original full criteria drift still prevents source output',async()=>{
 await assert.rejects(run(replay((packet,{url,calls})=>{if(url===NATIVE_API_URL&&calls.filter(value=>value===url).length===2){const rows=JSON.parse(packet.bytes);rows[0].descriptionBody+=' changed';packet.bytes=Buffer.from(JSON.stringify(rows))}})),/closing original native/)
})
test('duplicate native UUIDs cannot inflate source observation evidence despite matching closing Map',async()=>{
 const duplicates=[...records.slice(0,-1),records[0]];let roleReads=0
 await assert.rejects(run({fetchImpl:async url=>{
  if(url!==NATIVE_API_URL)roleReads++
  const original=capture.responses.find(packet=>packet.requestedURL===url);assert.ok(original)
  const response=new Response(url===NATIVE_API_URL?JSON.stringify(duplicates):bytes(original),{status:original.status,headers:original.headers});Object.defineProperty(response,'url',{value:original.finalURL});return response
 }}),/duplicate native/);assert.equal(roleReads,0)
})
for(const field of ['status','URL','MIME'])test('original HTTP '+field+' mismatch is held',async()=>{
 await assert.rejects(run(replay(packet=>{if(field==='status')packet.status=403;if(field==='URL')packet.finalURL+='?different=1';if(field==='MIME')packet.contentType='text/plain'})),/native HTTP/)
})
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const busy=ms=>{const until=performance.now()+ms;while(performance.now()<until){/* synchronous callback stall */}}
test('synchronous callback time cannot escape monotonic request duration',async()=>{
 const transport=createWatchguardTransport({requestTimeoutMs:5,sourceTimeoutMs:100,fetchImpl:async()=>{busy(20);return new Response('[]')}},[])
 try{await assert.rejects(transport.read(NATIVE_API_URL,'json'),{name:'TimeoutError'})}finally{transport.close()}
})
test('synchronous callback time cannot escape monotonic source duration',async()=>{
 const transport=createWatchguardTransport({requestTimeoutMs:100,sourceTimeoutMs:5,fetchImpl:async()=>{busy(20);return new Response('[]')}},[])
 try{await assert.rejects(transport.read(NATIVE_API_URL,'json'),{name:'TimeoutError'})}finally{transport.close()}
})
test('late ignored fetch response is cancelled once without consuming its body',async()=>{
 let finish,cancelled=0,reads=0;const transport=createWatchguardTransport({requestTimeoutMs:5,sourceTimeoutMs:100,fetchImpl:()=>new Promise(resolve=>{finish=resolve})},[])
 try{await assert.rejects(transport.read(NATIVE_API_URL,'json'),{name:'TimeoutError'});finish({body:{cancel(){cancelled++},getReader(){reads++;throw Error('late body must not be consumed')}}});await pause(5);assert.equal(cancelled,1);assert.equal(reads,0)}finally{transport.close()}
})
test('ignored body read is cancelled and released once on deadline',async()=>{
 let cancelled=0,released=0;const transport=createWatchguardTransport({requestTimeoutMs:5,sourceTimeoutMs:100,fetchImpl:async()=>({status:200,url:NATIVE_API_URL,headers:new Headers({'content-type':'application/json'}),body:{getReader(){return{read:()=>new Promise(()=>{}),cancel(){cancelled++},releaseLock(){released++}}}}})},[])
 try{await assert.rejects(transport.read(NATIVE_API_URL,'json'),{name:'TimeoutError'});assert.equal(cancelled,1);assert.equal(released,1)}finally{transport.close()}
})
test('hard body limit cancels and releases the reader before accepting excessive bytes',async()=>{
 let cancelled=0,released=0;const transport=createWatchguardTransport({fetchImpl:async()=>({status:200,url:NATIVE_API_URL,headers:new Headers({'content-type':'application/json'}),body:{getReader(){return{read:async()=>({done:false,value:new Uint8Array(12000000)}),cancel(){cancelled++},releaseLock(){released++}}}}})},[])
 try{await assert.rejects(transport.read(NATIVE_API_URL,'json'),/byte limit/);assert.equal(cancelled,1);assert.equal(released,1)}finally{transport.close()}
})
test('source is closed after terminal success and admits no additional reads',async()=>{
 const transport=createWatchguardTransport({fetchImpl:async()=>{const response=new Response('[]',{headers:{'content-type':'application/json'}});Object.defineProperty(response,'url',{value:NATIVE_API_URL});return response}},[])
 await transport.read(NATIVE_API_URL,'json');transport.close();await assert.rejects(transport.read(NATIVE_API_URL,'json'),/closed/)
})
for(const field of ['requestTimeoutMs','sourceTimeoutMs'])for(const value of [0,-1,Infinity,1.5])test('invalid '+field+' limit fails before network: '+value,()=>{
 assert.throws(()=>createWatchguardTransport({[field]:value,fetchImpl:()=>assert.fail('invalid deadline fetched')},[]),RangeError)
})
test('audit callback ignoring cancellation remains bounded by source deadline',async()=>{
 await assert.rejects(run({...replay(),sourceTimeoutMs:1000,onAudit:()=>new Promise(()=>{})}),{name:'TimeoutError'})
})
