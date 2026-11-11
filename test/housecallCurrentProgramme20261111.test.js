import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {runCurrentHousecallProgramme,readCurrentHousecallProgramme} from '../scraper/housecallpro/currentProgramme.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {validatePublicPostingScope} from '../scraper-support/utils/publishingGapAts.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/housecallpro-current-programme-20261111.json.gz',import.meta.url))))
const C='https://www.housecallpro.com/careers/',J='https://boards.greenhouse.io/embed/job_board/js?for=housecall'
const A='https://boards-api.greenhouse.io/v1/boards/housecall/jobs?content=true'
const sha=value=>createHash('sha256').update(value).digest('hex')
for(const row of fixture.responses)assert.equal(sha(Buffer.from(row.bodyBase64,'base64')),row.bodySHA256)
const originalAPI=JSON.parse(Buffer.from(fixture.responses.find(r=>r.kind==='api'&&r.phase==='opening').bodyBase64,'base64'))
const F1=fixture.responses.find(r=>r.kind==='page1').requestedURL,F2=fixture.responses.find(r=>r.kind==='page2').requestedURL
const M=fixture.responses.find(r=>r.kind==='module').requestedURL,E=fixture.responses.find(r=>r.kind==='entry').requestedURL,V=fixture.responses.find(r=>r.kind==='vendor').requestedURL
const expectedOrder=[C,J,F1,F2,A,M,E,V,V,E,M,A,F2,F1,J,C]
const replay=(change=(_url,page)=>page)=>{
 const counts=new Map(),calls=[],changed=[]
 const readPage=async(url,init)=>{
  const occurrence=counts.get(url)||0;counts.set(url,occurrence+1)
  const packet=fixture.responses.filter(row=>row.requestedURL===url)[occurrence]
  assert.ok(packet,'Only original exact native URL/occurrence may be requested')
  calls.push({url,init,occurrence,kind:packet.kind})
  const original={url:packet.finalURL,status:packet.status,headers:{...packet.headers},bodyBase64:packet.bodyBase64}
  const page=change(url,original,occurrence,packet)
  if(JSON.stringify(page)!==JSON.stringify(original))changed.push({url,occurrence})
  return page
 }
 const fetchImpl=async(url,init)=>{
  const page=await readPage(url,init),response=new Response(Buffer.from(page.bodyBase64,'base64'),{status:page.status,headers:page.headers})
  Object.defineProperty(response,'url',{value:page.url});return response
 }
 return {readPage,fetchImpl,calls,changed,runNative:options=>readCurrentHousecallProgramme({readPage,now:()=>fixture.captureCompletedAt,...options}),run:options=>runCurrentHousecallProgramme({
  fetchImpl,fetchPage:async url=>{const page=await readPage(url);return {url:page.url,status:page.status,html:Buffer.from(page.bodyBase64,'base64').toString('utf8')}},
  fetchJson:async url=>JSON.parse(Buffer.from((await readPage(url)).bodyBase64,'base64')),
  now:()=>fixture.captureCompletedAt,requestIntervalMs:0,...options})}
}
const noNetwork=t=>t.mock.method(globalThis,'fetch',()=>assert.fail('Actual-packet regression forbids public HTTP'))

