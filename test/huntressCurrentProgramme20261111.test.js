import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCurrentHuntressProgramme,runCurrentHuntressProgramme} from '../scraper/huntress/currentProgramme.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {validatePublicPostingScope} from '../scraper-support/utils/publishingGapAts.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/huntress-current-programme-20261111.json.gz',import.meta.url))))
const CORP='https://www.huntress.com/company/careers',BOARD='https://job-boards.greenhouse.io/huntress'
const API='https://boards-api.greenhouse.io/v1/boards/huntress/jobs?content=true'
const sha=value=>createHash('sha256').update(value).digest('hex')
for(const row of fixture.responses)assert.equal(sha(Buffer.from(row.bodyBase64,'base64')),row.bodySHA256)
const originalAPI=JSON.parse(Buffer.from(fixture.responses[2].bodyBase64,'base64').toString('utf8'))
const replay=(change=(_url,page)=>page)=>{
 const counts=new Map(),calls=[]
 const readPage=async url=>{
  const visit=(counts.get(url)||0)+1;counts.set(url,visit)
  const rows=fixture.responses.filter(row=>row.requestedURL===url),row=rows[visit-1]
  assert.ok(row,'Only the six original ordered native responses may be used: '+url)
  calls.push(url)
  const page={url:row.finalURL,status:row.status,headers:{...row.headers},bodyBase64:row.bodyBase64}
  return change(url,page,visit)
 }
 const fetchImpl=async url=>{
  const page=await readPage(url)
  const response=new Response(Buffer.from(page.bodyBase64,'base64'),{status:page.status,headers:page.headers})
  Object.defineProperty(response,'url',{value:page.url})
  return response
 }
 return{calls,readPage,fetchImpl,run:options=>readCurrentHuntressProgramme({readPage,now:()=>fixture.captureCompletedAt,...options})}
}
const forbidNetwork=t=>t.mock.method(globalThis,'fetch',()=>assert.fail('Native fixture replay must not use uncontrolled public requests'))

test('the six real Huntress snapshots qualify only the complete 46-posting foreign published programme',async t=>{
 forbidNetwork(t)
 const r=replay(),jobs=await r.run()
 assert.equal(jobs.length,0)
 const inventory=readInventoryEvidence(jobs)
 assert.equal(inventory?.status,'complete-inventory')
 assert.equal(inventory.listingComplete,true)
 assert.equal(inventory.firstParty,true)
 assert.equal(inventory.reportedTotal,46)
 assert.equal(inventory.indiaFacetCount,0)
 assert.equal(inventory.lifecycleCleanupAllowed,false)
 const observed=readSourceObservationEvidence(jobs,'huntress')
 assert.equal(observed.observedRecordCount,46)
 assert.equal(observed.observedVacancyCount,46)
 assert.deepEqual(r.calls,[CORP,BOARD,API,API,BOARD,CORP])
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.programmeQualification.status,'qualified-zero')
 assert.equal(audit.currentPublishedProgrammeComplete,true)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.companyGlobalScopeQualified,false)
 assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.ownRolePagesAcquired,false)
 assert.equal(audit.ownRoleSchemaAcquired,false)
 assert.equal(audit.applicationScreeningAcquired,false)
 assert.equal(audit.legalRegistryIdentityVerified,false)
})

