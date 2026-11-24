import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture,HOME,BOARD,FEED,TARGET,ROLE,INDIA_IDS,AT,replay,assertRoles,body,attr,mount,model,modelEdit,schema,feed,ownSchema,ownTitle,element,exact} from './currentFixture20261121.test-support.js'

test('Verint current genuine paired default factory projects three explicit India partials',async()=>{
 const r=await replay(),jobs=assertRoles(r)
 assert.deepEqual(new Set(jobs.map(j=>j.jobId)),new Set(INDIA_IDS));assert.equal(r.calls.length,12)
 assert.equal(r.assessment.runnerOutcome.success,true);assert.equal(r.assessment.eligibleJobs,2);assert.equal(r.assessment.filterCounts.excludedTitle,1)
 for(const job of jobs){assert.equal(job.nativeEmployer,'Verint');assert.equal(job.sourceNativePublisher,'Verint');assert.equal(job.sourceNativeObservedRole.originalNativePosting.locationAddress,null);assert(job.sourceRawDescriptionHtml.length>1000);assert.equal(job.sourceNativeApplication.activationVerified,false);assert.equal(job.sourceNativeApplication.submitted,false);assert.equal(job.sourceClosingQualified,true)}
 assert.equal(jobs.find(j=>j.jobId===TARGET).postingDate.slice(0,10),'2026-11-12')
 assert(r.calls.every(c=>c.method==='GET'&&!/oraclecloud|\/application|\/form\/|cdn\.ashby|non-user-graphql/.test(c.url)))
})
test('Verint current source-local registered factory runs ordinary options without legacy fallback',async()=>{const r=await replay({registered:true,ordinary:true});assertRoles(r);assert.equal(r.calls.length,12)})
test('Verint genuine originals contain independently acquired opening and closing responses',()=>{assert.equal(fixture.responses.length,12);assert.equal(fixture.responses.filter(r=>r.phase==='opening').length,6);assert.equal(fixture.responses.filter(r=>r.phase==='closing').length,6);assert(fixture.responses.every(r=>r.status===200&&r.method==='GET'&&r.bodyComplete===true))})

for(const[name,change]of[
 ['own foreign publisher title',ownTitle('Careers | Other Corporation')],
 ['own wrong native account',body(HOME,t=>t.replaceAll(BOARD,'https://jobs.ashbyhq.com/other-company'))],
 ['own hidden actual global team anchors',body(HOME,t=>t.replaceAll('class="career-hero__link button"','class="career-hero__link button" hidden').replaceAll('class="button standard-demo-block__link"','class="button standard-demo-block__link" hidden'))],
 ['own foreign named publisher',ownSchema({'@context':'https://schema.org','@type':'WebPage',url:HOME,publisher:{'@type':'Organization',name:'Other Corporation'}})],
 ['own named publisher foreign identity',ownSchema({'@context':'https://schema.org','@type':'WebPage',url:HOME,publisher:{name:'Verint',url:'https://other.example/'}})],
 ['native board employer',model(BOARD,m=>{m.organization.name='Other Corporation'})],
 ['native board nested named employer',model(BOARD,m=>{m.organization.company={name:'Other Corporation'}})],
 ['native board slug',model(BOARD,m=>{m.organization.hostedJobsPageSlug='other'})],
 ['native board backlink',model(BOARD,m=>{m.organization.publicWebsite='https://other.example/'})],
 ['native board maintenance',model(BOARD,m=>{m.maintenanceMode=true})],
 ['native board nonproduction environment',model(BOARD,m=>{m.environment='staging'})],
 ['native board stealth selection',model(BOARD,m=>{m.jobBoard.stealthAccess=true})],
 ['native board foreign canonical OG',body(BOARD,t=>element(t,n=>n.tag==='meta'&&n.attrs.property==='og:url',old=>old.replace('https://jobs.ashbyhq.com/verint','https://jobs.ashbyhq.com/other')))],
 ['native common employer criterion',model(BOARD,m=>{m.organization.theme.jobBoardTopDescriptionHtml+='<section><p>Employer</p><p>Other Corporation</p></section>'})],
 ['native common closed criterion',model(BOARD,m=>{m.organization.theme.jobBoardBottomDescriptionHtml+='<section><p>Posting status</p><p>Closed</p></section>'})],
 ['native board state overwritten',body(BOARD,t=>element(t,n=>n.tag==='script'&&(n.raw??'').includes('window.__appData ='),(old,n)=>exact(old,n.raw,n.raw+';window.__appData.organization.name="Other";')))],
 ['feed wrong API version',feed((_r,f)=>{f.apiVersion='2'})],
 ['feed malformed complete body',body(FEED,()=>'{')]
])test('Verint current source hold: '+name,async()=>{const r=await replay({change});assert(r.error?.nativeContradiction===true,JSON.stringify({error:r.error?.message,jobs:r.jobs?.length}))})

