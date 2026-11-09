import assert from 'node:assert/strict'
import test from 'node:test'
import { createByteridgeScraper } from './script.js'
import { nativeOptions, nativeFixture } from './fixtures/options.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createHash } from 'node:crypto'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const C = 'https://byteridge.com/careers/', I = 'https://byteridge.com/wp-content/career/index.html'
const J = 'https://byteridge.com/wp-content/career/assets/js/career.js', F = 'https://byteridge.com/wp-json/turbohire/v1/careerpagejobs'
const A = 'https://thapi-stage0.azurewebsites.net/api/', ID = '34756b57-fd21-4591-b34c-6e2c91cb7f02'
const bodyJSON = (packet, fn) => { const data = JSON.parse(packet.body); fn(data); packet.body = JSON.stringify(data) }
const postingJSON = (packet,fn) => { packet.body=packet.body.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,(all,start,raw,end)=>{const value=JSON.parse(raw);fn(value);return start+JSON.stringify(value)+end}) }
const run = options => createByteridgeScraper().run(options)
test.beforeEach(t => { t.mock.method(globalThis, 'fetch', async () => { throw Error('Unexpected network in hermetic Byteridge tests') }) })

test('current corporate iframe and public All Jobs return all seven complete India roles', async () => {
  const options = nativeOptions(), jobs = await run(options)
  assert.equal(jobs.length, 7)
  assert.deepEqual(jobs.map(j => j.jobId), [ID,'c3dd22b9-ccfe-41c8-bfc2-6d79572bcf20','9568e7e7-e841-4b6b-90d9-392dc60e1789','90334922-6e57-4c4b-82a6-18e959552874','ddd3d264-ccda-4ae7-a35a-62188d68d473','e18f3511-cbaa-4948-83b0-3b1e89949a41','d884baa9-3629-477c-8bcf-238666787f4b'])
  assert.ok(jobs.every(j => j.country === 'India' && j.sourceDetailComplete && j.sourceListingComplete && j.sourceScopeComplete))
  assert.equal(jobs[0].requisitionId, null)
  assert.equal(jobs[0].jobCode, 'BSPL-85359')
  assert.equal(jobs[0].postingDate, '2026-10-26T05:28:00.3490159Z')
  assert.equal(jobs[0].nativePublicationGeneral, '2026-10-26T05:28:00.3177654Z')
  assert.equal(jobs[0].closingDate, '2027-01-24')
  assert.equal(jobs[0].nativeExpiryRaw, '2027-01-24T00:00:00')
  assert.equal(jobs[0].sourceClosingDateIsExact, false)
  assert.match(jobs[0].jobDescription, /enterprise integration patterns/i)
  assert.match(jobs[1].location, /India/i)
  assert.equal(jobs[1].title, 'Sales Manager (US Market)')
  assert.equal(jobs[1].remoteStatus, 'Remote')
  assert.equal(jobs[0].remoteStatus, null)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(jobs.nativeInventoryEvidence.observedGlobalRecords, 7)
  assert.equal(jobs.nativeInventoryEvidence.closingReconciled, true)
  assert.ok(options.calls.filter(c => c.url.startsWith(A+'publicjobs/')).length >= 14)
  assert.ok(options.calls.every(c => !/userspartialdata|statistics|referral|profile|candidate|applications/.test(c.url)))
  assert.equal(JSON.stringify(jobs).includes('fixture-anonymous-public-token'), false)
  assert.equal(JSON.stringify(jobs).includes('CreatedByEmail'), false)
})

