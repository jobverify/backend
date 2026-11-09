import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from '../scraper/cyraac/script.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/cyraac-native-quality.json.gz',import.meta.url))))
const home='https://cyraacs.com/careers/',target=fixture.packets[1].requestedURL,id=target.split('/').filter(Boolean).at(-1)
const reviewCard=JSON.parse(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/cyraac-review-card.json',import.meta.url)))
const sha=value=>createHash('sha256').update(value).digest('hex'),now=()=> '2026-11-05T10:00:00.000Z'
const schema=(overrides={})=>({'@context':'https://schema.org','@type':'JobPosting',title:'GRC Lead – Professional Services',url:target,
 hiringOrganization:{'@type':'Organization',name:'CYRAAC Services Private Limited'},
 jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:'Bengaluru',addressCountry:'IN'}},...overrides})
const addSchema=(p,s)=>{p.bodyText=p.bodyText.replace('</head>','<script type="application/ld+json">'+JSON.stringify(s)+'</script></head>')}
const replay=async(t,edit=()=>{},options={})=>{
 const calls=[],fetchImpl=async(url,init={})=>{
  const original=fixture.packets.find(p=>p.requestedURL===String(url));assert.ok(original,'Uncaptured CYRAACS URL: '+url)
  assert.equal(sha(original.bodyText),original.bodySHA256)
  const p=structuredClone(original),occurrence=calls.filter(c=>c.url===String(url)).length
  edit(p,occurrence,calls)
  if(p.bodyText!==original.bodyText&&!p.headers['content-encoding']&&p.headers['content-length'])p.headers['content-length']=String(Buffer.byteLength(p.bodyText))
  calls.push({url:String(url),status:p.status,occurrence});assert.equal(init.method||'GET','GET')
  const r=new Response(p.bodyText,{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 let jobs,error;try{jobs=await source.run({fetchImpl,minIntervalMs:0,now,...options})}catch(e){error=e}
 return {jobs,error,calls}
}
test('CYRAACS retains all14 original own roles without fabricated India, city, requisition or completeness',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error);assert.equal(jobs.length,14);assert.equal(calls.length,30)
 assert.ok(jobs.every(j=>j.country===null&&j.city===null&&j.state===null&&j.location===null&&j.requisitionId===null&&j.postingDate===null))
 for(const job of jobs){const p=fixture.packets.find(p=>p.requestedURL===job.sourceUrl)
  assert.equal(job.sourceRawNativeHTML,p.bodyText);assert.equal(job.sourceRawNativeHTMLSHA256,p.bodySHA256)
  assert.equal(job.sourceCountryScopeUnresolved,true);assert.equal(job.sourceDetailComplete,false)
  assert.equal(job.sourceDetailFailureKind,'native-country-unproven');assert.equal(job.nativeRoleClosingReconciled,true)
  assert.equal(job.sourceListingComplete,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.applicationVisited,false);assert.equal(job.firstEverPublication,null);assert.ok(job.nativeSourceRecord)
 }
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('CYRAACS maps only its own explicit JobPosting country, identifier and publication while criteria remain partial',async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===target)addSchema(p,schema({identifier:{'@type':'PropertyValue',value:'CYR-42'},datePosted:'2026-11-01'}))})
 assert.ifError(error);const j=jobs.find(j=>j.jobId===id)
 assert.equal(j.country,'India');assert.equal(j.city,'Bengaluru');assert.equal(j.requisitionId,'CYR-42');assert.equal(j.postingDate,'2026-11-01')
 assert.equal(j.sourceDetailComplete,false);assert.equal(j.sourceDetailFailureKind,'native-criteria-container-unverified')
 assert.equal(j.nativeSourceRecord.jobPostings[0].jobLocation.address.addressCountry,'IN')
})
test('CYRAACS cannot mistake a city named India for a native country',async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===target)addSchema(p,schema({jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:'India',addressCountry:'US'}}}))})
 assert.ifError(error);assert.equal(jobs.find(j=>j.jobId===id).country,'United States')
})
test('CYRAACS cannot borrow a company footer country or an unrelated job country',async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===target){addSchema(p,schema({title:'Other role',url:'https://cyraacs.com/other-role/'}));p.bodyText=p.bodyText.replace('</body>','<footer>Office: Bengaluru, India</footer></body>')}})
 assert.ifError(error);assert.equal(jobs.find(j=>j.jobId===id).country,null)
})
test('CYRAACS holds a role whose own native publisher contradicts the source employer',async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===target)addSchema(p,schema({hiringOrganization:{'@type':'Organization',name:'Other employer'}}))})
 assert.ifError(error);assert.equal(jobs.length,13);assert.ok(jobs.every(j=>j.jobId!==id))
})
test('CYRAACS keeps an unknown secondary workplace unresolved',async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===target)addSchema(p,schema({jobLocation:[schema().jobLocation,{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:'Other city'}}]}))})
 assert.ifError(error);const j=jobs.find(j=>j.jobId===id);assert.equal(j.country,null);assert.equal(j.city,null);assert.equal(j.sourceCountryScopeUnresolved,true)
})
test('CYRAACS rejects ambiguous own JobPosting countries',async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===target){addSchema(p,schema());addSchema(p,schema({jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'US'}}}))}})
 assert.ifError(error);assert.ok(jobs.every(j=>j.jobId!==id))
})
test('CYRAACS zero cap and pre-abort perform no public requests',async t=>{
 let r=await replay(t,()=>{},{maxJobs:0});assert.ifError(r.error);assert.equal(r.jobs.length,0);assert.equal(r.calls.length,0)
 const reason=Error('Stop before CYRAACS');r=await replay(t,()=>{},{signal:AbortSignal.abort(reason)});assert.equal(r.error,reason);assert.equal(r.calls.length,0)
})
test('CYRAACS positive cap follows the complete paired observations',async t=>{
 const {jobs,error,calls}=await replay(t,()=>{},{maxJobs:1});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(calls.length,30)
})
for(const status of [202,401,403,429,451])test('CYRAACS stops after opening HTTP '+status+' and retains earlier partial facts',async t=>{
 const second=fixture.packets[2].requestedURL
 const {jobs,error,calls}=await replay(t,p=>{if(p.requestedURL===second)p.status=status})
 assert.ifError(error);assert.equal(jobs.length,1);assert.equal(jobs[0].sourceUrl,target);assert.equal(jobs[0].nativeRoleClosingReconciled,false)
 assert.equal(calls.at(-1).status,status);assert.equal(calls.length,3)
})
test('CYRAACS excludes a known changed closing model before a later denial',async t=>{
 const {jobs,error,calls}=await replay(t,(p,occurrence)=>{
  if(occurrence&&p.requestedURL===target)p.bodyText=p.bodyText.replace('</body>','<p>Observed new mandatory certification</p></body>')
  if(occurrence&&p.requestedURL===fixture.packets[2].requestedURL)p.status=403
 })
 assert.ifError(error);assert.equal(jobs.length,13);assert.ok(jobs.every(j=>j.jobId!==id&&!j.nativeRoleClosingReconciled&&!j.sourceDetailComplete));assert.equal(calls.at(-1).status,403)
})
test('CYRAACS removes roles whose closing listing changed',async t=>{
 const {jobs,error}=await replay(t,(p,occurrence)=>{if(occurrence&&p.requestedURL===home)p.bodyText=p.bodyText.replaceAll('GRC Lead – Professional Services','Changed native title')})
 assert.ifError(error);assert.equal(jobs.length,13);assert.ok(jobs.every(j=>j.jobId!==id))
})
test('CYRAACS preserves exact cancellation with a noncooperative transport',async()=>{
 const controller=new AbortController(),reason=Error('Cancel pending CYRAACS transport')
 const pending=source.run({fetchImpl:()=>new Promise(()=>{}),minIntervalMs:0,signal:controller.signal});controller.abort(reason)
 await assert.rejects(pending,error=>error===reason)
})
test('CYRAACS cancellation does not wait on stalled stream cleanup',async()=>{
 const controller=new AbortController(),reason=Error('Cancel stalled CYRAACS cleanup');let release,cancelled=0
 const response=new Response(new ReadableStream({cancel(){cancelled++;return new Promise(resolve=>{release=resolve})}}),{headers:{'content-type':'text/html'}})
 Object.defineProperty(response,'url',{value:home})
 const pending=source.run({fetchImpl:async()=>response,minIntervalMs:0,signal:controller.signal})
 await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
 const result=await Promise.race([pending.then(value=>({value}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),250))])
 release?.();await pending.catch(()=>{});assert.equal(result.error,reason);assert.equal(cancelled,1)
})
test('CYRAACS rejects a false uncompressed Content-Length before using the page',async t=>{
 const {jobs,error,calls}=await replay(t,p=>{p.headers['content-length']='1';delete p.headers['content-encoding']})
 assert.equal(jobs,undefined);assert.match(error.message,/length mismatch/);assert.equal(calls.length,1)
})
for(const keepURL of [false,true])test('CYRAACS cannot project a country from a contradictory schema @id; url present='+keepURL,async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===target){const s=schema({'@id':'https://cyraacs.com/another-opening/#job'});if(!keepURL)delete s.url;addSchema(p,s)}})
 assert.ifError(error);assert.equal(jobs.find(j=>j.jobId===id).country,null)
})
for(const value of [{'@type':'City',name:'India'},{'@type':'Country',name:'India',identifier:'US'}])test('CYRAACS holds an incompatible or contradictory country object '+JSON.stringify(value),async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===target){const s=schema();s.jobLocation.address.addressCountry=value;addSchema(p,s)}})
 assert.ifError(error);assert.equal(jobs.find(j=>j.jobId===id).country,null)
})
test('CYRAACS hidden duplicate links cannot overwrite visible title or experience',async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===home)p.bodyText=p.bodyText.replace('</body>','<section hidden><h3>'+reviewCard.title+'</h3><p>Experience: 99 hidden years Location: Secret</p><a href="'+target+'">VIEW JOB DETAIL</a></section></body>')})
 assert.ifError(error);const j=jobs.find(j=>j.jobId===id);assert.equal(j.title,reviewCard.title);assert.notEqual(j.experienceRequired,'99 hidden years')
})
test('CYRAACS conflicting closing duplicates cannot collapse into an unchanged last card',async t=>{
 assert.equal(reviewCard.indexSHA256,fixture.packets[0].bodySHA256);assert.ok(fixture.packets[0].bodyText.includes(reviewCard.rawHTML));assert.equal(sha(reviewCard.rawHTML),reviewCard.rawCardSHA256)
 const {jobs,error}=await replay(t,(p,occurrence)=>{if(occurrence&&p.requestedURL===home){const changed=reviewCard.rawHTML.replaceAll(reviewCard.title,'Changed role title');p.bodyText=p.bodyText.replace('</body>','<h2>'+reviewCard.department+'</h2>'+changed+reviewCard.rawHTML+'</body>')}})
 assert.ifError(error);assert.equal(jobs.length,13);assert.ok(jobs.every(j=>j.jobId!==id))
})
test('CYRAACS retains original opening and changed closing evidence when a role is evicted',async t=>{
 const {jobs,error}=await replay(t,(p,occurrence)=>{
  if(occurrence&&p.requestedURL===target)p.bodyText=p.bodyText.replace('</body>','<p>Known changed criteria</p></body>')
  if(occurrence&&p.requestedURL===fixture.packets[2].requestedURL)p.status=403
 })
 assert.ifError(error);const held=jobs[0].sourceNativeCollectionAudit.heldNativeRows.find(r=>r.id===id)
 assert.equal(held.opening.rawHTML,fixture.packets[1].bodyText);assert.equal(held.opening.bodySHA256,fixture.packets[1].bodySHA256)
 assert.match(held.closing.rawHTML,/Known changed criteria/);assert.equal(held.closing.bodySHA256,sha(held.closing.rawHTML))
})
test('CYRAACS treats case-insensitive identity encoding as uncompressed for byte-length checks',async t=>{
 const {jobs,error,calls}=await replay(t,p=>{p.headers['content-length']='1';p.headers['content-encoding']='Identity'})
 assert.equal(jobs,undefined);assert.match(error.message,/length mismatch/);assert.equal(calls.length,1)
})