for(const[name,change]of[
 ['native role identity',model(ROLE,m=>{m.posting.id='00000000-0000-4000-8000-000000000000'})],
 ['native role title',model(ROLE,m=>{m.posting.title='Different role'})],
 ['native role unlisted',model(ROLE,m=>{m.posting.isListed=false})],
 ['native role confidential',model(ROLE,m=>{m.posting.isConfidential=true})],
 ['native role different OG title',body(ROLE,t=>element(t,n=>n.tag==='meta'&&n.attrs.property==='og:title',old=>old.replace('ServiceNow Administrator','Different job')))],
 ['native role employer',model(ROLE,m=>{m.organization.name='Other Corporation'})],
 ['native role nested named employer',model(ROLE,m=>{m.organization.company={name:'Other Corporation'}})],
 ['native role explicit work country',model(ROLE,m=>{m.posting.workLocationCountry='Canada'})],
 ['native role application URI',model(ROLE,m=>{m.posting.jobApplicationURI='https://other.example/apply'})],
 ['native role expired',model(ROLE,m=>{m.posting.applicationDeadline='2020-01-01'})],
 ['native role future publication',model(ROLE,m=>{m.posting.datePosted='2099-01-01'})],
 ['native role explicit closure prose',model(ROLE,m=>{m.posting.descriptionHtml+='<p>Applications for this position are now closed.</p>'})],
 ['native role explicit foreign workplace prose',model(ROLE,m=>{m.posting.descriptionHtml+='<p>Work location: Toronto, Canada</p>'})],
 ['native role complete200 parser error',body(ROLE,t=>element(t,n=>n.tag==='script'&&(n.raw??'').includes('window.__appData ='),(old,n)=>exact(old,n.raw,'window.__appData = {bad:;')))],
 ['native role state overwritten',body(ROLE,t=>element(t,n=>n.tag==='script'&&(n.raw??'').includes('window.__appData ='),(old,n)=>exact(old,n.raw,n.raw+';Object.assign(window,{__appData:{}});')))],
 ['schema identifier',schema(s=>{s.identifier.value='other'})],
 ['schema employer',schema(s=>{s.hiringOrganization.name='Other Corporation'})],
 ['schema named employer URL',schema(s=>{s.hiringOrganization.sameAs='https://other.example/'})],
 ['schema work country',schema(s=>{s.jobLocation.address.addressCountry='Canada'})],
 ['schema applicant country',schema(s=>{s.applicantLocationRequirements.name='Canada'})],
 ['schema conflicting workLocations alias',schema(s=>{s.workLocations=[{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'Canada'}}]})],
 ['schema alternate application',schema(s=>{s.jobApplicationURI='https://other.example/'})],
 ['schema postal address alternate application',schema(s=>{s.jobLocation.address.applicationUrl='https://other.example/'})],
 ['schema expired',schema(s=>{s.validThrough='2020-01-01'})],
 ['feed unlisted',feed(r=>{r.isListed=false})],
 ['feed missing authored publication date',feed(r=>{delete r.publishedAt})],
 ['feed primary country',feed(r=>{r.address.postalAddress.addressCountry='Canada'})],
 ['feed secondary country contradiction',feed(r=>{r.secondaryLocations[0].address.postalAddress.addressCountry='Canada'})],
 ['feed missing explicit countries',feed(r=>{delete r.address.postalAddress.addressCountry;r.secondaryLocations.forEach(x=>{delete x.address.postalAddress.addressCountry})})],
 ['feed mismatched job URL',feed(r=>{r.jobUrl='https://jobs.ashbyhq.com/verint/00000000-0000-4000-8000-000000000000'})],
 ['feed foreign application',feed(r=>{r.applyUrl='https://other.example/apply'})],
 ['feed plain authored workplace criterion',feed(r=>{r.descriptionPlain+='\nWork location: Toronto, Canada'})],
 ['feed duplicate role ID',feed((r,f)=>{f.jobs.at(-1).id=r.id})],
 ['feed duplicate application',feed((r,f)=>{f.jobs.at(-1).applyUrl=r.applyUrl})],
 ['native board selected title',model(BOARD,m=>{m.jobBoard.jobPostings.find(r=>r.id===TARGET).title='Different role'})]
 ,['native board selected explicit unlisted',model(BOARD,m=>{m.jobBoard.jobPostings.find(r=>r.id===TARGET).isListed=false})]
 ,['native board selected hidden',model(BOARD,m=>{m.jobBoard.jobPostings.find(r=>r.id===TARGET).isHidden=true})]
 ,['native board selected application alias',model(BOARD,m=>{m.jobBoard.jobPostings.find(r=>r.id===TARGET).applicationUrl='https://other.example/'})]
])test('Verint current affected-role hold preserves two others: '+name,async()=>{assertRoles(await replay({change}),2)})

