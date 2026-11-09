import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { extractSearchResults } from '../../scraper/ola/shared.js'
import { createOlaScraper } from '../../scraper/ola/script.js'
import { nativeOptions,frozenResponses } from '../../scraper/ola/fixtures/options.js'
import { syntheticRole } from '../../scraper/ola/fixtures/syntheticRole.js'
import { roleContract,listingContract,dateValue,document,corporateContract,nativeSurfaceContract,NOAUTH_TOKEN_URL,FILTERED_JOBS_URL,ORGANIZATION_URL,DASHBOARD_URL,jobURL,publicJobURL } from '../../scraper/ola/nativeContract.js'
import { executableDocument } from '../../scraper/ola/nativeVisibility.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('Ola shared-board listing previews never establish employer identity or complete role criteria', () => {
  const payload=JSON.parse(readFileSync(new URL('./fixtures/ola/public-jobs-page.json',import.meta.url),'utf8'))
  assert.deepEqual(extractSearchResults(payload,{companyName:'Ola'}),[])
  assert.deepEqual(extractSearchResults(payload,{companyName:'Ola Electric'}),[])
})

const now='2026-10-26T22:30:00Z'
const parse=s=>roleContract(s.row,s.dto,s.page(),'ola',now)
test('full public role preserves exact native employer, all criteria and board lifecycle facts',()=>{
  const s=syntheticRole(),job=parse(s).job
  assert.equal(job.company,'Ola');assert.equal(job.legalEmployer,'ANI Technologies Pvt Ltd')
  assert.equal(job.requisitionId,null);assert.equal(job.jobCode,'SYNTHETIC-100')
  assert.equal(job.postingDate,s.dto.PublishedDates.CAREERPAGE);assert.equal(job.nativePublicationGeneral,s.dto.PublishedDate)
  assert.equal(job.nativePublicationSource,'publicjobs.PublishedDates.CAREERPAGE')
  assert.equal(job.closingDate,'2026-11-20');assert.equal(job.sourceClosingDateIsExact,false)
  assert.equal(job.nativeExpiryRaw,'2026-11-20T00:00:00');assert.equal(job.nativeExpiryPrecision,'day')
  assert.deepEqual(job.nativeExperience,{MinExp:3,MaxExp:6});assert.equal(job.experienceRequired,'3-6 years')
  assert.deepEqual(job.requiredSkills,s.dto.Skills);assert.equal(job.sourceDescription,s.dto.JobDescriptionV2)
  assert.equal(job.nativeApplicationTemplateId,s.dto.ApplicationEnquiryTemplateId);assert.equal(job.applicationSubmitted,false)
  assert.deepEqual(job.nativeLocationAddresses,['Bengaluru, Karnataka, India'])
})
test('role-owned Ola Electric employer remains distinct when the caller is Ola',()=>{
  const s=syntheticRole('olaelectric'),r=parse(s)
  assert.equal(r.employerSource,'olaelectric');assert.equal(r.job.company,'Ola Electric')
  assert.equal(r.job.legalEmployer,'Ola Electric Mobility Ltd')
})
for(const [name,mutate]of [
  ['unknown employer',s=>{s.posting.hiringOrganization.name='Unresolved shared tenant employer'}],
  ['employer domain disagreement',s=>{s.posting.hiringOrganization.sameAs='https://www.olaelectric.com/'}],
  ['additional employer hierarchy',s=>{s.posting.hiringOrganization.parentOrganization={name:'Unreviewed'} }],
  ['unknown typed country',s=>{s.dto.Country='India'}],
  ['city-only work location',s=>{s.row.Location=s.dto.Location='[{"Address":"Bengaluru"}]'}],
  ['remote placeholder',s=>{s.row.Location=s.dto.Location='[{"Address":"Remote"}]';s.posting.jobLocation.address.addressLocality='Remote'}],
  ['schema country conflict',s=>{s.posting.jobLocation.address.addressCountry='US'}],
  ['unreviewed custom fields',s=>{s.dto.AdditionalFields=[{JobCustomField:{FieldName:'Country'},Value:'India'}]}],
  ['draft role',s=>{s.dto.IsDraft=true}],
  ['cancelled native status',s=>{s.dto.JobStatus='Cancelled'}],
  ['missing public career board',s=>{s.dto.PublishedJobBoards=['REFERRAL']}],
  ['general date substituted for board publication',s=>{s.dto.PublishedDates.CAREERPAGE=s.dto.PublishedDate}],
  ['future publication',s=>{s.row.PublishedDate=s.dto.PublishedDates.CAREERPAGE='2026-11-01T10:00:00Z';s.posting.datePosted='2026-11-01'}],
  ['expired board',s=>{s.row.ExpiryDates=s.dto.ExpiryDates={CAREERPAGE:'2026-10-25T00:00:00'};s.posting.validThrough='2026-10-25'}],
  ['schema expiry disagreement',s=>{s.posting.validThrough='2027-01-01'}],
  ['clipped full role body',s=>{s.dto.JobDescriptionV2='<p>Short preview</p>'}],
  ['inert full role body',s=>{s.dto.JobDescriptionV2='<template>'+s.dto.JobDescriptionV2+'</template>'}],
  ['explicit closed role',s=>{s.dto.JobDescriptionV2+='<p>This job is closed.</p>';s.posting.description=s.dto.JobDescriptionV2}],
  ['explicit cancelled role',s=>{s.dto.JobDescriptionV2+='<p>This position has been cancelled.</p>';s.posting.description=s.dto.JobDescriptionV2}],
  ['application identity mismatch',s=>{s.dto.JobIdObfuscated='99999999-9999-4999-8999-999999999999'}],
  ['invalid template',s=>{s.dto.ApplicationEnquiryTemplateId='unreviewed-template'}],
  ['invalid experience',s=>{s.dto.Experience={MinExp:6,MaxExp:3}}],
  ['listing/full criteria disagreement',s=>{s.row.Skills=['Incompatible preview skill']}],
])test('full-role contract excludes '+name,()=>{const s=syntheticRole();mutate(s);assert.throws(()=>parse(s))})