test('CYRAACS treats a partially matching contradictory identity as own-role ambiguity',async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===target){
  addSchema(p,schema())
  addSchema(p,schema({'@id':'https://cyraacs.com/another-opening/#job',jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'US'}}}))
 }})
 assert.ifError(error);assert.ok(!jobs.some(j=>j.jobId===id),'A conflicting own identity must not allow the other schema to certify India')
 const held=jobs[0].sourceNativeCollectionAudit.heldNativeRows.find(r=>r.id===id)
 assert.match(held.reason,/ambiguous own native JobPosting/);assert.match(held.opening.rawHTML,/another-opening/)
})

test('CYRAACS retains stable closing role bytes when the closing index evicts that role',async t=>{
 const {jobs,error}=await replay(t,(p,occurrence)=>{
  if(occurrence&&p.requestedURL===target)p.bodyText=p.bodyText.replace('</body>','<!-- retained-closing-role-observation --></body>')
  if(occurrence&&p.requestedURL===home)p.bodyText=p.bodyText.replaceAll(reviewCard.title,'Changed native title')
 })
 assert.ifError(error);assert.ok(!jobs.some(j=>j.jobId===id))
 const held=jobs[0].sourceNativeCollectionAudit.heldNativeRows.find(r=>r.id===id)
 assert.ok(held.closing,'Closing role evidence must survive index eviction')
 assert.match(held.closing.rawHTML,/retained-closing-role-observation/);assert.equal(held.closing.bodySHA256,sha(held.closing.rawHTML))
 assert.ok(held.closing.nativeRecord);assert.deepEqual(held.closing.nativeRecord,held.opening.nativeRecord)
})