for(const[field,value]of[['Country','Canada'],['Employer','Other Corporation'],['Posting status','Closed'],['Application URL','https://other.example/'],['Location','Toronto, Canada']])for(const attrs of['','hidden','inert','style="display:none"'])test('Verint current same-role semantic '+field+' '+attrs,async()=>{const change=mount(ROLE,'<section '+attrs+'><p>'+field+'</p><p>'+value+'</p></section>');assertRoles(await replay({change}),2)})

for(const[name,change]of[
 ['unrelated SVG title',body(ROLE,t=>exact(t,'</body>','<svg><title>Other illustration</title></svg></body>'))],
 ['native parser comment',body(ROLE,t=>element(t,n=>n.tag==='script'&&(n.raw??'').includes('window.__appData ='),(old,n)=>exact(old,n.raw,'/* unrelated parser note */\n'+n.raw)))],
 ['native model key order',model(ROLE,m=>{const entries=Object.entries(m).reverse();for(const key of Object.keys(m))delete m[key];Object.assign(m,Object.fromEntries(entries))})],
 ['native organization UUID is not pinned',(entity,url)=>{if(url.startsWith('https://jobs.ashbyhq.com/'))entity.text=modelEdit(entity.text,m=>{m.organization.organizationId='00000000-0000-4000-8000-000000000000'})}],
 ['employer office country remains unscoped',model(ROLE,m=>{m.organization.address={'@type':'PostalAddress',addressCountry:'Canada'}})],
 ['native common unbranded prose change',model(BOARD,m=>{m.organization.theme.jobBoardTopDescriptionHtml+='<p>Explore our current opportunities.</p>'})],
 ['coherent same-role semantic metadata',mount(ROLE,'<section><p>Country</p><p>India</p></section><section><p>Employer</p><p>Verint</p></section><section><p>Posting status</p><p>Open</p></section>')],
 ['unrelated scoped global shadow',body(ROLE,t=>exact(t,'</body>','<script>{const window={};window.note="local"}</script></body>'))]
])test('Verint current coherent positive: '+name,async()=>{assertRoles(await replay({change}))})