test('sixteen actual Housecall packets qualify only the complete54-role foreign API-published programme',async t=>{
 noNetwork(t)
 const r=replay(),jobs=await r.run(),inventory=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0)
 assert.equal(inventory?.status,'complete-inventory','Current declared complete finite programme must have independent native authority and exhaustive SSR/API proof')
 assert.equal(inventory.listingComplete,true);assert.equal(inventory.reportedTotal,54)
 assert.equal(inventory.indiaFacetCount,0);assert.equal(inventory.lifecycleCleanupAllowed,false)
 assert.equal(inventory.pagesFetched,16);assert.deepEqual(r.calls.map(c=>c.url),expectedOrder)
 const observed=readSourceObservationEvidence(jobs,'housecallpro'),audit=jobs.nativeCollectionEvidence
 assert.equal(observed.observedRecordCount,54);assert.equal(observed.sourceScopeComplete,false)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyGlobalScopeQualified,false)
 assert.equal(audit.currentPublishedProgrammeComplete,true);assert.equal(audit.nativeIndiaCount,0)
 assert.equal(audit.ownRolePagesAcquired,false);assert.equal(audit.ownRoleSchemaAcquired,false)
 assert.equal(audit.applicationScreeningAcquired,false);assert.equal(audit.legalRegistryIdentityVerified,false)
 assert.equal(audit.lifecycleCleanupAllowed,false);assert.deepEqual(audit.nativePayload,originalAPI)
 assert.equal(audit.nativeEmployer,'Housecall Pro');assert.equal(audit.nativeProgrammeRequests,16)
 assert.equal(audit.nativePages[0].revisionDifferences.length+audit.nativePages[1].revisionDifferences.length,54)
 assert.equal(audit.SSRAndAPIRevisionsInterchangeable,false)
 for(const pair of audit.nativePageClosings){assert.equal(pair.rawBodiesEqual,false);assert.equal(pair.criteriaAndIdentityUnchanged,true)}
 assert.equal(audit.wholeNativeAPIClosingUnchanged,true);assert.equal(audit.wholeClientAndTokenClosingUnchanged,true)
 assert.equal(audit.rawResponses.length,16)
 for(let i=0;i<16;i++)assert.equal(audit.rawResponses[i].bodyBase64,fixture.responses[i].bodyBase64)
 assert.equal(fixture.actualOriginalCaptureGuardStatus,'held-native-presentation-variant')
})

test('preaborted native source makes no request and never qualifies zero',async t=>{
 noNetwork(t)
 const r=replay(),controller=new AbortController();controller.abort(new DOMException('cancelled','AbortError'))
 await assert.rejects(r.run({signal:controller.signal}),error=>error.name==='AbortError')
 assert.equal(r.calls.length,0)
})

const body=page=>Buffer.from(page.bodyBase64,'base64').toString('utf8')
const editBody=(page,edit)=>{
 const before=body(page),after=edit(before)
 assert.notEqual(after,before,'Control must mutate actual acquired bytes')
 return {...page,bodyBase64:Buffer.from(after).toString('base64')}
}
const held=async(r,expected)=>{
 let captured
 await assert.rejects(r.run(),error=>{
  captured=error;assert.equal(error.code,'HOUSECALL_PROGRAMME_HOLD','Failure must be an intentional native qualification guard')
  assert.equal(error.softFailure,true);assert.equal(error.lifecycleCleanupAllowed,false)
  assert.equal(error.nativeCollectionEvidence?.currentPublishedProgrammeComplete,false)
  assert.doesNotMatch(error.message,/Only original exact|forbids public HTTP|Control targets|Control must mutate|is not defined|Original literal loader boundary/)
  if(expected)assert.match(error.message,expected)
  return true
 })
 return captured
}
for(const field of ['permissions-policy','document-policy'])for(const occurrence of [0,1])
 test(`holds new native ${field} policy at ${occurrence?'closing':'opening'}`,async t=>{
  noNetwork(t)
  const r=replay((url,page,visit)=>url===F1&&visit===occurrence?{...page,headers:{...page.headers,[field]:'unreviewed-current-policy'}}:page)
  await held(r,/security|policy/i)
  assert.equal(r.changed.length,1)
 })

const replace=(raw,from,to)=>{assert.ok(raw.includes(from),'Control targets original bytes');return raw.replace(from,to)}
const apiEdit=edit=>(url,page)=>url===A?editBody(page,raw=>{const value=JSON.parse(raw);edit(value);return JSON.stringify(value)}):page
const boardModel=(raw,edit)=>{
 const marker='window.__remixContext = ',start=raw.indexOf(marker)+marker.length,end=raw.indexOf(';</script>',start)
 assert.ok(start>=marker.length&&end>start,'Original literal loader boundary exists')
 const value=JSON.parse(raw.slice(start,end));edit(value);return raw.slice(0,start)+JSON.stringify(value)+raw.slice(end)
}
const boardEdit=edit=>(url,page)=>[F1,F2].includes(url)?editBody(page,edit):page
const corpEdit=edit=>(url,page)=>url===C?editBody(page,edit):page
const route=model=>model.state.loaderData['routes/embed.job_board']

