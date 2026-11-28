import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-publisher-20261128.json.gz',import.meta.url))))
const home='https://joinditto.in/',careers='https://careers.joinditto.in/',role=careers+'jobs/backend-developer-python-django-ftzrjl',remote=careers+'jobs/insurance-advisory-j7nclt'
const plain=p=>Buffer.from(p.bodyBase64,'base64').toString()
function replay(edit=(_url,body)=>body){const counts=new Map(),reads=[];return{reads,options:{fetchPage:async(url,{signal}={})=>{signal?.throwIfAborted();reads.push(url);const index=counts.get(url)||0;counts.set(url,index+1);const p=fixture.responses.filter(r=>r.requestedUrl===url)[index];assert.ok(p,'Only genuine separate response '+url+' #'+index);return{status:p.status,url:p.url,html:edit(url,plain(p),index)}}}}}
const mutateModel=(body,edit)=>body.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(_all,start,raw,end)=>{const model=JSON.parse(raw);edit(model);return start+JSON.stringify(model)+end})

test('genuine current Ditto fixture preserves 31 independently captured opening and closing responses',()=>{
 assert.equal(fixture.synthetic,false);assert.equal(fixture.responses.length,31)
 for(const p of fixture.responses){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(p.status,200);assert.equal(b.length,p.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),p.sha256)}
 assert.equal(fixture.responses.filter(p=>p.requestedUrl===role).length,2)
})

test('registered current first-party Ditto publisher retains all 11 native India criteria records with explicit detail and cleanup holds',async()=>{
 const io=replay(),jobs=await run(io.options),backend=jobs.find(j=>j.jobId==='backend-developer-python-django-ftzrjl'),advisor=jobs.find(j=>j.jobId==='insurance-advisory-j7nclt')
 assert.equal(jobs.length,11);assert.ok(backend);assert.ok(advisor);assert.match(backend.jobDescription,/Django REST Framework/);assert.match(advisor.jobDescription,/Fluent spoken and written English/)
 assert.equal(backend.country,'India');assert.equal(backend.city,'Bengaluru');assert.equal(backend.postingDate,'2026-11-24')
 assert.equal(advisor.country,'India');assert.equal(advisor.remoteStatus,'Remote');assert.equal(advisor.city,null)
 for(const job of jobs){assert.equal(job.sourceDetailComplete,false);assert.equal(job.nativeCriteriaTextComplete,true);assert.equal(job.sourceRenderedCriteriaComplete,false);assert.equal(job.sourceApplicationQualificationComplete,false);assert.equal(job.sourceScopeComplete,false)}
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readSourceObservationEvidence(jobs,'dittoinsurance').observedRecordCount,11)
 assert.equal(io.reads.length,31);assert.equal(io.reads.some(url=>url.includes('zappyhire')),false)
 assert.equal(jobs.nativeCollectionEvidence.roleObservations.length,22);assert.equal(jobs.nativeCollectionEvidence.opening.rows.length,11)
 assert.deepEqual(jobs.nativeCollectionEvidence.opening.rows,jobs.nativeCollectionEvidence.closing.rows)
 assert.ok(jobs.nativeCollectionEvidence.roleObservations.every(row=>row.originalText&&row.model))
})

for(const [name,mutate,pattern]of[
 ['a missing current corporate handoff',(url,body)=>url===home?body.replaceAll('https://careers.joinditto.in/','https://foreign.invalid/') :body,/handoff/],
 ['an ambiguous retired corporate handoff',(url,body)=>url===home?body.replace('</body>','<a href="https://ditto.zappyhire.com/">Careers</a></body>'):body,/handoff/],
 ['a foreign legal employer',(url,body)=>url===careers?mutateModel(body,m=>{m.legalName='Other Employer Private Limited'}):body,/employer/],
 ['a changed employer license',(url,body)=>url===careers?mutateModel(body,m=>{m.identifier.value='CA9999'}):body,/employer/],
 ['unreviewed active client bytes',(url,body)=>url.endsWith('careers.js')?body+';globalThis.changed=true;':body,/client/],
 ['unreviewed stylesheet bytes',(url,body)=>url.endsWith('careers.css')?body+' .job-description{display:none}':body,/stylesheet/],
 ['an additional executable',(url,body)=>url===careers?body.replace('</head>','<script>document.body.remove()</script></head>'):body,/executable/],
 ['an additional executable handler',(url,body)=>url===careers?body.replace('<body>','<body onload="location.href=\'https://foreign.invalid/\'">'):body,/executable/],
 ['a truncated declared inventory',(url,body)=>url===careers?body.replace('<span class="count">11</span>','<span class="count">12</span>'):body,/inventory/],
 ['a selected non-global filter',(url,body)=>url===careers?body.replace('value="Tech" >','value="Tech" selected>'):body,/filter/],
 ['a foreign role link',(url,body)=>url===careers?body.replace(role,'https://foreign.invalid/jobs/backend-developer-python-django-ftzrjl'):body,/role|inventory/],
 ['changed closing inventory',(url,body,index)=>url===careers&&index>0?body.replace('seo-executive-gf3zgw','seo-executive-xxxxxx'):body,/closing|inventory/],
])test('current publisher rejects '+name,async()=>{
 let changed=false;const io=replay((url,body,index)=>{const next=mutate(url,body,index);changed||=next!==body;return next});await assert.rejects(run(io.options),pattern);assert.equal(changed,true)
})