test('full native API criteria, actual employer and both original revision models survive the bounded transport',async t=>{
 forbidNetwork(t)
 const r=replay(),jobs=await runCurrentHuntressProgramme({fetchImpl:r.fetchImpl,requestIntervalMs:0,now:()=>fixture.captureCompletedAt})
 const audit=jobs.nativeCollectionEvidence
 assert.ok(audit?.nativeAPI,'Retain the original native API, rather than only a selected or relabeled projection')
 assert.deepEqual(audit.nativeAPI,originalAPI)
 assert.deepEqual(audit.nativePayload,originalAPI)
 assert.deepEqual([...new Set(audit.nativeAPI.jobs.map(row=>row.company_name))],['Huntress Labs'])
 assert.equal(new Set(audit.nativeAPI.jobs.map(row=>row.id)).size,46)
 assert.equal(new Set(audit.nativeAPI.jobs.map(row=>row.internal_job_id)).size,41)
 assert.equal(audit.nativeBoard.revisionDifferences.length,46)
 assert.equal(audit.nativeBoard.revisionDifferenceCauseVerified,false)
 assert.equal(audit.corporateClosing.rawBodiesEqual,false)
 assert.equal(audit.corporateClosing.reviewedRepresentationEqual,true)
 assert.equal(audit.corporateClosing.openingRawSHA256,'80737381cc3a83ddf881f38ea3d135efce47102662d6630a4b947e81852254ff')
 assert.equal(audit.corporateClosing.closingRawSHA256,'7873354a4b3045750b13982bd6b99e62a36b73303907f634f66964e8fb939edd')
 assert.equal(audit.rawResponses.length,6)
 for(let index=0;index<6;index++)assert.equal(audit.rawResponses[index].bodyBase64,fixture.responses[index].bodyBase64)
 assert.deepEqual(r.calls,[CORP,BOARD,API,API,BOARD,CORP])
})

const body=page=>Buffer.from(page.bodyBase64,'base64').toString('utf8')
const changed=(page,edit)=>{
 const before=body(page),after=edit(before)
 assert.notEqual(after,before,'The acquired-packet control must actually change original bytes')
 return {...page,bodyBase64:Buffer.from(after).toString('base64')}
}
const apiChange=edit=>(url,page)=>url===API?changed(page,raw=>{
 const value=JSON.parse(raw);edit(value);return JSON.stringify(value)
}):page
const boardChange=edit=>(url,page)=>url===BOARD?changed(page,edit):page
const corpChange=edit=>(url,page)=>url===CORP?changed(page,edit):page
const held=async r=>{
 const error=await r.run().then(()=>assert.fail('An unqualified programme must never become zero'),error=>error)
 assert.equal(error.softFailure,true)
 assert.equal(error.code,'HUNTRESS_PROGRAMME_HOLD','Controls must reach an intentional programme guard, not a test or runtime exception')
 assert.equal(error.lifecycleCleanupAllowed,false)
 assert.notEqual(error.nativeCollectionEvidence?.programmeQualification?.status,'qualified-zero')
 return error
}

for(const [name,edit]of [
 ['primary India despite empty generic validator reasons',value=>{value.jobs[0].location.name='India';assert.deepEqual(validatePublicPostingScope(value.jobs,'greenhouse',{source:'huntress',boardToken:'huntress',companyName:'Huntress'}),[])}],
 ['additional India office',value=>{value.jobs[0].offices[0].name='India'}],
 ['unknown additional office location',value=>{value.jobs[0].offices[0].location='Worldwide'}],
 ['new applicant country model',value=>{value.jobs[0].applicantLocationRequirements={country:'India'}}],
 ['new metadata country',value=>{value.jobs[0].metadata=[{name:'additional locations',value:'India'}]}],
 ['unknown primary scope',value=>{value.jobs[0].location.name='Worldwide'}],
 ['foreign actual employer',value=>{value.jobs[0].company_name='Unrelated Employer'}],
 ['foreign own role account',value=>{value.jobs[0].absolute_url=value.jobs[0].absolute_url.replace('/huntress/','/foreign/')}],
 ['duplicate posting identity',value=>{value.jobs[1].id=value.jobs[0].id}],
 ['missing published criteria',value=>{value.jobs[0].content=''}],
 ['unknown nested location country',value=>{value.jobs[0].location.country='India'}],
 ['impossible publication calendar',value=>{value.jobs[0].first_published='2026-02-30T11:37:54-04:00'}],
 ['unreviewed content India restriction',value=>{value.jobs[0].content+='&lt;p&gt;Must be based in India.&lt;/p&gt;'}],
 ['empty API is not a fabricated zero',value=>{value.jobs=[];value.meta.total=0}],
 ['API total mismatch',value=>{value.meta.total++}],
])test('holds '+name,async t=>{forbidNetwork(t);await held(replay(apiChange(edit)))})