test('a genuine complete53-role membership model qualifies without any frozen54-count or posting-ID list',async t=>{
 noNetwork(t)
 const removed=5803238004
 const r=replay((url,page)=>{
  if(url===A)return editBody(page,raw=>{const data=JSON.parse(raw);data.jobs=data.jobs.filter(j=>j.id!==removed);data.meta.total=53;return JSON.stringify(data)})
  if([F1,F2].includes(url))return editBody(page,raw=>{
   let next=boardModel(raw,value=>{const posts=route(value).jobPosts;posts.total=53;posts.data=posts.data.filter(j=>j.id!==removed);posts.count=posts.data.length})
   next=replace(next,'>54 jobs</h2>','>53 jobs</h2>')
   if(url===F2){const rows=[...next.matchAll(/<tr class="job-post">[\s\S]*?<\/tr>/g)],target=rows.filter(m=>m[0].includes('gh_jid='+removed+'"'))
    assert.equal(target.length,1);next=next.replace(target[0][0],'')}
   return next
  })
  return page
 })
 const jobs=await r.run(),audit=jobs.nativeCollectionEvidence
 assert.equal(readInventoryEvidence(jobs).reportedTotal,53);assert.equal(readSourceObservationEvidence(jobs,'housecallpro').observedRecordCount,53)
 assert.equal(audit.nativePages[0].posts.length,50);assert.equal(audit.nativePages[1].posts.length,3)
 assert.equal(audit.nativePayload.jobs.length,53);assert.ok(audit.nativePayload.jobs.every(j=>j.id!==removed))
 assert.deepEqual(audit.nativePayload.jobs.map(j=>j.content),originalAPI.jobs.filter(j=>j.id!==removed).map(j=>j.content))
 assert.equal(r.calls.length,16);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
})

test('native parentSouthAmerica stays an original group and never becomes an invented leaf country',async t=>{
 noNetwork(t)
 const jobs=await replay().run(),a=jobs.nativeCollectionEvidence
 const group=a.originalNativeOfficeHierarchy.find(o=>o.name==='South America')
 assert.equal(group.id,4023993004);assert.equal(group.children[0].name,'Brazil')
 const brazil=a.nativePayload.jobs.flatMap(j=>j.offices).filter(o=>o.name==='Brazil')
 assert.ok(brazil.length>0);assert.ok(brazil.every(o=>o.parent_id===group.id))
 assert.deepEqual(a.nativePayload,originalAPI);assert.match(a.nativeOfficeGroupingSemantics,/solely.*parent group/)
})

for(const[name,edit]of[
 ['primary India despite empty generic validator reasons',value=>{value.jobs[0].location.name='India';assert.deepEqual(validatePublicPostingScope(value.jobs,'greenhouse',{source:'housecallpro',boardToken:'housecall',companyName:'Housecall Pro'}),[])}],
 ['additional India office',value=>{value.jobs[0].offices[0].name='India'}],
 ['unknown office location',value=>{value.jobs[0].offices[0].location='Worldwide'}],
 ['new nested primary country',value=>{value.jobs[0].location.country='India'}],
 ['new applicant country model',value=>{value.jobs[0].applicantLocationRequirements={country:'India'}}],
 ['new metadata country',value=>{value.jobs[0].metadata=[{name:'Additional offices',value:'India'}]}],
 ['unknown primary country',value=>{value.jobs[0].location.name='Worldwide'}],
 ['parent region used as a country',value=>{value.jobs[0].offices[0].name='South America'}],
 ['native employer change',value=>{value.jobs[0].company_name='Other Employer'}],
 ['foreign own-role host',value=>{value.jobs[0].absolute_url=value.jobs[0].absolute_url.replace('www.housecallpro.com','foreign.example')}],
 ['API title India',value=>{value.jobs[0].title+=' - India'}],
 ['API entity title India',value=>{value.jobs[0].title+=' - &#73;ndia'}],
 ['full written India criterion',value=>{value.jobs[0].content+='&lt;p&gt;Must be based in India.&lt;/p&gt;'}],
 ['split-inline India criterion',value=>{value.jobs[0].content+='&lt;p&gt;Must be based in In&lt;span&gt;dia&lt;/span&gt;.&lt;/p&gt;'}],
 ['entity-wrapped India criterion',value=>{value.jobs[0].content+='&lt;p&gt;Must reside in &amp;#73;ndia.&lt;/p&gt;'}],
 ['new native criteria carrier',value=>{value.jobs[0].content+='&lt;iframe srcdoc="India roles"&gt;&lt;/iframe&gt;'}],
 ['foreign namespace criteria carrier',value=>{value.jobs[0].content+='&lt;svg&gt;&lt;a href="https://foreign.example/jobs"&gt;India&lt;/a&gt;&lt;/svg&gt;'}],
 ['new criteria application link',value=>{value.jobs[0].content+='&lt;a href="https://foreign.example/jobs"&gt;Application requirements&lt;/a&gt;'}],
 ['missing full original description',value=>{value.jobs[0].content=''}],
 ['empty API never manufactures zero',value=>{value.jobs=[];value.meta.total=0}],
 ['full API total mismatch',value=>{value.meta.total++}],
 ['duplicate full API posting',value=>{value.jobs[1].id=value.jobs[0].id}],
 ['unknown full native criterion key',value=>{value.jobs[0].mandatoryCondition='India residency'}],
 ['impossible native date',value=>{value.jobs[0].first_published='2026-02-30T12:00:00Z'}],
 ['new application compliance condition',value=>{value.jobs[0].data_compliance[0].applicantCountry='India'}],
])test('holds '+name,async t=>{noNetwork(t);const r=replay(apiEdit(edit));await held(r);assert.ok(r.changed.length>0)})