test('native unpaged listing checks Total, unique IDs and unexpected continuation fields',()=>{
  const {row}=syntheticRole()
  assert.deepEqual(listingContract({Total:0,Result:[]}).reasons,[])
  assert.match(listingContract({Total:2,Result:[row]}).reasons.join(';'),/not-exhausted/)
  assert.match(listingContract({Total:2,Result:[row,row]}).reasons.join(';'),/duplicate/)
  assert.match(listingContract({Total:0,Result:[],NextPage:'/more'}).reasons.join(';'),/continuation/)
})
test('date-only expiry retains precision and invalid civil dates fail',()=>{
  assert.equal(dateValue('2026-11-20T00:00:00',{expiry:true}).value,'2026-11-20')
  assert.equal(dateValue('2026-11-20T10:00:00Z',{expiry:true}).exact,true)
  assert.throws(()=>dateValue('2026-02-30T00:00:00',{expiry:true}))
  assert.throws(()=>dateValue('2026-11-20T10:00:00',{expiry:true}))
})
test('presentation hiding and inert attributes do not suppress executable discovery',()=>{
  const html='<div hidden inert style="display:none"><script src="https://example.test/new.js"></script></div><template><script src="https://example.test/inert.js"></script></template><noscript><script src="https://example.test/raw.js"></script></noscript>'
  assert.deepEqual(executableDocument(html).nodes(n=>n.tag==='script').map(n=>n.attrs.src),['https://example.test/new.js'])
  assert.equal(document('<style>.hide{display:none}</style><div class="hide"><a href="/jobs">Jobs</a></div>').nodes(n=>n.tag==='a').length,0)
})
test('matching current stylesheet classes hide delegation in changed corporate markup',()=>{
  const html='<html><body><style>.invisible{display:none}</style><div class="invisible"><a href="https://olacareers.turbohire.co/careerpage/e0c1eb37-eb7a-4ca4-bcc5-d59ce4ce9212">See our Openings</a></div></body></html>'
  assert.equal(corporateContract(html,'ola').delegationVisible,false)
})
for(const status of [401,403,429])test('first public HTTP '+status+' aborts without retry or alternate endpoint',async()=>{
  const requests=[],options=nativeOptions({requests,mutate:({response})=>({...response,status})})
  await assert.rejects(createOlaScraper().run(options),error=>error.status===status&&error.abortRetries===true)
  assert.equal(requests.length,1)
})
test('bounded deadline cancels an unresolved transport operation',async()=>{
  await assert.rejects(createOlaScraper().run({timeoutMs:15,fetchImpl:()=>new Promise(()=>{})}),/deadline/)
})
test('current board zero is observed, reconciled and kept separate from partial employer scope',async()=>{
  const requests=[],packets=[],jobs=await createOlaScraper().run({...nativeOptions({requests}),onResponse:p=>packets.push(p)})
  const e=jobs.nativeInventoryEvidence
  assert.deepEqual(jobs,[]);assert.equal(e.nativeBoardComplete,true);assert.equal(e.nativeBoardEmpty,true)
  assert.equal(e.observedGlobalRecords,0);assert.equal(e.observedIndiaRecords,0);assert.equal(e.reportedTotal,0)
  assert.equal(e.sourceScopeComplete,false);assert.equal(e.lifecycleCleanupAllowed,false)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,0)
  assert.equal(requests.filter(r=>r.url===FILTERED_JOBS_URL).length,2)
  assert.equal(requests.filter(r=>r.url===ORGANIZATION_URL).length,2)
  assert.equal(requests.filter(r=>r.url===NOAUTH_TOKEN_URL).length,1)
  assert.ok(requests.every(r=>r.method==='GET'||r.url===FILTERED_JOBS_URL&&r.method==='POST'))
  assert.ok(!JSON.stringify(packets).includes('synthetic-public-fixture-credential'))
  assert.equal(packets.find(p=>p.anonymousSession).bodyRetained,false)
})
test('all public role details and closing snapshots precede a positive caller cap and employer selection',async()=>{
  const a=syntheticRole(),b=syntheticRole('olaelectric'),c=syntheticRole(),requests=[]
  c.row.JobId=c.row.JobIdObfuscated=c.dto.JobId=c.dto.JobIdObfuscated='44444444-4444-4444-8444-444444444444'
  c.row.JobCode=c.dto.JobCode='SYNTHETIC-101'
  const options=nativeOptions({requests,mutate:({url,response})=>{
    if(url===FILTERED_JOBS_URL)return{body:JSON.stringify({Total:3,Result:[a.row,b.row,c.row]}),contentType:'application/json'}
    for(const s of [a,b,c]){if(url===jobURL(s.row.JobId))return{body:s.render(),contentType:'text/html'};if(url===publicJobURL(s.row.JobId))return{body:JSON.stringify(s.dto),contentType:'application/json'}}
    return response
  }})
  const jobs=await createOlaScraper().run({...options,maxJobs:1})
  assert.equal(jobs.length,1);assert.equal(jobs.nativeInventoryEvidence.healthySourceIndiaRecords,2)
  assert.equal(jobs.nativeInventoryEvidence.otherEmployerRecords,1)
  assert.equal(jobs.nativeInventoryEvidence.healthyGlobalRecords,3)
  assert.match(jobs.nativeInventoryEvidence.reasons.join(';'),/caller-cap/)
  for(const s of [a,b,c]){assert.equal(requests.filter(r=>r.url===jobURL(s.row.JobId)).length,2);assert.equal(requests.filter(r=>r.url===publicJobURL(s.row.JobId)).length,2)}
})
test('a closing full-role change excludes that role and preserves partial coverage',async()=>{
  const s=syntheticRole(),options=nativeOptions({source:'olaelectric',mutate:({url,ordinal,response})=>{
    if(url===FILTERED_JOBS_URL)return{body:JSON.stringify({Total:1,Result:[s.row]}),contentType:'application/json'}
    if(url===jobURL(s.row.JobId))return{body:s.render(),contentType:'text/html'}
    if(url===publicJobURL(s.row.JobId)){const dto=structuredClone(s.dto);if(ordinal===2)dto.ApplicationEnquiryTemplateId='44444444-4444-4444-8444-444444444444';return{body:JSON.stringify(dto),contentType:'application/json'}}
    return response
  }})
  const jobs=await createOlaScraper().run(options)
  assert.equal(jobs.length,0);assert.match(jobs.nativeInventoryEvidence.reasons.join(';'),/role-changed-during-closing/)
})