for(const [name,edit]of [
 ['native card country contradiction',raw=>raw.replace('<p class="body body__secondary body--metadata">United States of America</p>','<p class="body body__secondary body--metadata">India</p>')],
 ['unlinked additional India row',raw=>raw.replace('</tbody>','<tr class="job-post"><td>India engineering openings</td></tr></tbody>')],
 ['native hidden programme',raw=>raw.replace('</body>','<div hidden><a href="https://jobs.example.test/india">India openings</a></div></body>')],
 ['foreign namespace carrier',raw=>raw.replace('<script>window.__remixContext = ','<svg><script>window.__remixContext = ').replace(';</script><script type="module"',';</script></svg><script type="module"')],
 ['external source attribute on literal carrier',raw=>raw.replace('<script>window.__remixContext = ','<script src="">window.__remixContext = ')],
 ['nomodule literal carrier',raw=>raw.replace('<script>window.__remixContext = ','<script nomodule>window.__remixContext = ')],
 ['duplicate native JSON key',raw=>raw.replace('"urlToken":"huntress"','"urlToken":"foreign","urlToken":"huntress"')],
 ['native filtered page',raw=>raw.replace('"departmentIds":[]','"departmentIds":[4137171003]')],
 ['native missing page',raw=>raw.replace('"total_pages":1','"total_pages":2')],
 ['new native criterion outside cards',raw=>raw.replace('</body>','<p>Additional India vacancies</p></body>')],
])test('holds '+name,async t=>{forbidNetwork(t);await held(replay(boardChange(edit)))})

for(const [name,edit]of [
 ['changed corporate loader bytes',raw=>raw.replace('streamController.enqueue("','streamController.enqueue("unknown')],
 ['unknown corporate stream script',raw=>raw.replace('</body>','<script>window.extraRecruitment=true;</script></body>')],
 ['duplicate corporate stream boundary',raw=>raw.replace('</body>','<div id="B:0"></div></body>')],
 ['moved corporate original script',raw=>raw.replace('<script>window.__reactRouterContext.streamController.enqueue(', '<div hidden><script>window.__reactRouterContext.streamController.enqueue(').replace('streamController.close();</script>','streamController.close();</script></div>')],
 ['new hidden corporate programme',raw=>raw.replace('</body>','<div hidden><a href="https://job-boards.greenhouse.io/foreign">India openings</a></div></body>')],
 ['gallery UUID referenced elsewhere',raw=>{const id=/photo-gallery-section-([0-9a-f-]+)-carousel/.exec(raw)[1];return raw.replace('</body>','<span data-gallery="'+id+'"></span></body>')}],
 ['corporate native handoff changed',raw=>raw.replaceAll('https://job-boards.greenhouse.io/huntress','https://job-boards.greenhouse.io/foreign')],
])test('holds '+name,async t=>{forbidNetwork(t);await held(replay(corpChange(edit)))})

for(const target of [API,BOARD,CORP])test('closing drift is staged and withheld for '+new URL(target).hostname,async t=>{
 forbidNetwork(t)
 const r=replay((url,page,visit)=>url===target&&visit===2?changed(page,raw=>raw+'\n'):page)
 await held(r)
})

test('CSP changes retain a hold despite equivalent reviewed corporate body components',async t=>{
 forbidNetwork(t)
 await held(replay((url,page,visit)=>url===CORP&&visit===2?{...page,headers:{...page.headers,'content-security-policy':"default-src 'none'"}}:page))
})