test('caller caps happen after all global roles and closing details are reconciled', async () => {
  const options = nativeOptions(), jobs = await run({...options,maxJobs:1})
  assert.equal(jobs.length,1)
  assert.equal(jobs.nativeInventoryEvidence.observedGlobalRecords,7)
  assert.ok(options.calls.filter(c=>c.url.startsWith(A+'publicjobs/')).length>=14)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for (const [label, mutate] of [
  ['native total exceeds returned rows', (p,u) => { if(u.includes('filteredjobs')) bodyJSON(p,j=>{j.Total=8}) }],
  ['unknown native continuation', (p,u) => { if(u.includes('filteredjobs')) bodyJSON(p,j=>{j.NextPage=2}) }],
  ['corporate cache omits a native role', (p,u) => { if(u===F) bodyJSON(p,j=>{j.Result.pop();j.Total--}) }],
  ['new corporate hiring path', (p,u) => { if(u===C) p.body=p.body.replace('</body>','<a href="https://other-ats.example/byteridge/jobs">More open positions</a></body>') }],
]) test(label+' retains healthy roles with partial inventory evidence',async()=>{
  const jobs=await run(nativeOptions(mutate))
  assert.ok(jobs.length>0)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.ok(jobs.every(j=>j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
})

for (const [label, mutate] of [
  ['unknown address country', j=>{j.Location='[{"Address":"Pune, Maharashtra, Atlantis","PlaceId":null}]'}],
  ['extra typed country field', j=>{j.Location='[{"Address":"Hyderabad, Telangana, India","PlaceId":null,"Country":"US"}]'}],
  ['non-string typed country field', j=>{j.Country={Code:'IN'}}],
  ['draft',j=>{j.IsDraft=true}],
  ['not public',j=>{j.IsPublic=false}],
  ['closed',j=>{j.JobStatus='Closed'}],
  ['expired',j=>{j.ExpiryDates.CAREERPAGE='2026-01-01T00:00:00'}],
  ['missing board publication',j=>{delete j.PublishedDates.CAREERPAGE}],
  ['inert full description',j=>{j.JobDescriptionV2='<div hidden>'+j.JobDescriptionV2+'</div>'}],
  ['opacity-zero full description',j=>{j.JobDescriptionV2='<div style="opacity:0">'+j.JobDescriptionV2+'</div>'}],
  ['source country conflicts with schema',j=>{j.Location='[{"Address":"Boston, Massachusetts, United States","PlaceId":null}]'}],
]) test(label+' cannot produce a complete India job',async()=>{
  const jobs=await run(nativeOptions((p,u)=>{if(u===A+'publicjobs/'+ID)bodyJSON(p,mutate)}))
  assert.equal(jobs.some(j=>j.jobId===ID),false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('remote placeholder needs explicit role-owned India location rather than a market title',async()=>{
  const id='c3dd22b9-ccfe-41c8-bfc2-6d79572bcf20'
  const jobs=await run(nativeOptions((p,u)=>{if(u===A+'publicjobs/'+id)bodyJSON(p,j=>{j.JobDescriptionV2=j.JobDescriptionV2.replace(/India/g,'Anywhere');j.JobDescription=j.JobDescription.replace(/India/g,'Anywhere')})}))
  assert.equal(jobs.some(j=>j.jobId===id),false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('closing changes exclude the changed role and preserve partial status for the batch',async()=>{
  const jobs=await run(nativeOptions((p,u,i)=>{if(u===A+'publicjobs/'+ID&&i===1)bodyJSON(p,j=>{j.JobTitle='Changed role'})}))
  assert.equal(jobs.some(j=>j.jobId===ID),false)
  assert.equal(jobs.length,6)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const [label,mutate]of[
  ['unreviewed iframe client',(p,u)=>{if(u===J)p.body+='\nfetch("https://other-ats.example/jobs")'}],
  ['hidden corporate iframe',(p,u)=>{if(u===C)p.body=p.body.replace('src="'+I+'"','hidden src="'+I+'"')}],
  ['missing executable native client',(p,u)=>{if(u.includes('/job/publicjobs/'))p.body=p.body.replace('main.4d05cc901a9accc19b6c.chunk.js','main.changed.chunk.js')}],
  ['unbound employer',(p,u)=>{if(u.includes('publicorganizations'))bodyJSON(p,j=>{j.OrgURL='https://other-company.example/'})}],
]) test(label+' stops before accepting any roles',async()=>{
  await assert.rejects(run(nativeOptions(mutate)))
})

test('first actual public 403 stops without retry or alternate endpoints',async()=>{
  const options=nativeOptions((p,u)=>{if(u===A+'publicjobs/'+ID)p.status=403})
  await assert.rejects(run(options),/403/)
  const index=options.calls.findIndex(c=>c.url===A+'publicjobs/'+ID)
  assert.equal(index,options.calls.length-1)
})

test('native row country metadata cannot override or hide an unreviewed country shape',async()=>{
  const jobs=await run(nativeOptions((p,u)=>{if(u.includes('filteredjobs'))bodyJSON(p,j=>{j.Result[0].Country={Code:'IN'}})}))
  assert.equal(jobs.some(j=>j.jobId===ID),false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('closing listing skill drift excludes the affected job',async()=>{
  const jobs=await run(nativeOptions((p,u,i)=>{if(u.includes('filteredjobs')&&i===1)bodyJSON(p,j=>{j.Result[0].Skills=['Changed skill']})}))
  assert.equal(jobs.some(j=>j.jobId===ID),false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('explicit JD location with an unknown country is not treated as absent evidence',async()=>{
  const jobs=await run(nativeOptions((p,u)=>{if(u===A+'publicjobs/'+ID)bodyJSON(p,j=>{j.JobDescriptionV2+='<p>Location: Atlantis</p>';j.JobDescription+='<p>Location: Atlantis</p>'});if(u.includes('/job/publicjobs/'+ID))postingJSON(p,j=>{j.description+='Location: Atlantis'})}))
  assert.equal(jobs.some(j=>j.jobId===ID),false)
})

test('coherent active DTO cannot override an explicit role closure notice',async()=>{
  const jobs=await run(nativeOptions((p,u)=>{if(u===A+'publicjobs/'+ID)bodyJSON(p,j=>{j.JobDescriptionV2='<p>This position is closed.</p>'+j.JobDescriptionV2;j.JobDescription='<p>This position is closed.</p>'+j.JobDescription});if(u.includes('/job/publicjobs/'+ID))postingJSON(p,j=>{j.description='This position is closed.'+j.description})}))
  assert.equal(jobs.some(j=>j.jobId===ID),false)
})

test('new executable native inline script is not accepted under the reviewed client version',async()=>{
  await assert.rejects(run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'))p.body=p.body.replace('</body>','<script>document.getElementById("root").hidden=true</script></body>')})))
})

test('new corporate inline client retains partial scope evidence',async()=>{
  const jobs=await run(nativeOptions((p,u)=>{if(u===C)p.body=p.body.replace('</body>','<script>window.otherHiringFeed="/second-jobs"</script></body>')}))
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const attribute of ['hidden','style="display:none"','inert']) {
  test(attribute+' does not suppress executable corporate inline inventory',async()=>{
    const jobs=await run(nativeOptions((p,u)=>{if(u===C)p.body=p.body.replace('</body>','<div '+attribute+'><script hidden>window.otherHiringFeed="https://jobs.ashbyhq.com/byteridge"</script></div></body>')}))
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  })
  test(attribute+' does not suppress executable native inline inventory',async()=>{
    await assert.rejects(run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'))p.body=p.body.replace('</body>','<div '+attribute+'><script hidden>window.otherHiringFeed="https://jobs.ashbyhq.com/byteridge"</script></div></body>')})))
  })
}

test('template and raw noscript/fallback bodies do not create executable clients',async()=>{
  const jobs=await run(nativeOptions((p,u)=>{if(u===C||u.includes('/job/publicjobs/'))p.body=p.body.replace('</body>','<template><script>window.otherHiringFeed="unexecuted"</script></template><noscript><script>window.otherHiringFeed="unexecuted"</script></noscript></body>')}))
  assert.equal(jobs.length,7)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})

test('author CSS cannot hide the official delegation while keeping full coverage',async()=>{
  await assert.rejects(run(nativeOptions((p,u)=>{if(u===C)p.body=p.body.replace('</head>','<style>iframe{display:none}</style></head>')})))
})

test('an existing CSS class cannot hide the official delegation',async()=>{
  await assert.rejects(run(nativeOptions((p,u)=>{if(u===C)p.body=p.body.replace('id="dynamic-iframe"','id="dynamic-iframe" class="e-search-close"')})))
})

test('an ancestor hidden by an existing CSS rule cannot delegate the native inventory',async()=>{
  await assert.rejects(run(nativeOptions((p,u)=>{if(u===C)p.body=p.body.replace('<iframe id="dynamic-iframe"','<div class="e-search-close"><iframe id="dynamic-iframe"').replace('scrolling="no" style="overflow: auto;"></iframe>','scrolling="no" style="overflow: auto;"></iframe></div>')})))
})

test('author CSS cannot hide the native public application root',async()=>{
  await assert.rejects(run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'))p.body=p.body.replace('</head>','<style>#root{display:none}</style></head>')})))
})

test('description CSS cannot supply hidden full criteria',async()=>{
  const jobs=await run(nativeOptions((p,u)=>{if(u===A+'publicjobs/'+ID)bodyJSON(p,j=>{j.JobDescriptionV2='<style>.criteria{display:none}</style><div class="criteria">'+j.JobDescriptionV2+'</div>';j.JobDescription=j.JobDescriptionV2})}))
  assert.equal(jobs.some(j=>j.jobId===ID),false)
})

test('an additional contradictory explicit role Location cannot be ignored',async()=>{
  const id='c3dd22b9-ccfe-41c8-bfc2-6d79572bcf20'
  const jobs=await run(nativeOptions((p,u)=>{if(u===A+'publicjobs/'+id)bodyJSON(p,j=>{j.JobDescriptionV2+='<p>Location: United States</p>';j.JobDescription+='<p>Location: United States</p>'});if(u.includes('/job/publicjobs/'+id))postingJSON(p,j=>{j.description+='Location: United States'})}))
  assert.equal(jobs.some(j=>j.jobId===id),false)
})

test('additional same-tenant native role links retain partial global scope',async()=>{
  const jobs=await run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'))p.body=p.body.replace('</body>','<a href="/job/publicjobs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa">Another job</a></body>')}))
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('visible native closure cannot be overridden by the active DTO',async()=>{
  const jobs=await run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'+ID))p.body=p.body.replace('<div id="root">','<p>This job is no longer accepting applications.</p><div id="root">')}))
  assert.equal(jobs.some(j=>j.jobId===ID),false)
})

test('supplied role employer label cannot conflict with the employer binding',async()=>{
  const jobs=await run(nativeOptions((p,u)=>{if(u===A+'publicjobs/'+ID)bodyJSON(p,j=>{j.OrgDetails.OrgName='Other Employer'})}))
  assert.equal(jobs.some(j=>j.jobId===ID),false)
})

test('supplied native schema expiry cannot contradict the board expiry',async()=>{
  const jobs=await run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'+ID))postingJSON(p,j=>{j.validThrough='2020-01-01T00:00:00Z'})}))
  assert.equal(jobs.some(j=>j.jobId===ID),false)
})

test('schema locality cannot contradict the native listing and detail location',async()=>{
  const jobs=await run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'+ID))postingJSON(p,j=>{j.jobLocation.address.addressLocality='Pune'})}))
  assert.equal(jobs.some(j=>j.jobId===ID),false)
})

test('closing application template changes exclude the affected role',async()=>{
  const jobs=await run(nativeOptions((p,u,i)=>{if(u===A+'publicjobs/'+ID&&i===1)bodyJSON(p,j=>{j.ApplicationEnquiryTemplateId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'})}))
  assert.equal(jobs.some(j=>j.jobId===ID),false)
})

test('native experience ranges survive downstream normalization as readable source criteria',async()=>{
  const jobs=await run(nativeOptions())
  assert.deepEqual(jobs[0].nativeExperience,{MinExp:6,MaxExp:8})
  assert.equal(jobs[0].experienceRequired,'6–8 years')
  assert.equal(normalizeScrapedJob(jobs[0],{source:'byteridge',companyName:'Byteridge'}).experienceRequired,'6–8 years')
  assert.equal(JSON.stringify(normalizeScrapedJob(jobs[0],{source:'byteridge'})).includes('[object Object]'),false)
})

test('aborted caller stops the source without requesting a public endpoint',async()=>{
  const controller=new AbortController();controller.abort(Error('caller cancelled'))
  const options=nativeOptions()
  await assert.rejects(run({...options,signal:controller.signal}),/caller cancelled/)
  assert.equal(options.calls.length,0)
})

test('fixture keeps source line endings and traces original/retained hashes without a live token',()=>{
  const fixture=nativeFixture()
  assert.equal(createHash('sha256').update(fixture.responses[J].body).digest('hex'),'f7701a128edc5c8c13d6b17ece52407acea4236c4a4ff5667c69abb65565d315')
  assert.match(fixture.privacy,/redacted/)
})