for(const[name,edit]of[
 ['SSR primary India',raw=>boardModel(raw,value=>{route(value).jobPosts.data[0].location='India'})],
 ['SSR India title',raw=>boardModel(raw,value=>{route(value).jobPosts.data[0].title+=' - India'})],
 ['SSR unknown country',raw=>boardModel(raw,value=>{route(value).jobPosts.data[0].location='Worldwide'})],
 ['missing native page',raw=>boardModel(raw,value=>{route(value).jobPosts.total_pages=1})],
 ['extra native page',raw=>boardModel(raw,value=>{route(value).jobPosts.total_pages=3})],
 ['native count beyond100',raw=>boardModel(raw,value=>{route(value).jobPosts.total=101})],
 ['native hidden filter',raw=>boardModel(raw,value=>{route(value).officeIds=[4004511004]})],
 ['new native country field',raw=>boardModel(raw,value=>{route(value).applicantCountry='India'})],
 ['native row extra criteria',raw=>boardModel(raw,value=>{route(value).jobPosts.data[0].requiredCountry='India'})],
 ['unlinked extra native row',raw=>replace(raw,'</tbody>','<tr class="job-post"><td>India Engineering openings</td></tr></tbody>')],
 ['additional active SVG programme',raw=>replace(raw,'</body>','<svg><a href="https://foreign.example/careers">India</a></svg></body>')],
 ['additional hidden native programme',raw=>replace(raw,'</body>','<div hidden><a href="https://foreign.example/jobs">India</a></div></body>')],
 ['new native renderer path',raw=>replace(raw,'embed.job_board-CU352uge.js','embed.job_board-unreviewed.js')],
 ['literal carrier src presence',raw=>replace(raw,'<script>window.__remixContext = ','<script src="">window.__remixContext = ')],
 ['literal carrier nomodule',raw=>replace(raw,'<script>window.__remixContext = ','<script nomodule>window.__remixContext = ')],
 ['foreign SVG loader carrier',raw=>replace(replace(raw,'<script>window.__remixContext = ','<svg><script>window.__remixContext = '),';</script><script type="module"',';</script></svg><script type="module"')],
 ['foreign Math loader carrier',raw=>replace(replace(raw,'<script>window.__remixContext = ','<math><script>window.__remixContext = '),';</script><script type="module"',';</script></math><script type="module"')],
 ['inert loader carrier',raw=>replace(replace(raw,'<script>window.__remixContext = ','<template><script>window.__remixContext = '),';</script><script type="module"',';</script></template><script type="module"')],
 ['duplicate native JSON key',raw=>replace(raw,'"urlToken":"housecall"','"urlToken":"foreign","urlToken":"housecall"')],
 ['unknown head title',raw=>raw.replace(/<title>(?:Jobs at Housecall Pro|page_title)<\/title>/,'<title>Jobs at Other Employer</title>')],
 ['contradictory OG employer',raw=>replace(raw,'property="og:title" content="Housecall Pro"','property="og:title" content="Other Employer"')],
 ['unknown badge label',raw=>raw.replace(/<span class="tag-text">(?:New|tags\.new)<\/span>/,'<span class="tag-text">tags.featured</span>')],
 ['extra badge outside a role',raw=>replace(raw,'</body>','<span class="tag-text">New</span></body>')],
])test('holds '+name,async t=>{noNetwork(t);const r=replay(boardEdit(edit));await held(r);assert.ok(r.changed.length>0)})