test('Verint current earliest authored publication day is retained with all original date fields',async()=>{const r=await replay({change:model(ROLE,m=>{m.posting.datePosted='2026-08-01'})}),jobs=assertRoles(r);assert.equal(jobs.find(j=>j.jobId===TARGET).postingDate.slice(0,10),'2026-08-01');assert(jobs.find(j=>j.jobId===TARGET).sourceNativeDates.recognizedPostingFields.length>=3)})
for(const value of['2026-08-01T03:04:05+05:30','2026-08-01T03:04:05.067-04:00','2026-08-01T03:04:05.1+00:00'])test('Verint current source timestamp retains offset and earliest exact instant '+value,async()=>{const jobs=assertRoles(await replay({change:model(ROLE,m=>{m.posting.datePosted=value})})),job=jobs.find(j=>j.jobId===TARGET);assert.equal(job.postingDate,new Date(value).toISOString());assert(job.sourceNativeDates.recognizedPostingFields.some(d=>d.raw===value&&d.iso===new Date(value).toISOString()));assert.equal(job.sourceNativeObservedRole.originalPublicRecord.publishedAt,'2026-11-12T13:47:09.067+00:00')})
for(const value of['2026-02-30T03:04:05+00:00','2026-08-01T24:04:05+00:00','2026-08-01T03:60:05+00:00','2026-08-01T03:04:60+00:00','2026-08-01T03:04:05+05:60','2026-08-01T03:04:05+15:00','2026-08-01T03:04:05+14:01','2099-08-01T03:04:05+00:00'])test('Verint current invalid or future source timestamp holds only affected role '+value,async()=>{assertRoles(await replay({change:model(ROLE,m=>{m.posting.datePosted=value})}),2)})
test('Verint current feed published offset and raw native dates survive both observations',async()=>{const jobs=assertRoles(await replay());for(const job of jobs){const value=job.sourceNativeObservedRole.originalPublicRecord.publishedAt;assert(value.endsWith('+00:00'));assert(job.sourceNativeDates.recognizedPostingFields.some(d=>d.raw===value&&d.iso===new Date(value).toISOString()))}})
test('Verint current authored common earliest date is retained across the qualified role models',async()=>{const jobs=assertRoles(await replay({change:model(ROLE,m=>{m.organization.theme.jobBoardBottomDescriptionHtml+='<p>Date posted: 2026-08-01</p>'})}));assert.equal(jobs.find(j=>j.jobId===TARGET).postingDate.slice(0,10),'2026-08-01')})
test('Verint current day precision closing date today remains valid and raw',async()=>{const raw=AT.slice(0,10),jobs=assertRoles(await replay({change:schema(s=>{s.validThrough=raw})})),job=jobs.find(j=>j.jobId===TARGET);assert.equal(job.closingDate.slice(0,10),raw);assert.equal(job.sourceClosingDateIsExact,false);assert.equal(job.sourceNativeDates.validThroughRaw,raw)})
test('Verint current full native criteria are projected while each feed variant remains verbatim',async()=>{const suffix='This role owns additional current responsibilities.',jobs=assertRoles(await replay({change:model(ROLE,m=>{m.posting.descriptionHtml+='<p>'+suffix+'</p>'})})),job=jobs.find(j=>j.jobId===TARGET);assert(job.jobDescription.includes(suffix));assert(!job.sourceNativeObservedRole.originalPublicRecord.descriptionPlain.includes(suffix))})
test('Verint current optional503 preserves only a partial with explicit feed country and unchanged public handoff',async()=>{const r=await replay({change:(entity,url,phase)=>{if(url===ROLE&&phase==='closing')entity.status=503}}),jobs=assertRoles(r);assert.equal(jobs.find(j=>j.jobId===TARGET).sourceDetailClosingQualified,false)})
for(const cap of['maxJobs','maxPages'])test('Verint current caller zero '+cap+' never proves empty',async()=>{const r=await replay({options:{[cap]:0}});assert.ifError(r.error);assert.equal(r.jobs.length,0);assert.equal(r.calls.length,0);assert.notEqual(r.assessment.zeroJobEvidence,'fetched-zero')})
for(const status of[202,401,402,403,406,407,429,451])test('Verint current origin barrier '+status+' stops without retry or historical fallback',async()=>{const r=await replay({change:(entity,url)=>{if(url===HOME)entity.status=status}});assert(r.error);assert.equal(r.calls.length,1)})
test('Verint current rejects a non-Response hook',async()=>{const r=await replay({options:{fetchPage:async()=>''}});assert(r.error?.nativeContradiction);assert.equal(r.calls.length,0)})
for(const value of[null,undefined,false])test('Verint current invalid supplied clock never resets observation time '+String(value),async()=>{const r=await replay({options:{now:()=>value}});assert(r.error?.nativeContradiction);assert.equal(r.calls.length,0)})
test('Verint current final async audit abort propagates the original reason',async()=>{const c=new AbortController(),reason=Error('opaque caller abort'),r=await replay({options:{signal:c.signal,onAudit:async()=>{queueMicrotask(()=>c.abort(reason));await Promise.resolve()}}});assert.equal(r.error,reason)})
test('Verint current completed response TypeError is not classified as an optional outage',async()=>{const r=await replay({options:{onAudit:()=>{throw TypeError('bad complete parsed model')}}});assert(r.error);assert.notEqual(r.error.nativeUnavailable,true)})

void attr;void modelEdit;void AT
