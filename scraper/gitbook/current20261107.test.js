import assert from 'node:assert/strict'
import test from 'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{createHash}from'node:crypto'
import{parse}from'acorn'
import{readNativeDocument}from'../../scraper-support/utils/activeNativeHtml.js'
import{run,CAREERS_PAGE_URL,ASHBY_JOB_BOARD_URL}from'./script.js'
import{readInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
const sha=v=>createHash('sha256').update(v).digest('hex')
const fixture=readFileSync(new URL('./fixtures/current-http-20261107.json.gz',import.meta.url))
const captured=JSON.parse(gunzipSync(fixture))
const profile=JSON.parse(readFileSync(new URL('./current-20261107.scope.json',import.meta.url)))
const network=globalThis.fetch;test.before(()=>{globalThis.fetch=()=>{throw Error('NETWORK TRIPWIRE')}});test.after(()=>{globalThis.fetch=network})
const replay=async({mutatePage,mutateJson,mutateProgram,signal,dataset=captured}={})=>{
 const calls=[],audits=[]
 const page=async(url,kind)=>{signal?.throwIfAborted();calls.push({url,kind});const n=calls.filter(r=>r.url===url).length;
  const packets=dataset.responses.filter(r=>r.url===url);const row=packets[Math.min(n-1,packets.length-1)];assert.ok(row,'Unexpected real-fixture request '+url)
  const value={status:row.status,url:row.finalUrl,html:row.body,contentType:row.contentType}
  return kind==='program'&&mutateProgram?mutateProgram(value,url,n):mutatePage?mutatePage(value,url,n):value}
 const jobs=await run({now:()=>dataset.completedAt,signal,fetchPage:url=>page(url,'page'),fetchProgram:url=>page(url,'program'),fetchJson:async url=>{const p=await page(url,'json');const value=JSON.parse(p.html);return mutateJson?mutateJson(value,calls.filter(r=>r.url===url).length):value},onAudit:value=>audits.push(value)})
 return{jobs,calls,audit:audits.at(-1),inventory:readInventoryEvidence(jobs)}
}
test('genuine current GitBook declaration retains three complete native global roles without inventing India',async()=>{
 assert.equal(sha(fixture),'87461e17c2dd1b236a069f0de4057d37880b887846ee92f69fdc80179ccd9390')
 assert.equal(captured.responses.length,15)
 for(const r of captured.responses){assert.equal(sha(r.body),r.sha256);assert.equal(Buffer.byteLength(r.body),r.bytes)}
 const{jobs,calls,audit,inventory}=await replay();const rows=JSON.parse(captured.responses.find(r=>r.url===ASHBY_JOB_BOARD_URL).body).jobs
 assert.equal(jobs.length,3);assert.equal(calls.length,30);assert.equal(audit.employerScopeStable,true)
 assert.equal(audit.closingInventoryMatches,true);assert.equal(audit.unresolvedAdvertisedRoleIds.length,0)
 assert.equal(audit.employerOpening.declaredProgramProofs.length,10);assert.deepEqual(audit.employerOpening.declaredProgramProofs,audit.employerClosing.declaredProgramProofs)
 for(const[job,i]of jobs.map((j,i)=>[j,i])){assert.deepEqual(job.sourceNativeRecord,rows[i]);assert.equal(job.sourceDescription,rows[i].descriptionHtml);assert.equal(job.sourceNativeDescriptionPlain,rows[i].descriptionPlain);assert.equal(job.sourceDetailComplete,true);assert.equal(job.country,null);assert.equal(job.city,null);assert.equal(job.nativeAddressCountry,'Remote');assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceScopeComplete,false)}
 assert.equal(audit.sourceScopeComplete,false);assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null);assert.equal(inventory.pagesFetched,30)
})
for(const[name,mutate]of[
 ['main program byte change',p=>({...p,html:p.html+'\n/* changed */'})],
 ['unknown program MIME',p=>({...p,contentType:'text/html'})],
 ['foreign program final URL',p=>({...p,url:'https://foreign.example/program.mjs'})],
 ['known program HTTP denial',p=>({...p,status:403})],
 ['unknown program status',p=>({...p,status:undefined})],
])test(name+' rejects current publisher evidence',async()=>{await assert.rejects(replay({mutateProgram:mutate}),/program.*changed/i)})
test('changed closing program bytes cannot publish an opening native model',async()=>{await assert.rejects(replay({mutateProgram:(p,u,n)=>n===2?{...p,html:p.html+'\n;'}:p}),/program.*changed/i)})
for(const[name,mutate]of[
 ['base URI change',h=>h.replace('</head>','<base href="https://foreign.example/">\n</head>')],
 ['executable activation change',h=>h.replace('</body>','<script>window.changed=true</script></body>')],
 ['hidden actual Ashby declarations',h=>h.replaceAll('href="https://jobs.ashbyhq.com/GitBook/','hidden="" href="https://jobs.ashbyhq.com/GitBook/')],
 ['new employer hiring text',h=>h.replace('Open roles','Unreviewed open roles')],
 ['new stylesheet',h=>h.replace('</head>','<style>a{display:none}</style></head>')],
])test(name+' cannot silently enter the finite corporate profile',async()=>{await assert.rejects(replay({mutatePage:(p,u)=>u===CAREERS_PAGE_URL?{...p,html:mutate(p.html)}:p}),/scope changed|binding unavailable|role handoff unavailable/)})
test('closing corporate scope drift remains fatal',async()=>{await assert.rejects(replay({mutatePage:(p,u,n)=>u===CAREERS_PAGE_URL&&n===2?{...p,html:p.html.replace('Open roles','Changed roles')}:p}),/scope changed/)})
test('current feed identity and closing inventory remain strict',async()=>{await assert.rejects(replay({mutateJson:(p,n)=>{if(n===2)p.jobs.pop();return p}}),/closing-inventory-changed/)})
test('current native bootstrap program mutations revoke criteria completeness',async()=>{const{jobs,audit}=await replay({mutatePage:(p,u)=>u.includes('jobs.ashbyhq.com')?{...p,html:p.html.replaceAll('708ebdc6e9d363efd91989d418b22471fc3386cb','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')}:p});assert.equal(jobs.filter(j=>j.sourceDetailComplete).length,0);assert.ok(audit.detailProofs.every(p=>p.reasons.some(r=>/reviewed-bootstrap/.test(r))))})
test('current unknown native criterion is retained and cannot certify completeness',async()=>{const{jobs}=await replay({mutateJson:p=>{p.jobs[0].licenseRequired='actual new requirement';return p}});assert.equal(jobs[0].sourceNativeRecord.licenseRequired,'actual new requirement');assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[1].sourceDetailComplete,true)})
test('an invalid current native calendar date remains raw and cannot certify completeness',async()=>{const{jobs}=await replay({mutateJson:p=>{p.jobs[0].publishedAt='2026-09-31T08:14:40.542+00:00';return p}});assert.equal(jobs[0].sourceNativeRecord.publishedAt,'2026-09-31T08:14:40.542+00:00');assert.equal(jobs[0].postingDate,null);assert.equal(jobs[0].sourceDetailComplete,false)})
test('changing only feed Remote to India cannot manufacture a native India worksite',async()=>{const{jobs}=await replay({mutateJson:p=>{p.jobs[0].address.postalAddress.addressCountry='IN';return p}});assert.equal(jobs[0].country,null)})
test('pre-aborted opaque caller makes zero requests',async()=>{const reason=Symbol('caller'),controller=new AbortController();controller.abort(reason);let calls=0;await assert.rejects(run({signal:controller.signal,fetchPage:async()=>{calls++}}),e=>e===reason);assert.equal(calls,0)})
const wait=ms=>new Promise(r=>setTimeout(r,ms))
const opaqueOutcome=async(controller,options={})=>{const promise=run({signal:controller.signal,...options});const reason=Symbol('opaque caller cancellation');controller.abort(reason);const result=await Promise.race([promise.then(value=>({value}),error=>({error})),wait(150).then(()=>({stalled:true}))]);assert.equal(result.stalled,undefined,'caller cancellation stalled');assert.equal(result.error,reason)}
test('opaque caller abort releases pending default headers and disposes a late response without reading',async()=>{
 const controller=new AbortController();let resolve,cancels=0,reads=0;globalThis.fetch=()=>new Promise(r=>{resolve=r})
 try{await opaqueOutcome(controller);resolve({body:{cancel:async()=>{cancels++},getReader(){reads++;throw Error('late body read')}}});await wait(10);assert.equal(reads,0);assert.equal(cancels,1)}finally{globalThis.fetch=()=>{throw Error('NETWORK TRIPWIRE')}}
})
test('opaque caller abort releases pending default body and never awaits stalled cleanup',async()=>{
 const controller=new AbortController();let reads=0,cancels=0
 globalThis.fetch=async()=>({url:CAREERS_PAGE_URL,status:200,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:()=>{reads++;return new Promise(()=>{})},cancel:()=>{cancels++;return new Promise(()=>{})}})}})
 try{const promise=run({signal:controller.signal});await wait(10);const reason=Symbol('body caller');controller.abort(reason);const result=await Promise.race([promise.then(value=>({value}),error=>({error})),wait(150).then(()=>({stalled:true}))]);assert.equal(result.stalled,undefined,'pending body cancellation stalled');assert.equal(result.error,reason);assert.equal(reads,1);assert.equal(cancels,1)}finally{globalThis.fetch=()=>{throw Error('NETWORK TRIPWIRE')}}
})
for(const stage of['corporate','program'])test('default '+stage+' denial preserves actual403 status without inventing a timeout or zero',async()=>{
 let count=0;globalThis.fetch=async url=>{count++;const r=captured.responses.find(r=>r.url===String(url));assert.ok(r);const denied=stage==='corporate'||String(url)!==CAREERS_PAGE_URL;const response=new Response(denied?'access denied':r.body,{status:denied?403:200,headers:{'content-type':denied?'text/html':r.contentType}});Object.defineProperty(response,'url',{value:String(url)});return response}
 try{await assert.rejects(run(),e=>e.status===403&&e.abortRetries===true);assert.equal(count,stage==='corporate'?1:2)}finally{globalThis.fetch=()=>{throw Error('NETWORK TRIPWIRE')}}
})
test('the first actual default30-response capture reconciles all native models after exact second bootstrap review',async()=>{
 const bytes=readFileSync(new URL('./fixtures/current-http-20261107-default.json.gz',import.meta.url)),dataset=JSON.parse(gunzipSync(bytes));assert.equal(sha(bytes),'7787a42b7048d9aa665355577355bdce4fc4c6bc3a628ad231f8cf97c9f555bd');assert.equal(dataset.responses.length,30);for(const row of dataset.responses){assert.equal(sha(row.body),row.sha256);assert.equal(Buffer.byteLength(row.body),row.bytes)}
 const{jobs,calls,audit}=await replay({dataset});assert.equal(calls.length,30);assert.equal(jobs.length,3);assert.equal(jobs.filter(j=>j.sourceDetailComplete).length,3);assert.ok(jobs.every(j=>j.country===null));assert.ok(audit.detailProofs.every(p=>p.complete&&p.reasons.length===0))
})
for(const[name,mutate]of[
 ['unseen uniform release',s=>s.replaceAll('55438e2281ded5daab32985ec9a911f2f7b6dd30','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')],
 ['mixed reviewed releases',s=>s.replace('55438e2281ded5daab32985ec9a911f2f7b6dd30','708ebdc6e9d363efd91989d418b22471fc3386cb')],
])test('second current bootstrap '+name+' remains unreviewed',async()=>{
 const dataset=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-http-20261107-default.json.gz',import.meta.url))))
 const{jobs,audit}=await replay({dataset,mutatePage:(p,u)=>{if(!u.includes('jobs.ashbyhq.com'))return p;const s=readNativeDocument(p.html).nodes(n=>n.tag==='script'&&!n.attrs.src&&/window\.__appData\s*=/.test(n.raw||''))[0];const statement=parse(s.raw,{ecmaVersion:'latest'}).body[0];return{...p,html:p.html.replace(s.raw,s.raw.slice(0,statement.end)+mutate(s.raw.slice(statement.end)))}}});assert.equal(jobs.filter(j=>j.sourceDetailComplete).length,1);assert.ok(audit.detailProofs.slice(0,2).every(p=>p.reasons.some(r=>/reviewed-bootstrap/.test(r))))
})
test('caller abort after resolved headers still cancels the unread response body',async()=>{
 const controller=new AbortController(),reason=Symbol('between header and continuation');let cancels=0,reads=0
 globalThis.fetch=()=>Promise.resolve({status:200,url:CAREERS_PAGE_URL,headers:new Headers({'content-type':'text/html'}),body:{cancel:async()=>{cancels++},getReader(){reads++;throw Error('must not read aborted body')}}})
 try{const promise=run({signal:controller.signal});queueMicrotask(()=>controller.abort(reason));await assert.rejects(promise,e=>e===reason);assert.equal(reads,0);assert.equal(cancels,1)}finally{globalThis.fetch=()=>{throw Error('NETWORK TRIPWIRE')}}
})
test('current source retains three bounded vacancy observations and full native proof on its returned array',async()=>{
 const{jobs,audit}=await replay();const{readSourceObservationEvidence}=await import('../../scraper-support/utils/sourceObservationEvidence.js')
 const observations=readSourceObservationEvidence(jobs,'gitbook');assert.deepEqual(observations,{source:'gitbook',recordKind:'vacancy-rows',observedRecordCount:3,observedVacancyCount:3,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null});assert.equal(Object.isFrozen(observations),true)
 assert.equal(jobs.nativeCollectionEvidence,audit);assert.equal(jobs.sourceAudit,audit);assert.equal(jobs.nativeCollectionEvidence.detailProofs.length,3)
 assert.deepEqual(jobs.nativeCollectionEvidence.nativeRawOpening,jobs.nativeCollectionEvidence.nativeRawClosing)
 for(const proof of jobs.nativeCollectionEvidence.detailProofs){assert.equal(proof.complete,true);assert.ok(proof.nativeAppData.posting.descriptionHtml);assert.equal(proof.nativeJobPosting.description,proof.nativeAppData.posting.descriptionHtml);assert.equal(proof.country,null)}
})
test('existing registry decoration preserves current bounded observations and rich source native audit',async()=>{
 const{decorateJobsWithProviderMetadata,getScraperCatalog}=await import('../../scraper-support/providers/index.js'),{readSourceObservationEvidence}=await import('../../scraper-support/utils/sourceObservationEvidence.js')
 const{jobs,audit}=await replay();const provider=getScraperCatalog().find(p=>p.source==='gitbook'),decorated=decorateJobsWithProviderMetadata(jobs,provider)
 assert.equal(decorated.length,3);assert.deepEqual(readSourceObservationEvidence(decorated,'gitbook'),readSourceObservationEvidence(jobs,'gitbook'));assert.equal(decorated.nativeCollectionEvidence,audit);assert.equal(decorated.nativeCollectionEvidence.nativeRawOpening.jobs.length,3);assert.equal(decorated.nativeCollectionEvidence.detailProofs.filter(p=>p.complete).length,3);assert.ok(decorated.every(j=>j.country===null))
})