for(const [name,change]of [
 ['redirect status',page=>({...page,status:302})],
 ['foreign final URL',page=>({...page,url:page.url+'?scope=other'})],
 ['unexpected MIME',page=>({...page,headers:{...page.headers,'content-type':'text/plain'}})],
 ['missing raw body',page=>({...page,bodyBase64:undefined})],
 ['body byte overflow',page=>({...page,bodyBase64:Buffer.alloc(4*1024*1024+1,32).toString('base64')})],
])test('bounded original response holds '+name,async t=>{forbidNetwork(t);await held(replay((_url,page)=>change(page)))})

test('a pre-aborted run uses no transport and cannot qualify zero',async t=>{
 forbidNetwork(t);const r=replay(),controller=new AbortController();controller.abort()
 await assert.rejects(()=>r.run({signal:controller.signal}),{name:'AbortError'});assert.deepEqual(r.calls,[])
})

test('the fixed six-read closing reserve is checked before any acquisition',async t=>{
 forbidNetwork(t);const r=replay();await held({run:()=>r.run({maxRequests:5})});assert.deepEqual(r.calls,[])
})

test('caller maxJobs zero cannot stand in for a finite native inventory',async t=>{
 forbidNetwork(t);const r=replay();await held({run:()=>r.run({maxJobs:0})});assert.deepEqual(r.calls,[])
})

test('the programme count follows all consistent current native records rather than freezing 46',async t=>{
 forbidNetwork(t)
 const original=Buffer.from(fixture.responses[1].bodyBase64,'base64').toString('utf8')
 const carrier=/window\.__remixContext = ([\s\S]*?);<\/script>/.exec(original),model=JSON.parse(carrier[1])
 const posts=model.state.loaderData['routes/$url_token'].jobPosts
 const removed=posts.data.find(row=>posts.data.filter(other=>other.department.id===row.department.id).length>1)
 assert.ok(removed)
 const r=replay((url,page)=>{
  if(url===API)return changed(page,raw=>{const value=JSON.parse(raw);value.jobs=value.jobs.filter(row=>row.id!==removed.id);value.meta.total--;return JSON.stringify(value)})
  if(url===BOARD)return changed(page,raw=>{
   const replacement=structuredClone(model),selected=replacement.state.loaderData['routes/$url_token'].jobPosts
   selected.data=selected.data.filter(row=>row.id!==removed.id);selected.count--;selected.total--
   const rows=[...raw.matchAll(/<tr class="job-post">[\s\S]*?<\/tr>/g)],row=rows.find(m=>m[0].includes('/jobs/'+removed.id+'"'))
   assert.ok(row)
   return raw.replace(carrier[0],`window.__remixContext = ${JSON.stringify(replacement)};</script>`)
    .replace(row[0],'').replace('data-testid="job-count-header">46 jobs','data-testid="job-count-header">45 jobs')
  })
  return page
 })
 const jobs=await r.run()
 assert.equal(readInventoryEvidence(jobs).reportedTotal,45)
 assert.equal(readSourceObservationEvidence(jobs,'huntress').observedRecordCount,45)
 assert.equal(jobs.nativeCollectionEvidence.nativePayload.jobs.length,45)
 assert.equal(jobs.nativeCollectionEvidence.programmeQualification.status,'qualified-zero')
 assert.equal(r.calls.length,6)
})

test('positive-reader-required retains the actual India record rather than dropping it into zero',async t=>{
 forbidNetwork(t)
 const error=await held(replay(apiChange(value=>{value.jobs[0].location.name='India'})))
 assert.equal(error.positiveReaderRequired,true)
 assert.equal(error.nativeCollectionEvidence.nativePayload.jobs[0].location.name,'India')
 assert.equal(error.nativeCollectionEvidence.nativePayload.jobs[0].content,originalAPI.jobs[0].content)
 assert.equal(error.nativeCollectionEvidence.currentPublishedProgrammeComplete,false)
})