for(const[name,edit]of[
 ['hidden corporate programme',raw=>replace(raw,'</body>','<div hidden><a href="https://foreign.example/jobs">Engineering</a></div></body>')],
 ['corporate native account change',raw=>replace(raw,J,J.replace('for=housecall','for=foreign'))],
 ['corporate fragment referenced elsewhere',raw=>{const value=/1tkizce6wq\?dnt=1#\?secret=([A-Za-z0-9]{10})/.exec(raw);assert.ok(value);return replace(raw,'</body>','<span data-video="'+value[1]+'"></span></body>')}],
 ['changed corporate iframe criterion',raw=>replace(raw,'People Matter - Programs Launch Video','India Role Requirements')],
])test('holds '+name,async t=>{noNetwork(t);const r=replay(corpEdit(edit));await held(r);assert.ok(r.changed.length>0)})

for(const kind of ['corporate','client','page1','page2','api','module','entry','vendor'])test('withholds staged zero on closing '+kind+' drift',async t=>{
 noNetwork(t);let observed=0
 const r=replay((_url,page,occurrence,packet)=>packet.kind===kind&&occurrence===1?editBody(page,raw=>raw+'\n'):page)
 r.run= r.run.bind(null,{onAudit:()=>{observed++}})
 await held(r);assert.equal(observed,0)
 assert.ok(r.calls.length>=9);assert.ok(r.calls.slice(0,8).every(c=>c.occurrence===0))
})

test('closing whole client token cannot use the profile-recognition exception',async t=>{
 noNetwork(t)
 const r=replay((url,page,occurrence)=>url===J&&occurrence===1?editBody(page,raw=>raw.replace(/(embedToken: ')[A-Za-z0-9_-]/,(_all,prefix)=>prefix+'A')):page)
 await held(r,/Closing whole original client/);assert.equal(r.changed.length,1)
})

for(const name of ['refresh','content-location','content-disposition','www-authenticate','cf-mitigated'])test('holds unreviewed original response '+name,async t=>{
 noNetwork(t)
 const r=replay((url,page)=>url===F1?{...page,headers:{...page.headers,[name]:name==='cf-mitigated'?'challenge':'unreviewed-response-authority'}}:page)
 const error=await held(r,/response header/),receipt=error.nativeCollectionEvidence.rawResponses.at(-1)
 assert.equal(receipt.bodyBase64,fixture.responses.find(p=>p.kind==='page1').bodyBase64)
 assert.equal(receipt.headers[name],name==='cf-mitigated'?'challenge':'unreviewed-response-authority')
})

for(const [url,contentType]of[
 [F1,'text/html; charset=windows-1252'],[F1,'text/html; charset=utf-8; charset=utf-8'],
 [A,'application/json; charset=iso-8859-1'],[A,'application/json; charset=utf-8, charset=utf-8'],
 [J,'application/javascript; charset=utf-8'],[M,'text/html; charset=utf-8'],
])test('holds unreviewed MIME or charset for '+(url===A?'API':url===J?'client':url===M?'module':'native')+' '+contentType,async t=>{
 noNetwork(t);const r=replay((target,page)=>target===url?{...page,headers:{...page.headers,'content-type':contentType}}:page)
 await held(r,/MIME|charset/)
})

test('holds native CSP that would disable its current consumer',async t=>{
 noNetwork(t);const r=replay((url,page)=>url===F1?{...page,headers:{...page.headers,'content-security-policy':"script-src 'none'; sandbox"}}:page)
 await held(r,/security-header/)
})

test('HTTP denial retains original native body and does not execute or bypass it',async t=>{
 noNetwork(t);const r=replay((url,page)=>url===F1?{...page,status:403}:page),error=await held(r,/HTTP403|HTTP 403/)
 assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.upstreamOutage,true)
 assert.equal(error.nativeCollectionEvidence.rawResponses.at(-1).bodyBase64,fixture.responses.find(p=>p.kind==='page1').bodyBase64)
 assert.equal(r.calls.length,3)
})

test('a changed exact response URL is held without following another surface',async t=>{
 noNetwork(t);const r=replay((url,page)=>url===F1?{...page,url:'https://foreign.example/jobs'}:page)
 await held(r,/URL identity/);assert.equal(r.calls.length,3)
})

test('parsed-only injection cannot impersonate original native response provenance',async t=>{
 noNetwork(t)
 await assert.rejects(runCurrentHousecallProgramme({fetchJson:async()=>originalAPI}),error=>error.code==='HOUSECALL_PROGRAMME_HOLD'&&/Parsed-only/.test(error.message))
})

test('the stream cap uses intrinsic chunk size even if byteLength is spoofed',async t=>{
 noNetwork(t);let cancelled=false
 const bytes=new Uint8Array(4*1024*1024+1);Object.defineProperty(bytes,'byteLength',{value:1})
 await assert.rejects(runCurrentHousecallProgramme({requestIntervalMs:0,fetchImpl:async()=>({url:C,status:200,headers:fixture.responses[0].headers,
  body:{getReader:()=>({read:async()=>({done:false,value:bytes}),cancel:()=>{cancelled=true},releaseLock:()=>{}})}})}),error=>error.code==='HOUSECALL_PROGRAMME_HOLD'&&/byte bound/.test(error.message))
 assert.equal(cancelled,true)
})

test('uncooperative original-page hooks are bounded by the source deadline',async t=>{
 noNetwork(t)
 await assert.rejects(readCurrentHousecallProgramme({readPage:()=>new Promise(()=>{}),sourceTimeoutMs:30,now:()=>fixture.captureCompletedAt}),error=>error.name==='TimeoutError')
})

test('uncooperative final observers are bounded after every closing read',async t=>{
 noNetwork(t);const r=replay()
 await assert.rejects(r.runNative({sourceTimeoutMs:1200,onAudit:()=>new Promise(()=>{})}),error=>error.name==='TimeoutError')
 assert.equal(r.calls.length,16)
})

test('monotonic deadline stops synchronous hook starvation before qualifying',async t=>{
 noNetwork(t);const packet=fixture.responses[0]
 await assert.rejects(readCurrentHousecallProgramme({sourceTimeoutMs:10,now:()=>fixture.captureCompletedAt,readPage:()=>{
  const started=performance.now();while(performance.now()-started<25){/* Deliberately starve the timer event loop. */}
  return {url:C,status:200,headers:packet.headers,bodyBase64:packet.bodyBase64}
 }}),error=>error.name==='TimeoutError')
})

test('fourMiB original HTML cap is checked before any native programme parser',async t=>{
 noNetwork(t);const r=replay((url,page)=>url===C?{...page,bodyBase64:Buffer.alloc(4*1024*1024+1,65).toString('base64')}:page)
 await held(r,/byte bound|entity\/aggregate/);assert.equal(r.calls.length,1)
})

test('sixMiB renderer cap does not raise the ordinary entity limit',async t=>{
 noNetwork(t);const r=replay((url,page)=>url===V?{...page,bodyBase64:Buffer.alloc(6*1024*1024+1,65).toString('base64')}:page)
 await held(r,/byte bound|entity\/aggregate/);assert.equal(r.calls.length,8)
})

test('invalid original UTF8 is retained and held rather than replacement-decoded',async t=>{
 noNetwork(t);const r=replay((url,page)=>url===C?{...page,bodyBase64:Buffer.from([0xC3,0x28]).toString('base64')}:page)
 const error=await held(r,/UTF-8 invalid/)
 assert.equal(error.nativeCollectionEvidence.rawResponses[0].bodyBase64,Buffer.from([0xC3,0x28]).toString('base64'))
})

test('an explicit contradictory HTML encoding cannot be hidden by valid HTTP UTF8',async t=>{
 noNetwork(t);const r=replay(boardEdit(raw=>raw.replace(/<meta charSet="utf-8"\/>|<meta charset="utf-8"\/>/,'<meta charset="windows-1252"/>')))
 await held(r,/charset/);assert.ok(r.changed.length>0)
})

test('every request preserves GET manual redirects credentialsomit and nosstore',async t=>{
 noNetwork(t);const r=replay();await r.run()
 assert.ok(r.calls.every(c=>c.init.method==='GET'&&c.init.redirect==='manual'&&c.init.credentials==='omit'&&c.init.cache==='no-store'))
})

test('uncooperative native fetch is bounded by its request deadline',async t=>{
 noNetwork(t)
 await assert.rejects(runCurrentHousecallProgramme({fetchImpl:()=>new Promise(()=>{}),sourceTimeoutMs:1000,requestTimeoutMs:30,requestIntervalMs:0}),error=>error.name==='TimeoutError')
})

test('uncooperative body reader is cancelled at its request deadline',async t=>{
 noNetwork(t);let cancelled=false
 await assert.rejects(runCurrentHousecallProgramme({sourceTimeoutMs:1000,requestTimeoutMs:30,requestIntervalMs:0,fetchImpl:async()=>({
  url:C,status:200,headers:fixture.responses[0].headers,
  body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:()=>{cancelled=true},releaseLock:()=>{}})},
 }),
 }),error=>error.name==='TimeoutError')
 assert.equal(cancelled,true)
})

for(const options of [{maxRequests:15},{maxPages:1},{sourceTimeoutMs:180001},{requestTimeoutMs:20001},{maxJobs:0}])
 test('insufficient or unbounded caller budget holds before all public reads '+JSON.stringify(options),async t=>{
  noNetwork(t);const r=replay()
  await assert.rejects(r.run(options),error=>error.code==='HOUSECALL_PROGRAMME_HOLD')
  assert.equal(r.calls.length,0)
 })

for(const[name,edit]of[
 ['additional unmatched API department membership',value=>{value.jobs[0].departments.push({id:990099,name:'India',child_ids:[],parent_id:null})}],
 ['missing API department ancestor',value=>{value.jobs[0].departments[0].parent_id=990099}],
])test('holds '+name,async t=>{noNetwork(t);await held(replay(apiEdit(edit)),/department|hierarchy|membership/)})

test('holds unsupported native department path even with unchanged primary department',async t=>{
 noNetwork(t);await held(replay(boardEdit(raw=>boardModel(raw,value=>{route(value).jobPosts.data[0].department.path=['India']}))),/department|hierarchy|path/)
})

for(const style of ['display:none','visibility:hidden','font-size:0'])test('holds hiddenX masking visible authored India with '+style,async t=>{
 noNetwork(t)
 await held(replay(apiEdit(value=>{value.jobs[0].content+='&lt;p&gt;Work country: I&lt;span style=&quot;'+style+'&quot;&gt;X&lt;/span&gt;ndia.&lt;/p&gt;'})),/authored|content|style|HTML/)
})

for(const location of ['Bengaluru, Karnataka','Bangalore'])test('holds authored Indian workcity '+location,async t=>{
 noNetwork(t)
 await held(replay(apiEdit(value=>{value.jobs[0].content+='&lt;p&gt;Work location: '+location+'.&lt;/p&gt;'})),/India|geograph/)
})

test('holds consistent native Bangalore title across API model and visible card',async t=>{
 noNetwork(t)
 const id=5803238004,original=originalAPI.jobs.find(j=>j.id===id);assert.ok(original)
 const title=original.title+' - Bangalore'
 const r=replay((url,page)=>{
  if(url===A)return editBody(page,raw=>{const data=JSON.parse(raw);data.jobs.find(j=>j.id===id).title=title;return JSON.stringify(data)})
  if(url===F2)return editBody(page,raw=>{
   let next=boardModel(raw,model=>{route(model).jobPosts.data.find(j=>j.id===id).title=title})
   const target=[...next.matchAll(/<tr class="job-post">[\s\S]*?<\/tr>/g)].find(m=>m[0].includes('gh_jid='+id+'"'));assert.ok(target)
   next=next.replace(target[0],replace(target[0],'>Senior Director, Sales<','>'+title+'<'));return next
  })
  return page
 })
 await held(r,/India|geograph/);assert.ok(r.changed.length>0)
})