for(const[name,target,change]of[
 ['a foreign role employer',role,b=>mutateModel(b,m=>{m.hiringOrganization.name='Other Employer'})],
 ['a foreign onsite role country',role,b=>mutateModel(b,m=>{m.jobLocation[0].address.addressCountry='US'})],
 ['a contradictory extra country',role,b=>mutateModel(b,m=>{m.applicantLocationRequirements={'@type':'Country',name:'United States'}})],
 ['a remote role without vacancy country',remote,b=>mutateModel(b,m=>{delete m.applicantLocationRequirements})],
 ['a foreign remote role country',remote,b=>mutateModel(b,m=>{m.applicantLocationRequirements.name='United States'})],
 ['a different native posting ID',role,b=>mutateModel(b,m=>{m.identifier.value='other-xxxxxx'})],
 ['additional model-only criteria',role,b=>mutateModel(b,m=>{m.description+='<p>Additional qualification.</p>'})],
 ['hidden original criteria',role,b=>b.replace('class="rich-text job-description"','class="rich-text job-description" hidden')],
 ['an invalid calendar publication date',role,b=>mutateModel(b,m=>{m.datePosted='2026-02-30'})],
 ['a foreign application target',role,b=>b.replaceAll(role+'/apply','https://foreign.invalid/apply')],
])test('current publisher holds '+name+' while retaining its full original native observations',async()=>{
 let changed=false;const io=replay((url,body)=>{if(url!==target)return body;changed=true;return change(body)}),jobs=await run(io.options),id=target.split('/').at(-1)
 assert.equal(changed,true);assert.equal(jobs.length,10);assert.equal(jobs.some(job=>job.jobId===id),false)
 const audit=jobs.nativeCollectionEvidence;assert.equal(audit.roleObservations.filter(row=>row.url===target&&row.originalText).length,2);assert.ok(audit.roleObservations.filter(row=>row.url===target).every(row=>row.model),'Rejected full original model remains in audit');assert.ok(audit.failures.some(row=>row.id===id));assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('changed closing complete native criteria are held even when listing IDs remain stable',async()=>{
 let changed=false;const io=replay((url,body,index)=>{if(url!==role||index!==1)return body;changed=true;const before='Django REST Framework (DRF)',after='Django REST Framework (DRF) and new mandatory skill',model=mutateModel(body,m=>{m.description=m.description.replace(before,after)}),at=model.indexOf('</script>')+9;return model.slice(0,at)+model.slice(at).replace(before,after)}),jobs=await run(io.options)
 assert.equal(changed,true);assert.equal(jobs.length,10);assert.equal(jobs.some(job=>job.jobId==='backend-developer-python-django-ftzrjl'),false);assert.ok(jobs.nativeCollectionEvidence.failures.some(row=>/closing/.test(row.reason)));assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('current publisher caps returned records without shortening native opening and closing evidence',async()=>{
 const io=replay(),jobs=await run({...io.options,maxJobs:2});assert.equal(jobs.length,2);assert.equal(io.reads.length,31);assert.equal(jobs.nativeCollectionEvidence.roleObservations.length,22);assert.equal(jobs.nativeCollectionEvidence.limited,true);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('current caller cancellation remains exact and prompt when an injected role read ignores abort',async()=>{
 const reason={opaque:'caller stop'},controller=new AbortController(),io=replay();let settle
 const fetchPage=async(url,options)=>{if(url===role)return new Promise(resolve=>{settle=()=>resolve({status:200,url,html:plain(fixture.responses.find(row=>row.requestedUrl===url))});controller.abort(reason)});return io.options.fetchPage(url,options)}
 const before=performance.now();try{await assert.rejects(run({fetchPage,signal:controller.signal}),error=>error===reason);assert.ok(performance.now()-before<1000)}finally{settle?.()}
})

test('caller cancellation remains prompt before the current publisher is detected in an opaque homepage read',async()=>{
 const reason={opaque:'homepage caller stop'},controller=new AbortController(),io=replay();let settle,timer
 const fetchPage=async(url,options)=>url===home?new Promise(resolve=>{settle=()=>resolve({status:200,url,html:plain(fixture.responses.find(row=>row.requestedUrl===home))});controller.abort(reason)}):io.options.fetchPage(url,options)
 try{const observed=await Promise.race([run({fetchPage,signal:controller.signal}).then(()=>({unexpected:'resolved'}),error=>error),new Promise(resolve=>{timer=setTimeout(()=>resolve({unexpected:'deadline'}),250)})]);assert.equal(observed,reason)}finally{clearTimeout(timer);settle?.()}
})

test('the default homepage read has a finite streaming byte bound and cancels overflow',async()=>{
 const prior=globalThis.fetch;let reads=0,canceled=0
 globalThis.fetch=async()=>({ok:true,status:200,url:home,headers:new Headers(),body:{getReader:()=>({read:async()=>{reads++;return{done:false,value:new Uint8Array(17*1024*1024)}},cancel:async()=>{canceled++},releaseLock(){}})},text:async()=>'<p>unbounded legacy seam</p>'})
 try{await assert.rejects(run(),/large|byte|oversized/);assert.equal(reads,1);assert.equal(canceled,1)}finally{globalThis.fetch=prior}
})

test('a matching corporate address cannot qualify an extra contradictory vacancy-country field',async()=>{
 let changed=0;const io=replay((url,body)=>{
  if(url===home)return mutateModel(body,model=>{model['@graph'].find(row=>row['@id']===home+'#organization').address.additionalCountry='United States';changed++})
  if(url===careers)return mutateModel(body,model=>{model.address.additionalCountry='United States';changed++})
  if(url===role)return mutateModel(body,model=>{model.jobLocation[0].address.additionalCountry='United States';changed++})
  return body
 }),jobs=await run(io.options)
 assert.equal(changed,7);assert.equal(jobs.some(job=>job.jobId==='backend-developer-python-django-ftzrjl'),false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
