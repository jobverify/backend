import assert from 'node:assert/strict'
import test from 'node:test'
import {createMonoceptScraper} from './script.js'
import {nativeOptions} from './fixtures/options.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
const C='https://www.monocept.com/careers',N='https://monocept.turbohire.co',A='https://thapi-stage0.azurewebsites.net/api/',ID='fbc9a3a8-9158-4972-9fcb-f27ce2ae79bd'
const D=A+'publicjobs/'+ID+'?fieldVisibility=CareerPage'
const run=options=>createMonoceptScraper().run(options)
const bodyJSON=(p,fn)=>{const j=JSON.parse(p.body);fn(j);p.body=JSON.stringify(j)}
const postingJSON=(p,fn)=>{p.body=p.body.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,(all,start,raw,end)=>{const j=JSON.parse(raw);fn(j);return start+JSON.stringify(j)+end})}
test.beforeEach(t=>t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected network in hermetic Monocept tests')}))
test('normal public All Jobs overrides the misleading old careerpage empty view with seven full India roles',async()=>{
 const options=nativeOptions(),jobs=await run(options)
 assert.equal(jobs.length,7)
 assert.deepEqual(jobs.map(j=>j.jobId),[ID,'74541c24-8116-4c49-bf3f-3a6a1ec22459','821d6690-94fc-4b36-9ab3-a4db07a42783','f608a483-809f-4f17-b3c5-2cd1edbe8e81','1660fed0-52d7-4abb-9c6a-3cc37cffd369','623c5b06-410f-4ed3-b06b-b5579c01a152','3a1ef067-d67b-41da-a1ce-6196357c8d52'])
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.sourceScopeComplete&&j.legalEmployer==='Monocept Consulting Pvt. Ltd.'))
 assert.equal(jobs[0].postingDate,'2026-08-06T09:34:16.3214377Z')
 assert.equal(jobs[1].nativePublicationGeneral,'2026-08-06T09:29:13.3724692Z')
 assert.equal(jobs[0].closingDate,null)
 assert.equal(jobs[0].requisitionId,null)
 assert.equal(jobs[0].jobCode,'MCPL-88604')
 assert.equal(jobs[4].city,null)
 assert.equal(jobs[0].nativeApplicationTemplateId,'0257263e-3b85-41f3-afb4-afd6285f0271')
 assert.deepEqual(jobs[0].nativeExperience,{MinExp:8,MaxExp:15})
 assert.equal(normalizeScrapedJob(jobs[0],{source:'monocept'}).experienceRequired,'8–15 years')
 assert.match(jobs[0].jobDescription,/strategic sales plans/i)
 assert.equal(readInventoryEvidence(jobs).status,'complete-inventory')
 assert.equal(jobs.nativeInventoryEvidence.observedGlobalRecords,7)
 assert.ok(options.calls.filter(c=>c.url.includes('/api/publicjobs/')).length>=14)
 assert.ok(options.calls.every(c=>! /userspartialdata|statistics|referral|profile|candidate|applications/.test(c.url)))
 assert.equal(JSON.stringify(jobs).includes('fixture-anonymous-public-token'),false)
})
test('caller cap follows full global and closing reconciliation',async()=>{
 const options=nativeOptions(),jobs=await run({...options,maxJobs:1})
 assert.equal(jobs.length,1);assert.equal(jobs.nativeInventoryEvidence.observedGlobalRecords,7)
 assert.equal(options.calls.filter(c=>c.url.includes('/api/publicjobs/')).length,14)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const[label,mutate]of[
 ['total beyond unique rows',(p,u)=>{if(u.includes('filteredjobs'))bodyJSON(p,j=>j.Total=8)}],
 ['unknown pagination metadata',(p,u)=>{if(u.includes('filteredjobs'))bodyJSON(p,j=>j.NextPage=2)}],
 ['duplicate source identities',(p,u)=>{if(u.includes('filteredjobs'))bodyJSON(p,j=>j.Result.push(j.Result[0]))}],
 ['extra hiring route',(p,u)=>{if(u===C)p.body=p.body.replace('</body>','<a href="https://another-ats.example/jobs">More careers</a></body>')}],
 ['extra visible frame',(p,u)=>{if(u===C)p.body=p.body.replace('</body>','<iframe src="https://another-ats.example/jobs"></iframe></body>')}],
 ['hidden executable corporate client',(p,u)=>{if(u===C)p.body=p.body.replace('</body>','<div hidden inert style="display:none"><script>window.moreJobs="/jobs"</script></div></body>')}],
])test(label+' retains healthy roles with partial scope',async()=>{
 const jobs=await run(nativeOptions(mutate));assert.equal(jobs.length,7);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const[label,mutate]of[
 ['missing application template',j=>{delete j.ApplicationEnquiryTemplateId}],
 ['other visible hiring employer',j=>{j.ClientName='Another Employer';j.ShowClientName=true}],
 ['other client-company employer',j=>{j.ClientCompany.ClientName='Another Employer'}],
 ['unknown employer field',j=>{j.EmployerName='Another Employer'}],
 ['other organization label',j=>{j.OrgDetails.OrgName='Another Employer'}],
 ['unknown native location country',j=>{j.Location='[{"Address":"Mumbai, Atlantis","PlaceId":null}]'}],
 ['extra native address key',j=>{j.Location='[{"Address":"Mumbai, Maharashtra, India","Country":"US"}]'}],
 ['unreviewed typed country',j=>{j.Country={Code:'IN'}}],
 ['unknown custom field',j=>{j.AdditionalFields=[{JobCustomField:{FieldName:'New field'},Value:'unknown'}]}],
 ['draft state',j=>{j.IsDraft=true}],
 ['closed state',j=>{j.JobStatus='Closed'}],
 ['not public state',j=>{j.IsPublic=false}],
 ['missing CAREERPAGE publication',j=>{delete j.PublishedDates.CAREERPAGE}],
 ['unreviewed experience key',j=>{j.Experience={MinExp:8,MaxExp:15,Units:'months'}}],
 ['incomplete experience range',j=>{j.Experience={MinExp:8}}],
 ['inert criteria',j=>{j.JobDescriptionV2='<div hidden>'+j.JobDescriptionV2+'</div>'}],
])test(label+' cannot yield the affected complete role',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u===D)bodyJSON(p,mutate)}));assert.equal(jobs.some(j=>j.jobId===ID),false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const[label,mutate]of[
 ['schema country disagreement',j=>{j.jobLocation.address.addressCountry='United States'}],
 ['schema locality disagreement',j=>{j.jobLocation.address.addressLocality='Delhi'}],
 ['schema date disagreement',j=>{j.datePosted='2026-10-26'}],
 ['schema employer disagreement',j=>{j.hiringOrganization.name='Another Employer'}],
 ['schema skills disagreement',j=>{j.skills=['Unrelated skill']}],
 ['schema-only expiry',j=>{j.validThrough='2020-01-01T00:00:00Z'}],
])test(label+' excludes affected source identity',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u===N+'/job/publicjobs/'+ID+'?utm_source=CareerPage')postingJSON(p,mutate)}));assert.equal(jobs.some(j=>j.jobId===ID),false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const[label,mutate]of[
 ['closing-only template drift',(p,u,i)=>{if(u===D&&i===1)bodyJSON(p,j=>j.ApplicationEnquiryTemplateId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')}],
 ['closing-only listing criteria drift',(p,u,i)=>{if(u.includes('filteredjobs')&&i===1)bodyJSON(p,j=>j.Result[0].Skills=['Unrelated skill'])}],
 ['closing-only new job identity',(p,u,i)=>{if(u.includes('filteredjobs')&&i===1)bodyJSON(p,j=>{j.Result.pop();j.Total--})}],
])test(label+' cannot retain complete global scope',async()=>{
 const jobs=await run(nativeOptions(mutate));assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(jobs.some(j=>j.jobId===ID),label==='closing-only new job identity')
})
for(const attribute of ['hidden','inert','style="display:none"'])test(attribute+' leaves native scripts executable for inventory',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'+ID))p.body=p.body.replace('</body>','<div '+attribute+'><script>window.moreJobs="/jobs"</script></div></body>')}));assert.equal(jobs.some(j=>j.jobId===ID),false)
})
test('parser-inert template and noscript contents do not create executing routes',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u===C||u.includes('/job/publicjobs/'))p.body=p.body.replace('</body>','<template><script>window.moreJobs="/jobs"</script></template><noscript><script>window.moreJobs="/jobs"</script></noscript></body>')}));assert.equal(jobs.length,7);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('existing hidden CSS class on delegation and ancestor cannot prove official handoff',async()=>{
 for(const ancestor of [false,true])await assert.rejects(run(nativeOptions((p,u)=>{if(u===C){p.body=p.body.replace(/class="fda-button careers w-inline-block"/g,'class="fda-button careers w-inline-block w-condition-invisible"');if(ancestor)p.body=p.body.replace(/<a href="https:\/\/monocept.turbohire.co/g,'<div class="w-condition-invisible"><a href="https://monocept.turbohire.co')}})))
})
test('remote placeholders do not inherit India from employer or public schema',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u===D)bodyJSON(p,j=>j.Location='[{"Address":"Remote Job","PlaceId":null}]');if(u.includes('filteredjobs'))bodyJSON(p,j=>j.Result[0].Location='[{"Address":"Remote Job","PlaceId":null}]')}));assert.equal(jobs.some(j=>j.jobId===ID),false)
})
test('visible native closure overrides active DTO',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'+ID))p.body=p.body.replace('<div id="root">','<p>This job is no longer accepting applications.</p><div id="root">')}));assert.equal(jobs.some(j=>j.jobId===ID),false)
})
test('an added native role link retains partial global scope',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'))p.body=p.body.replace('</body>','<a href="/job/publicjobs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa">Another role</a></body>')}));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const status of [401,403,429])test('public HTTP '+status+' stops at first denial without retry',async()=>{
 const options=nativeOptions((p,u)=>{if(u===D)p.status=status});await assert.rejects(run(options),new RegExp(String(status)));assert.equal(options.calls.at(-1).url,D)
})
test('caller cancellation makes no public request',async()=>{
 const controller=new AbortController();controller.abort(Error('caller cancelled'));const options=nativeOptions();await assert.rejects(run({...options,signal:controller.signal}),/caller cancelled/);assert.equal(options.calls.length,0)
})
for(const[raw,expected,exact,available]of[
 ['2027-01-24T00:00:00','2027-01-24',false,true],
 ['2027-01-24T00:00:00Z','2027-01-24T00:00:00Z',true,true],
 ['2026-10-27T00:00:00','2026-10-27',false,false],
 ['2026-01-01T00:00:00Z','2026-01-01T00:00:00Z',true,false],
])test('native expiry '+raw+' preserves precision and availability',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u===D)bodyJSON(p,j=>j.ExpiryDates={CAREERPAGE:raw});if(u.includes('filteredjobs'))bodyJSON(p,j=>j.Result[0].ExpiryDates={CAREERPAGE:raw})})),job=jobs.find(j=>j.jobId===ID)
 assert.equal(Boolean(job),available);if(job){assert.equal(job.closingDate,expected);assert.equal(job.sourceClosingDateIsExact,exact)}
})
test('native neighborhood address keeps the full hierarchy instead of inventing a city',async()=>{
 const jobs=await run(nativeOptions()),j=jobs.find(j=>j.jobId==='1660fed0-52d7-4abb-9c6a-3cc37cffd369')
 assert.equal(j.location,'Udyog Vihar, Sector 19, Gurugram, Haryana, India');assert.equal(j.city,null)
})
const BOARD=N+'/careerpage/0e8227c1-c352-4202-8e40-c0aa16b6ca69',DASH=N+'/dashboardv2'
for(const surface of [BOARD,DASH])for(const href of ['/job/publicjobs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','https://jobs.ashbyhq.com/monocept'])test('unreconciled hiring link on '+surface+' to '+href+' prevents complete scope',async()=>{
 const options=nativeOptions((p,u)=>{if(u===surface)p.body=p.body.replace('</body>','<a href="'+href+'">Jobs</a></body>')}),jobs=await run(options)
 assert.equal(jobs.length,7);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(options.calls.some(c=>c.url.includes('aaaaaaaa-aaaa')||c.url.includes('ashbyhq')),false)
})
test('cross-ATS hiring link text is reconciled even when its path contains no job keyword',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'+ID))p.body=p.body.replace('</body>','<a href="https://external.example/monocept">Open positions</a></body>')}))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('known native role links on advertised and dashboard shells reconcile with global identities',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u===BOARD||u===DASH)p.body=p.body.replace('</body>','<a href="/job/publicjobs/'+ID+'?utm_source=CareerPage">Jobs</a></body>')}))
 assert.equal(jobs.length,7);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
for(const frame of ['<iframe srcdoc="&lt;a href=https://jobs.ashbyhq.com/monocept&gt;Jobs&lt;/a&gt;"></iframe>','<iframe></iframe>','<iframe src=""></iframe>','<iframe src="about:blank"></iframe>'])test('active corporate frame context '+frame+' retains unresolved scope',async()=>{
 const options=nativeOptions((p,u)=>{if(u===C)p.body=p.body.replace('</body>',frame+'</body>')}),jobs=await run(options)
 assert.equal(jobs.length,7);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(options.calls.some(c=>c.url.includes('ashbyhq')||c.url.startsWith('about:')),false)
 if(frame.includes('srcdoc'))assert.ok(jobs[0].nativeCollectionEvidence.surfaceContexts.opening.corporate.frames.some(f=>f?.kind==='srcdoc'&&typeof f.bodySHA256==='string'))
})
test('native dashboard srcdoc frame stays unresolved without reading its embedded targets',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u===DASH)p.body=p.body.replace('</body>','<iframe srcdoc="&lt;a href=https://jobs.ashbyhq.com/monocept&gt;Jobs&lt;/a&gt;"></iframe></body>')}))
 assert.equal(jobs.length,7);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('hidden and parser-inert frame contexts do not add visible delegation',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u===C)p.body=p.body.replace('</body>','<div hidden><iframe srcdoc="Jobs"></iframe></div><template><iframe srcdoc="Jobs"></iframe></template><noscript><iframe></iframe></noscript></body>')}))
 assert.equal(jobs.length,7);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('mixed Canada and India work addresses select only proven India locations while preserving native provenance',async()=>{
 const addresses=[{Address:'Toronto, Ontario, Canada',PlaceId:null},{Address:'Mumbai, Maharashtra, India',PlaceId:null}]
 const jobs=await run(nativeOptions((p,u)=>{
  if(u===D)bodyJSON(p,j=>j.Location=JSON.stringify(addresses))
  if(u.includes('filteredjobs'))bodyJSON(p,j=>j.Result[0].Location=JSON.stringify(addresses))
  if(u===N+'/job/publicjobs/'+ID+'?utm_source=CareerPage')postingJSON(p,j=>j.jobLocation=[{...j.jobLocation,address:{...j.jobLocation.address,addressLocality:'Toronto, Ontario, Canada',addressCountry:'Canada'}},j.jobLocation])
 })),job=jobs.find(j=>j.jobId===ID)
 assert.equal(jobs.length,7);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(job.country,'India');assert.equal(job.location,'Mumbai, Maharashtra, India')
 assert.equal(job.city,null);assert.equal(normalizeScrapedJob(job,{source:'monocept'}).city,null)
 assert.deepEqual(job.nativeLocationAddresses,['Toronto, Ontario, Canada','Mumbai, Maharashtra, India'])
 assert.deepEqual(job.nativeCountryEvidence.schemaCountries,['Canada','India'])
 assert.deepEqual(job.nativeCountryEvidence.selectedIndiaAddresses,['Mumbai, Maharashtra, India'])
 assert.equal(job.nativeLocationSchema.length,2)
})
const CRITERIA_ID='1660fed0-52d7-4abb-9c6a-3cc37cffd369',CRITERIA_D=A+'publicjobs/'+CRITERIA_ID+'?fieldVisibility=CareerPage',CRITERIA_H=N+'/job/publicjobs/'+CRITERIA_ID+'?utm_source=CareerPage'
for(const field of ['qualifications','educationRequirements','experienceRequirements','responsibilities'])test('native structured '+field+' is preserved as complete source criteria',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u===CRITERIA_H)postingJSON(p,j=>j[field]='ADDED_NATIVE_QUALIFICATION')})),job=jobs.find(j=>j.jobId===CRITERIA_ID)
 assert.ok(job);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.match(job.sourceDescription,/ADDED_NATIVE_QUALIFICATION/);assert.match(job.jobDescription,/ADDED_NATIVE_QUALIFICATION/)
 assert.equal(job.nativeStructuredCriteria[field],'ADDED_NATIVE_QUALIFICATION')
})
for(const value of [{name:'unsupported credential shape'},['A visible qualification',{unknown:'shape'}]])test('unsupported structured qualification shape retains partial inventory',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u===CRITERIA_H)postingJSON(p,j=>j.qualifications=value)}))
 assert.equal(jobs.some(j=>j.jobId===CRITERIA_ID),false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const value of ['PART_TIME',['FULL_TIME','PART_TIME'],{name:'FULL_TIME'}])test('conflicting or unsupported schema employment '+JSON.stringify(value)+' cannot establish a complete role',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u===CRITERIA_H)postingJSON(p,j=>j.employmentType=value);if(u===CRITERIA_D)bodyJSON(p,j=>j.JobTypeV2='FullTime')}))
 assert.equal(jobs.some(j=>j.jobId===CRITERIA_ID),false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('equivalent schema FULL_TIME reconciles with native Full Time employment',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u===CRITERIA_H)postingJSON(p,j=>j.employmentType='FULL_TIME');if(u===CRITERIA_D)bodyJSON(p,j=>j.JobTypeV2='FullTime')})),job=jobs.find(j=>j.jobId===CRITERIA_ID)
 assert.ok(job);assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(job.employmentType,'FullTime')
})
for(const hidden of ['<div hidden>HIDDEN_CRITERION</div>','<div inert>HIDDEN_CRITERION</div>','<div aria-hidden="true">HIDDEN_CRITERION</div>','<div style="display:none">HIDDEN_CRITERION</div>','<div style="opacity:0">HIDDEN_CRITERION</div>','<template>HIDDEN_CRITERION</template>','<noscript>HIDDEN_CRITERION</noscript>'])test('visible eligibility survives without publishing inert nested criteria '+hidden,async()=>{
 const addition='<p>Visible extra eligibility.</p>'+hidden,jobs=await run(nativeOptions((p,u)=>{
  if(u===CRITERIA_D)bodyJSON(p,j=>{j.EligibilityV2+=addition;j.Eligibility+=addition})
  if(u===CRITERIA_H)postingJSON(p,j=>j.description+=addition)
 })),job=jobs.find(j=>j.jobId===CRITERIA_ID)
 assert.ok(job);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.match(job.jobDescription,/Visible extra eligibility/);assert.match(job.sourceDescription,/Visible extra eligibility/)
 assert.equal(job.jobDescription.includes('HIDDEN_CRITERION'),false);assert.equal(job.sourceDescription.includes('HIDDEN_CRITERION'),false)
 assert.match(job.nativeRawDescriptionSections.EligibilityV2,/HIDDEN_CRITERION/)
})
test('structured qualification projection preserves visible text and omits hidden text',async()=>{
 const jobs=await run(nativeOptions((p,u)=>{if(u===CRITERIA_H)postingJSON(p,j=>j.qualifications='<p>VISIBLE_QUALIFICATION</p><div hidden>HIDDEN_CRITERION</div>')})),job=jobs.find(j=>j.jobId===CRITERIA_ID)
 assert.ok(job);assert.match(job.sourceDescription,/VISIBLE_QUALIFICATION/);assert.equal(job.sourceDescription.includes('HIDDEN_CRITERION'),false)
})
const READER_HIDDEN_VARIANTS=[
 ['unquoted opacity','<div style=opacity:0>HIDDEN_CRITERION</div>'],
 ['comment before zero','<div style="opacity:/**/0">HIDDEN_CRITERION</div>'],
 ['comment after zero','<div style="opacity:0/*x*/">HIDDEN_CRITERION</div>'],
 ['unquoted entity zero','<div style=opacity:&#48;>HIDDEN_CRITERION</div>'],
 ['entities and comments','<div style="opacity&#58;/**/&#48;">HIDDEN_CRITERION</div>'],
 ['nonrendering title','<title>HIDDEN_CRITERION</title>'],
]
for(const[label,hidden]of READER_HIDDEN_VARIANTS){
 test('parsed body visibility excludes '+label+' while preserving visible eligibility',async()=>{
  const addition='<p>Visible extra eligibility.</p>'+hidden,jobs=await run(nativeOptions((p,u)=>{
   if(u===CRITERIA_D)bodyJSON(p,j=>{j.EligibilityV2+=addition;j.Eligibility+=addition})
   if(u===CRITERIA_H)postingJSON(p,j=>j.description+=addition)
  })),job=jobs.find(j=>j.jobId===CRITERIA_ID)
  assert.ok(job);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.match(job.sourceDescription,/Visible extra eligibility/);assert.equal(job.sourceDescription.includes('HIDDEN_CRITERION'),false)
  assert.equal(job.jobDescription.includes('HIDDEN_CRITERION'),false);assert.match(job.nativeRawDescriptionSections.EligibilityV2,/HIDDEN_CRITERION/)
 })
 test('parsed structured criteria visibility excludes '+label,async()=>{
  const jobs=await run(nativeOptions((p,u)=>{if(u===CRITERIA_H)postingJSON(p,j=>j.qualifications='<p>VISIBLE_QUALIFICATION</p>'+hidden)})),job=jobs.find(j=>j.jobId===CRITERIA_ID)
  assert.ok(job);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.match(job.sourceDescription,/VISIBLE_QUALIFICATION/);assert.equal(job.sourceDescription.includes('HIDDEN_CRITERION'),false)
 })
}
for(const style of ['opacity:1','opacity:/**/1','opacity:&#49;'])test('visible parsed opacity control '+style+' preserves source text',async()=>{
 const addition='<p style="'+style+'">VISIBLE_STYLE_CONTROL</p>',jobs=await run(nativeOptions((p,u)=>{
  if(u===CRITERIA_D)bodyJSON(p,j=>{j.EligibilityV2+=addition;j.Eligibility+=addition})
  if(u===CRITERIA_H)postingJSON(p,j=>j.description+=addition)
 })),job=jobs.find(j=>j.jobId===CRITERIA_ID)
 assert.ok(job);assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.match(job.sourceDescription,/VISIBLE_STYLE_CONTROL/)
})
test('description visibility leaves document HEAD title identity intact',async()=>{
 const {document}=await import('./nativeContract.js'),doc=document('<html><head><title>KEEP_HEAD_IDENTITY</title></head><body><p>Visible body</p></body></html>')
 assert.equal(doc.nodes(n=>n.tag==='title')[0].raw,'KEEP_HEAD_IDENTITY')
})