test('transport uses the six exact public GETs without redirects, credentials, caches or parsed injection',async t=>{
 forbidNetwork(t);const r=replay(),inits=[]
 const jobs=await runCurrentHuntressProgramme({requestIntervalMs:0,now:()=>fixture.captureCompletedAt,
  fetchImpl:async(url,init)=>{inits.push(init);return r.fetchImpl(url,init)},fetchJson:()=>assert.fail('Raw transport must win')})
 assert.equal(jobs.nativeCollectionEvidence.nativeProgrammeRequests,6)
 assert.equal(inits.length,6)
 for(const init of inits){assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store')}
 await assert.rejects(()=>runCurrentHuntressProgramme({fetchJson:()=>originalAPI}),error=>error.softFailure&&/Parsed-only/.test(error.message))
})

test('raw injected pages need original bytes and response URL provenance',async t=>{
 forbidNetwork(t)
 await assert.rejects(()=>runCurrentHuntressProgramme({requestIntervalMs:0,
  fetchPage:async()=>({status:200,headers:{'content-type':'text/html'},html:'<p>synthetic</p>'})}),
 error=>error.softFailure&&/original raw bytes/.test(error.message))
})

test('a native reader which ignores abort still ends at the request deadline',async t=>{
 forbidNetwork(t);let count=0
 await assert.rejects(()=>readCurrentHuntressProgramme({readPage:()=>{count++;return new Promise(()=>{})},requestTimeoutMs:15}),{name:'TimeoutError'})
 assert.equal(count,1)
})

test('late response bodies are cancelled after an ignored fetch deadline',async t=>{
 forbidNetwork(t);let resolveFetch,cancelled=0
 const pending=runCurrentHuntressProgramme({fetchImpl:()=>new Promise(resolve=>{resolveFetch=resolve}),requestTimeoutMs:15,requestIntervalMs:0})
 await assert.rejects(()=>pending,{name:'TimeoutError'})
 const response=new Response(new ReadableStream({cancel(){cancelled++}}),{headers:{'content-type':'text/html'}})
 Object.defineProperty(response,'url',{value:CORP});resolveFetch(response)
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(cancelled,1)
})

test('a stalled original response stream is bounded and cancelled',async t=>{
 forbidNetwork(t);let cancelled=0
 const response=new Response(new ReadableStream({pull:()=>new Promise(()=>{}),cancel(){cancelled++}}),{headers:{'content-type':'text/html'}})
 Object.defineProperty(response,'url',{value:CORP})
 await assert.rejects(()=>runCurrentHuntressProgramme({fetchImpl:async()=>response,requestTimeoutMs:15,requestIntervalMs:0}),{name:'TimeoutError'})
 assert.equal(cancelled,1)
})

test('stream overflow cancels the reader at the four-MiB entity cap',async t=>{
 forbidNetwork(t);let cancelled=0
 const response=new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(4*1024*1024+1))},cancel(){cancelled++}}),{headers:{'content-type':'text/html'}})
 Object.defineProperty(response,'url',{value:CORP})
 await assert.rejects(()=>runCurrentHuntressProgramme({fetchImpl:async()=>response,requestIntervalMs:0}),error=>error.softFailure&&/byte bound/.test(error.message))
 assert.equal(cancelled,1)
})

test('an audit callback cannot mutate the original native payload or scope holds',async t=>{
 forbidNetwork(t);const r=replay()
 const jobs=await r.run({onAudit:audit=>{audit.nativePayload.jobs[0].company_name='Changed';audit.lifecycleCleanupAllowed=true}})
 assert.deepEqual(jobs.nativeCollectionEvidence.nativePayload,originalAPI)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
})

test('a callback which ignores abort stays within the source deadline',async t=>{
 forbidNetwork(t);const r=replay();let called=false
 await assert.rejects(()=>r.run({sourceTimeoutMs:800,onAudit:()=>{called=true;return new Promise(()=>{})}}),{name:'TimeoutError'})
 assert.equal(called,true)
})

