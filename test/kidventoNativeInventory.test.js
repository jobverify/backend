import assert from 'node:assert/strict'
import test from 'node:test'
import {run} from '../scraper/kidvento/script.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {kidventoFixtureTransport as transport} from './helpers/kidventoFixture.js'
const official='https://www.kidvento.com/careers',root='https://kidvento.keka.com/careers/',identifier='79e3ba6e-9a27-4031-8af7-4c7bca97a921',board=root+'api/jobs/default/active',embed=root+'api/embedjobs/default/active/'+identifier
const bridge='https://www.gstatic.com/atari/embeds/9581c1cb067d2cf0b0db63dc0d8422ac/intermediate-frame-minified.html'
const unknown=['157754','146602','135145','113803','98442','13630']
async function execute(change,options={}){const t=transport(change),prior=globalThis.fetch;globalThis.fetch=t.fetchImpl;try{return {jobs:await run({fetchImpl:t.fetchImpl,...options}),calls:t.calls}}finally{globalThis.fetch=prior}}
function roleMutation(row,change){if(row.url===board||row.url===embed){const raw=JSON.parse(row.body);change(raw.find(r=>r.id===167753),raw);row.body=JSON.stringify(raw)}}
test('Kidvento recovers actual GoogleSites-bound roles without country defaults or fabricated missing location IDs',async()=>{
 const {jobs,calls}=await execute();assert.equal(jobs.length,29);assert.ok(jobs.every(j=>j.country==='India'));assert.equal(jobs.filter(j=>j.sourceDetailComplete).length,17);assert.equal(jobs.filter(j=>j.sourceNativeCriteriaComplete).length,29)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.equal(jobs.sourceAudit.nativeTotal,35);assert.deepEqual(jobs.sourceAudit.unresolvedCountryIds,unknown);assert.equal(jobs.sourceAudit.sourceNativeRaw.length,35)
 assert.ok(jobs.every(j=>j.lifecycleCleanupAllowed===false));assert.equal(jobs.sourceAudit.allNativeDetailProofs.length,35)
 for(const id of [43820,35493]){const job=jobs.find(j=>j.jobId===String(id));assert.ok(job?.sourceNativeCriteriaComplete);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceAssignedLocationsUnresolved,true);assert.equal(Object.hasOwn(job.sourceNativePayload.jobLocations[0],'id'),false);assert.equal(job.sourceNativePayload.jobLocations[0].countryName,'India')}
 assert.ok(calls.includes(bridge));assert.ok(calls.some(u=>u.endsWith('/m=N0NZx')));assert.equal(calls.filter(u=>u===board).length,2);assert.equal(calls.filter(u=>u.includes('/jobdetails/')).length,70)
})
for(const mode of ['wrong URL','hidden embed','wrong bridge','wrong controller'])test('publisher ownership rejects '+mode,async()=>{
 await assert.rejects(execute(row=>{if(row.url!==official)return;if(mode==='wrong URL')row.body=row.body.replaceAll('https://kidvento.keka.com/careers','https://other.keka.com/careers');if(mode==='hidden embed')row.body=row.body.replace('jsname="jkaScf" data-url=','hidden jsname="jkaScf" data-url=');if(mode==='wrong bridge')row.body=row.body.replaceAll(bridge,'https://other.example/frame');if(mode==='wrong controller')row.body=row.body.replace('jscontroller="N0NZx"','jscontroller="Other"')}),/publisher|embed|bridge|controller/i)
})
test('changed Google bridge program cannot bind native ownership',async()=>{await assert.rejects(execute(row=>{if(row.url===bridge)row.body=row.body.replace('iframe.src = url','iframe.src = "https://other.keka.com/careers"')}),/bridge|publisher/i)})
for(const addition of ['<a href="https://boards.greenhouse.io/other"></a>','<iframe src="https://other.example/jobs"></iframe>','<form action="https://other.example/apply"></form>','<script src="https://other.example/jobs.js"></script>','<style>.new-job-channel{color:red}</style>'])test('new first-party hiring surface or CSS stays unresolved: '+addition,async()=>{
 const {jobs}=await execute(row=>{if(row.url===official)row.body+=addition});assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.ok(jobs.sourceAudit.sourceScopeGaps.length>0)
})
test('CSS that hides the only current publisher embed cannot establish its ownership chain',async()=>{await assert.rejects(execute(row=>{if(row.url===official)row.body+='<style>.w536ob{opacity:0}</style>'}),/publisher|visible|embed/i)})
for(const mode of ['hidden mandatory subtree','empty description','unknown mandatory metadata','CSS opacity','closing description drift'])test('affected native criteria remains incomplete for '+mode,async()=>{
 const {jobs}=await execute((row,n)=>{
  if(mode==='unknown mandatory metadata')roleMutation(row,r=>{r.requiredEligibility={citizenship:'India'}})
  else if(mode==='empty description')roleMutation(row,r=>{r.description='<p><br></p>'})
  else if(row.url===root+'jobdetails/167753'){
   if(mode==='hidden mandatory subtree')row.body=row.body.replace('job-description-container ','job-description-container ').replace('</body>','<div class="job-description-container" style="opacity:0">Additional mandatory criteria</div></body>')
   if(mode==='CSS opacity')row.body+='<style>.job-description-container{opacity:0}</style>'
   if(mode==='closing description drift'&&n===2)row.body=row.body.replace('Key Responsibilities','New required certification')
  }
 });const job=jobs.find(j=>j.jobId==='167753');assert.ok(job);assert.equal(job.sourceDetailComplete,false);assert.ok(job.sourceNativePayload);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('optional missing-ID roles keep every supplied foreign/unknown alternative unresolved',async()=>{
 const {jobs}=await execute(row=>roleMutation(row,(_,raw)=>{const r=raw.find(r=>r.id===43820);r.jobLocations.push({city:'Boston',name:'Boston',state:'MA',countryCode:'US',countryName:'United States'})}))
 assert.equal(jobs.some(j=>j.jobId==='43820'&&j.sourceDetailComplete),false);assert.ok(jobs.sourceAudit.sourceNativeRaw.find(r=>r.id===43820).jobLocations.some(l=>l.countryCode==='US'))
})
for(const mode of ['failed envelope','duplicate identities','closing location drift','group scope'])test('native accounting rejects or retains gaps for '+mode,async()=>{
 const change=(row,n)=>{if(mode==='failed envelope'&&(row.url===board||row.url===embed))row.body=JSON.stringify({error:'unavailable',jobs:[]});if(mode==='duplicate identities')roleMutation(row,(_,raw)=>raw.push(raw[0]));if(mode==='closing location drift'&&n===2)roleMutation(row,r=>{r.jobLocations[0].countryCode='US';r.jobLocations[0].countryName='United States'});if(mode==='group scope'&&row.url.includes('/grouplinkstatus'))row.body='{"isGroupLinked":true}'}
 if(['failed envelope','duplicate identities'].includes(mode))await assert.rejects(execute(change),/inventory|identity|duplicate|envelope/i)
 else{const {jobs}=await execute(change);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.ok(jobs.sourceAudit.sourceScopeGaps.length>0)}
})
test('current transport requires metadata, respects cancellation and refuses caps',async()=>{
 await assert.rejects(run({fetchPage:async()=>({html:'body only'})}),/metadata|transport/i);await assert.rejects(execute(undefined,{maxJobs:5}),/caps/i)
 const c=new AbortController();c.abort(new Error('fixture abort'));await assert.rejects(run({signal:c.signal,fetchImpl:async()=>assert.fail('fetch after abort')}),/fixture abort/)
 await assert.rejects(execute(row=>{if(row.url===board)row.responseUrl='https://other.keka.com/careers/api/jobs/default/active'}),/HTTP|response|identity/i)
})
test('actual JD Bangalore assignment versus structured Coimbatore retains its unresolved geography',async()=>{
 const {jobs}=await execute(),job=jobs.find(j=>j.jobId==='152838');assert.ok(job);assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,false);assert.ok(job.sourceAssignedLocationStatements.some(r=>r.value==='Bangalore'&&r.unresolved));assert.ok(job.sourceNativePayload.description.includes('Bangalore'))
})
test('an additional assigned UAE worksite never collapses into the structured India primary',async()=>{
 const {jobs}=await execute(row=>roleMutation(row,r=>{r.description+='<p>Additional work location: Dubai, UAE</p>'}));const job=jobs.find(j=>j.jobId==='167753');assert.ok(job);assert.ok(job.sourceAssignedLocationStatements.some(r=>r.value==='Dubai, UAE'&&r.unresolved));assert.equal(job.sourceDetailComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
})
for(const field of ['jobType','publishedOn','departmentIdentifier','departmentName','salaryRange','salaryRangeFormat','publishedSinceDays','skillNames','excerpt','jobNumber'])test('missing mandatory native field remains a role-specific schema gap: '+field,async()=>{
 const {jobs}=await execute(row=>roleMutation(row,r=>{delete r[field]})),job=jobs.find(j=>j.jobId==='167753');assert.ok(job);assert.equal(job.sourceDetailComplete,false);assert.ok(job.sourceNativeSchemaGaps.some(g=>g.startsWith(field)));assert.equal(Object.hasOwn(job.sourceNativePayload,field),false)
})
for(const field of ['currency','salaryPeriod','cultureInfo','minimum'])test('missing mandatory salary structure cannot retain complete criteria: '+field,async()=>{
 const {jobs}=await execute(row=>roleMutation(row,r=>{delete r.salaryRange[field]})),job=jobs.find(j=>j.jobId==='167753');assert.ok(job);assert.equal(job.sourceDetailComplete,false);assert.ok(job.sourceNativeSchemaGaps.some(g=>g.startsWith('salaryRange.')))
})
test('missing entire geography is retained unresolved rather than vacuously assigned India',async()=>{
 const {jobs}=await execute(row=>roleMutation(row,r=>{delete r.jobLocations}));assert.equal(jobs.some(j=>j.jobId==='167753'),false);assert.ok(jobs.sourceAudit.unresolvedCountryIds.includes('167753'));assert.equal(Object.hasOwn(jobs.sourceAudit.sourceNativeRaw.find(r=>r.id===167753),'jobLocations'),false)
})
test('null mandatory fields and nested malformed types revoke only affected detail completeness',async()=>{
 const {jobs}=await execute(row=>roleMutation(row,r=>{r.jobType=null;r.publishedOn=null;r.salaryRange.currency={code:'INR'};r.salaryRange.minimum=['8000']})),job=jobs.find(j=>j.jobId==='167753');assert.ok(job);assert.equal(job.sourceDetailComplete,false);assert.ok(job.sourceNativeSchemaGaps.includes('jobType:type'));assert.ok(job.sourceNativeSchemaGaps.includes('publishedOn:type'));assert.ok(jobs.some(j=>j.jobId==='167534'&&j.sourceDetailComplete))
})
test('a new native foreign alternative must also reconcile the actual role-owned detail header',async()=>{
 const {jobs}=await execute(row=>roleMutation(row,r=>{r.jobLocations.push({id:999999,name:'Boston',city:'Boston',state:'MA',countryCode:'US',countryName:'United States'})})),job=jobs.find(j=>j.jobId==='167753');assert.ok(job);assert.equal(job.sourceNativeLocations.length,2);assert.equal(job.sourceDetailComplete,false);assert.equal(jobs.sourceAudit.allNativeDetailProofs.find(r=>r.id==='167753').opening.geography,false)
})
for(const field of ['city','name','state','countryCode','countryName','locationIdentifier'])test('nested mandatory criteria cannot hide inside a known location scalar: '+field,async()=>{
 const value={mandatoryLicense:'Required current license',eligibility:{country:'United States'}},{jobs}=await execute(row=>roleMutation(row,r=>{r.jobLocations[0][field]=value})),proof=jobs.sourceAudit.allNativeDetailProofs.find(p=>p.id==='167753')
 assert.equal(proof.complete,false);assert.ok(proof.schemaGaps.some(g=>g.includes(field)));assert.deepEqual(jobs.sourceAudit.sourceNativeRaw.find(r=>r.id===167753).jobLocations[0][field],value);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('actual optional experience and paired salary bounds are preserved without fabrication',async()=>{
 const {jobs}=await execute(),finance=jobs.find(j=>j.jobId==='140737'),unknown=jobs.sourceAudit.sourceNativeRaw.find(r=>r.id===146602),proof=jobs.sourceAudit.allNativeDetailProofs.find(p=>p.id==='146602')
 assert.equal(Object.hasOwn(finance.sourceNativePayload,'experience'),false);assert.equal(finance.experienceRequired,null);assert.equal(finance.sourceDetailComplete,true)
 assert.equal(Object.hasOwn(unknown.salaryRange,'minimum'),false);assert.equal(Object.hasOwn(unknown.salaryRange,'maximum'),false);assert.deepEqual(proof.schemaGaps,[])
})
test('country words in company background or travel do not become assigned role worksites',async()=>{
 const {jobs}=await execute(row=>roleMutation(row,r=>{r.description+='<p>Our customers operate in United States. Occasional travel to UAE may occur.</p>'})),job=jobs.find(j=>j.jobId==='167753');assert.ok(job);assert.equal(job.sourceAssignedLocationsUnresolved,false);assert.equal(job.sourceAssignedLocationStatements.length,1);assert.equal(job.sourceAssignedLocationStatements[0].value,'Bangalore')
})
for(const [target,mode] of [['base','text/plain'],['base','application/json'],['base','module'],['base','nomodule'],['base','template'],['gapi','text/plain'],['gapi','application/json'],['gapi','nomodule'],['gapi','removed'],['callback','text/plain'],['callback','nomodule']])test('declared publisher bootstrap must execute as classic JavaScript: '+target+'/'+mode,async()=>{
 let changed=false
 await assert.rejects(execute(row=>{if(row.url!==official)return
  row.body=row.body.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g,(all,attrs,body)=>{
   const selected=target==='base'?attrs.includes('id="base-js"'):target==='gapi'?attrs.includes('src="https://apis.google.com/js/client.js?onload=gapiLoaded"'):body.includes('function gapiLoaded()')
   if(!selected)return all;changed=true
   if(mode==='template')return '<template>'+all+'</template>'
   if(mode==='removed')return ''
   return '<script'+attrs+(mode==='nomodule'?' nomodule':' type="'+mode+'"')+'>'+body+'</script>'
  })
 }),/publisher|bootstrap|classic|controller|callback/i)
 assert.ok(changed,'actual declared script changed')
})