for(const [name,key,value]of [
  ['unreviewed client company','ClientCompany',{Name:'Different legal employer'}],
  ['unreviewed client description','ClientDesc','An unresolved staffing client'],
  ['unreviewed qualifications','MinimumQualification','A specific degree requirement'],
  ['additional experience units','ExperienceInMonths',{Min:24,Max:48}],
  ['unreviewed full-description attachment','JobDescriptionBlobUrl','https://example.test/full-role.pdf'],
  ['unreviewed role video','JobDescriptionVideoUrl','https://example.test/criteria.mp4'],
])test('future role remains partial for '+name,()=>{const s=syntheticRole();s.dto[key]=value;assert.throws(()=>parse(s))})

test('registered source cannot be relabeled through a run option',async()=>{
  const jobs=await createOlaScraper().run({...nativeOptions(),source:'olaelectric'})
  assert.equal(jobs.nativeInventoryEvidence.source,'ola')
})
test('inline zero opacity cannot supply visible source proof',()=>{
  assert.equal(document('<div style="opacity:0"><a href="/jobs">Jobs</a></div>').nodes(n=>n.tag==='a').length,0)
})
for(const markup of ['<iframe hidden src="https://example.test/extra-jobs"></iframe>','<iframe srcdoc="extra hiring path"></iframe>','<iframe></iframe>','<object hidden data="https://example.test/extra-jobs"></object>'])test('unreviewed frame/object declarations remain discoverable when hidden: '+markup,()=>{
  const html=frozenResponses()[DASHBOARD_URL].body.replace('</body>',markup+'</body>')
  assert.throws(()=>nativeSurfaceContract(html))
})
test('an unlisted native dashboard hiring link cannot be silently omitted',()=>{
  const html=frozenResponses()[DASHBOARD_URL].body.replace('</body>','<a href="https://new.example/positions/unlisted">Open Positions</a></body>')
  assert.throws(()=>nativeSurfaceContract(html))
})
test('mixed native work addresses keep full provenance and select the proven India-facing address',()=>{
  const s=syntheticRole(),localities=['Toronto, Ontario, Canada','Bengaluru, Karnataka, India']
  s.dto.Location=s.row.Location=JSON.stringify(localities.map(Address=>({Address})))
  s.posting.jobLocation=localities.map((addressLocality,index)=>({'@type':'Place',address:{'@type':'PostalAddress',addressLocality,addressCountry:index===0?'Canada':'India'}}))
  const r=parse(s),job=r.job
  assert.deepEqual(r.countries,['Canada','India'])
  assert.equal(job.country,'India');assert.equal(job.location,'Bengaluru, Karnataka, India');assert.equal(job.city,'Bengaluru')
  assert.deepEqual(job.nativeLocationAddresses,localities)
})