test('abort during the final evidence callback withholds the staged zero',async t=>{
 forbidNetwork(t);const r=replay(),controller=new AbortController()
 await assert.rejects(()=>r.run({signal:controller.signal,onAudit:()=>controller.abort()}),{name:'AbortError'})
 assert.equal(r.calls.length,6)
})

test('duplicate decoded API identity keys remain a hold',async t=>{
 forbidNetwork(t)
 await held(replay((url,page)=>url===API?changed(page,raw=>JSON.stringify(JSON.parse(raw)).replace('"company_name":"Huntress Labs"','"company_name":"Other","company_name":"Huntress Labs"')):page))
})

test('invalid original UTF-8 is never interpreted as a native zero page',async t=>{
 forbidNetwork(t)
 await held(replay((_url,page)=>({...page,bodyBase64:Buffer.from([255]).toString('base64')})))
})

test('equal newly restrictive CSP in both phases is not a reviewed active authority profile',async t=>{
 forbidNetwork(t)
 await held(replay((url,page)=>url===CORP?{...page,headers:{...page.headers,'content-security-policy':"script-src 'none'; sandbox"}}:page))
})

test('equal new native sandbox CSP in both phases cannot authorize the reviewed loader',async t=>{
 forbidNetwork(t)
 await held(replay((url,page)=>url===BOARD?{...page,headers:{...page.headers,'content-security-policy':"sandbox; script-src 'none'"}}:page))
})

test('an XML MIME variant is not the captured native HTML execution model',async t=>{
 forbidNetwork(t)
 await held(replay((url,page)=>url===BOARD?{...page,headers:{...page.headers,'content-type':'application/xhtml+xml'}}:page))
})

test('the source deadline is enforced even when immediate hooks starve the timer task queue',async t=>{
 forbidNetwork(t);const r=replay()
 await assert.rejects(()=>r.run({sourceTimeoutMs:1}),{name:'TimeoutError'})
})

test('a received unreviewed security profile still retains its bounded original response',async t=>{
 forbidNetwork(t)
 const error=await held(replay((url,page)=>url===BOARD?{...page,headers:{...page.headers,'content-security-policy':"sandbox; script-src 'none'"}}:page))
 const receipt=error.nativeCollectionEvidence.rawResponses.at(-1)
 assert.equal(receipt.requestedURL,BOARD)
 assert.equal(typeof receipt.bodyBase64,'string','Retain the bounded original body even when its security profile is unsupported')
 assert.equal(sha(Buffer.from(receipt.bodyBase64,'base64')),fixture.responses[1].bodySHA256)
 assert.equal(receipt.bodySHA256,fixture.responses[1].bodySHA256)
})

test('written India criteria behind the actual outer-HTML and inner-entity layers remain a hold',async t=>{
 forbidNetwork(t)
 await held(replay(apiChange(value=>{value.jobs[0].content+='&lt;p&gt;Must be based in Ind&amp;#105;a.&lt;/p&gt;'})))
})

test('an unreviewed embedded applicant programme inside published API content remains a hold',async t=>{
 forbidNetwork(t)
 await held(replay(apiChange(value=>{value.jobs[0].content+='&lt;iframe src=&quot;https://forms.example.test/apply&quot;&gt;&lt;/iframe&gt;'})))
})

test('a shadowed typed-array byteLength cannot bypass the streaming entity bound',async t=>{
 forbidNetwork(t)
 const bytes=new Uint8Array(4*1024*1024+1);Object.defineProperty(bytes,'byteLength',{value:0})
 const response=new Response(new ReadableStream({start(controller){controller.enqueue(bytes);controller.close()}}),{headers:{'content-type':'text/html'}})
 Object.defineProperty(response,'url',{value:CORP})
 await assert.rejects(()=>runCurrentHuntressProgramme({fetchImpl:async()=>response,requestIntervalMs:0}),
 error=>error.softFailure&&/Streaming native response byte bound/.test(error.message))
})

for(const [name,key,value,closingToo]of [
 ['HTTP Refresh redirect','refresh','0; url=https://other-employer.example/careers',true],
 ['access-challenge header','cf-mitigated','challenge',false],
 ['Content-Disposition download','content-disposition','attachment; filename=jobs.html',true],
])test('same-body '+name+' cannot qualify an active native programme',async t=>{
 forbidNetwork(t)
 const error=await held(replay((url,page,visit)=>url===BOARD&&(closingToo||visit===1)?{...page,headers:{...page.headers,[key]:value}}:page))
 const receipt=error.nativeCollectionEvidence.rawResponses.at(-1)
 assert.equal(receipt.headers[key],value)
 assert.equal(receipt.bodySHA256,fixture.responses[1].bodySHA256)
 assert.equal(typeof receipt.bodyBase64,'string')
})

test('unreviewed Location, Content-Location and authentication signals hold even with empty header values',async t=>{
 forbidNetwork(t)
 for(const [key,target]of [['location',CORP],['content-location',BOARD],['www-authenticate',API],
  ['proxy-authenticate',CORP],['authentication-info',BOARD],['x-captcha-state',API]]){
  const error=await held(replay((url,page)=>url===target?{...page,headers:{...page.headers,[key]:''}}:page))
  assert.equal(error.nativeCollectionEvidence.rawResponses.at(-1).headers[key],'')
 }
})

test('a consistent India title across API, native model and visible card cannot disappear into zero',async t=>{
 forbidNetwork(t)
 const selected=originalAPI.jobs[0]
 const r=replay((url,page)=>{
  if(url===API)return changed(page,raw=>{const value=JSON.parse(raw);value.jobs[0].title+=' - India';return JSON.stringify(value)})
  if(url!==BOARD)return page
  return changed(page,raw=>{
   let next=raw.replace(/window\.__remixContext = ([\s\S]*?);<\/script>/,(_,data)=>{
    const model=JSON.parse(data),posting=model.state.loaderData['routes/$url_token'].jobPosts.data.find(row=>row.id===selected.id)
    assert.ok(posting);posting.title+=' - India';return 'window.__remixContext = '+JSON.stringify(model)+';</script>'
   })
   const row=[...next.matchAll(/<tr class="job-post">[\s\S]*?<\/tr>/g)].find(match=>match[0].includes('/jobs/'+selected.id+'"'))
   assert.ok(row);assert.ok(row[0].includes(selected.title))
   next=next.replace(row[0],row[0].replace(selected.title,selected.title+' - India'))
   return next
  })
 })
 const error=await held(r)
 assert.match(error.message,/title.*India scope/)
 assert.equal(error.nativeCollectionEvidence.nativePayload.jobs[0].title,selected.title+' - India')
})

for(const [name,target,mime]of [
 ['native UTF-16 HTML',BOARD,'text/html; charset=utf-16le'],
 ['ambiguous corporate charset',CORP,'text/html; charset=utf-8; charset=utf-16le'],
 ['non-UTF8 API declaration',API,'application/json; charset=iso-8859-1'],
])test('unchanged bodies with '+name+' cannot borrow the UTF-8 native reader',async t=>{
 forbidNetwork(t)
 const error=await held(replay((url,page)=>url===target?{...page,headers:{...page.headers,'content-type':mime}}:page))
 const receipt=error.nativeCollectionEvidence.rawResponses.at(-1)
 assert.equal(receipt.headers['content-type'],mime)
 assert.ok(receipt.bodySHA256)
})

test('explicit quoted UTF-8 media parameters preserve the reviewed decoding model',async t=>{
 forbidNetwork(t)
 const jobs=await replay((url,page)=>({...page,headers:{...page.headers,'content-type':(url===API?'application/json':'text/html')+'; charset="UTF-8"'}})).run()
 assert.equal(jobs.nativeCollectionEvidence.programmeQualification.status,'qualified-zero')
 assert.equal(jobs.nativeCollectionEvidence.nativePayload.jobs.length,46)
})
