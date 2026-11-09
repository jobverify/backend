import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from '../scraper/solera/script.js'
import {createCatalogScraper,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {WORKDAY_COUNTRY_INVENTORY_PROOF} from '../scraper-support/myworkday/countryInventoryProof.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../scraper/solera/fixtures/native-20261029.json.gz',import.meta.url))))
const official='https://www.solera.com/careers/',board='https://solera.wd5.myworkdayjobs.com/Global_Career_Site',api='https://solera.wd5.myworkdayjobs.com/wday/cxs/solera/Global_Career_Site/jobs'
const scheduler={acquire:async()=>()=>{},recordRateLimit:()=>{}}
const execute=async(t,{change=()=>{},options={},registered=false}={})=>{
 const state={calls:[],listingRequests:0}
 t.mock.method(globalThis,'fetch',async(input,init={})=>{
  init.signal?.throwIfAborted();const url=String(input),body=init.body?JSON.parse(init.body):undefined;state.calls.push({url,method:init.method||'GET',body});let value,contentType='application/json';
  if(url===official){value=fixture.officialHtml;contentType='text/html'}
  else if(url===board){value=fixture.boardHtml;contentType='text/html'}
  else if(url===api){state.listingRequests++;assert.deepEqual(body.appliedFacets,{});assert.equal(body.searchText,'');const rows=fixture.native.initial.records;value={total:body.offset===0?175:0,jobPostings:structuredClone(rows.slice(body.offset,body.offset+20)),facets:fixture.native.initial.facets,userAuthenticated:false}}
  else if(url.startsWith(api.replace(/\/jobs$/,'')+'/job/')){const p=url.slice(api.replace(/\/jobs$/,'').length);value=structuredClone(fixture.native.details.find(x=>x.row.externalPath===p)?.payload);assert.ok(value,'Uncaptured detail '+url)}
  else if(url.startsWith(board+'/job/')){value=fixture.htmlDetails[url];assert.ok(value,'Uncaptured HTML '+url);contentType='text/html'}
  else assert.fail('Unexpected public native request '+url)
  const response={value,url,status:200,contentType};change(response,url,state,body);const r=new Response(typeof response.value==='string'?response.value:JSON.stringify(response.value),{status:response.status,headers:{'content-type':response.contentType}});Object.defineProperty(r,'url',{value:response.url});return r;
 })
 let audit;const args={requestScheduler:scheduler,retryBaseDelayMs:0,requestTimeoutMs:1000,now:()=> '2026-10-30T00:00:00.000Z',onAudit:x=>audit=x,...options}
 const jobs=await(registered?createCatalogScraper(getScraperCatalog().find(x=>x.source==='solera')).run(args):run(args));return{jobs,audit,evidence:readInventoryEvidence(jobs),calls:state.calls}
}

test('Solera recovers all 27 native India roles with their actual subsidiary employers and full criteria',async t=>{
 const{jobs,evidence,audit}=await execute(t);assert.equal(jobs.length,27);assert.equal(new Set(jobs.map(x=>x.jobId)).size,27);assert.ok(jobs.every(x=>x.country==='India'&&x.sourceDetailComplete===true&&x.jobDescription.length>100&&x.company===x.nativeEmployer));assert.equal(jobs.filter(x=>x.company==='2152 SmartDrive Systems (India) Private Limited').length,15);assert.equal(jobs.filter(x=>x.company==='2124 DealerSocket (India) Pvt. Ltd.').length,9);assert.equal(jobs.filter(x=>x.company==='2165 Spireon Telematics India Pvt Ltd').length,3);assert.equal(evidence.listingComplete,false);assert.equal(evidence.indiaFacetCount,null);assert.ok(jobs.every(x=>x.lifecycleCleanupAllowed===false&&x.sourceScopeComplete===false));assert.equal(audit.rawOpening.total,175);assert.equal(audit.rawClosing.total,175);assert.equal(audit.rawOpening.roleIds.length,175);assert.equal(audit.rawOpening.rawDetails.length,175);assert.equal(audit.rawOpening.nativeIdentitySignature,'b462b7be63481db82ed1a5f7ddae0331c31b93dd25b32749454924d1fc52fff2');assert.equal(audit.rawClosing.nativeIdentitySignature,'b462b7be63481db82ed1a5f7ddae0331c31b93dd25b32749454924d1fc52fff2');assert.deepEqual(audit.openingCorporate.reasons,[]);assert.ok(audit.rawOpening.reasons.every(x=>x.startsWith('unresolved-secondary-location-country:')));assert.equal(audit.rawOpening.reasons.length,20);
})
test('Solera registered provider retains proven India jobs and explicit incomplete global country evidence',async t=>{const{jobs,evidence}=await execute(t,{registered:true});assert.equal(jobs.length,27);assert.equal(evidence.status,'coverage-gap');assert.equal(jobs[WORKDAY_COUNTRY_INVENTORY_PROOF].completeSourceScope,false)})
for(const[label,addition]of[['form','<form action="https://hiring.example/apply"><input name="resume"></form>'],['script','<script>window.openHiring="https://jobs.example/openings"</script>'],['data widget','<div data-careers-url="https://jobs.example/openings"></div>'],['ATS link','<a href="https://jobs.ashbyhq.com/another">Other openings</a>']])test(`Solera new corporate ${label} preserves jobs and identifies unresolved hiring surface`,async t=>{const{jobs,audit,evidence}=await execute(t,{change:(r,u)=>{if(u===official)r.value+=addition}});assert.equal(jobs.length,27);assert.equal(evidence.indiaFacetCount,null);assert.ok(audit.reasons.some(x=>/corporate|advertised/.test(x)))})
test('Solera unseen nested metadata on a foreign role remains an explicit schema uncertainty',async t=>{const{jobs,audit}=await execute(t,{change:(r,u)=>{if(u.includes('/job/Mitikah/Engineering-M3_'))r.value.jobPostingInfo.remoteType={additionalCountries:['India']}}});assert.equal(jobs.length,27);assert.ok(audit.reasons.some(x=>/nested-schema/.test(x)))})
test('Solera changed positive later-page total fails instead of returning empty or partial inventory',async t=>{await assert.rejects(execute(t,{change:(r,u,s,b)=>{if(u===api&&b.offset===20)r.value.total=174}}),/total|pagination|inventory/i)})
test('Solera missing later page fails instead of certifying a truncated cohort',async t=>{await assert.rejects(execute(t,{change:(r,u,s,b)=>{if(u===api&&b.offset===20)r.value.jobPostings=[]}}),/page|pagination|inventory/i)})
test('Solera changed raw closing detail cannot certify cleanup',async t=>{const{jobs,audit,evidence}=await execute(t,{change:(r,u,s)=>{if(u.includes('/job/Mitikah/Engineering-M3_')&&s.listingRequests>20)r.value.jobPostingInfo.timeType='Part time'}});assert.equal(jobs.length,27);assert.equal(evidence.listingComplete,false);assert.ok(audit.reasons.some(x=>/raw-native.*changed/.test(x)))})
test('Solera mismatched native India country and employer fail strict detail checks',async t=>{await assert.rejects(execute(t,{change:(r,u)=>{if(u.includes('/job/Virtual-India/Senior-Atlassian'))r.value.hiringOrganization.name='Different Employer'}}),/employer|native|scope/i)})
test('Solera explicit inventory cap and pre-aborted requests are rejected',async t=>{await assert.rejects(execute(t,{options:{maxJobs:1}}),/cap|limit/i);const controller=new AbortController();controller.abort(new Error('Solera check cancelled'));await assert.rejects(execute(t,{options:{signal:controller.signal}}),/cancelled/)})
test('Solera duplicated later-page role cannot satisfy the authoritative global total',async t=>{await assert.rejects(execute(t,{change:(r,u,s,b)=>{if(u===api&&b.offset===20)r.value.jobPostings[0]=structuredClone(fixture.native.initial.records[0])}}),/duplicate|identity|inventory/i)})
test('Solera native error envelopes never become verified empty',async t=>{await assert.rejects(execute(t,{change:(r,u)=>{if(u===api)r.value={errorCode:'HTTP_500',httpStatus:500}}}),/failure|native|inventory|payload/i)})
test('Solera current corporate observed response URL must bind the exact employer page',async t=>{await assert.rejects(execute(t,{change:(r,u)=>{if(u===official)r.url='https://different.example/careers/'}}),/response|URL|identity/i)})
test('Solera contradictory typed native country fields cannot be repaired with a location guess',async t=>{await assert.rejects(execute(t,{change:(r,u)=>{if(u.includes('/job/Virtual-India/Senior-Atlassian'))r.value.jobPostingInfo.country={descriptor:'United States of America',id:'bc33aa3152ec42d4995f4791a106ed09'}}}),/country|scope|location|native/i)})
test('Solera an unposted India role fails the public active-detail contract',async t=>{await assert.rejects(execute(t,{change:(r,u)=>{if(u.includes('/job/Virtual-India/Senior-Atlassian'))r.value.jobPostingInfo.posted=false}}),/application|posted|native|scope/i)})
test('Solera unknown mandatory criteria revoke only the affected retained India role detail completeness',async t=>{
 const{jobs,audit}=await execute(t,{change:(r,u)=>{if(u.includes('/job/Virtual-India/Senior-Atlassian'))r.value.jobPostingInfo.additionalQualificationRequirements='A newly required mandatory professional license.'}})
 assert.equal(jobs.length,27);const role=jobs.find(j=>j.jobId==='JR-020174');assert.equal(role.sourceDetailComplete,false);assert.equal(jobs.filter(j=>j.sourceDetailComplete===true).length,26);assert.ok(role.sourceDetailFailureReasons.some(r=>r.includes('schema')));assert.equal(role.nativeDetailReconciliation.opening.payload.jobPostingInfo.additionalQualificationRequirements,'A newly required mandatory professional license.');assert.ok(audit.incompleteIndiaRoles.some(j=>j.requisitionId==='JR-020174'))
})
test('Solera closing mandatory criteria drift revokes the old retained detail and preserves both native snapshots',async t=>{
 const{jobs,audit}=await execute(t,{change:(r,u,s)=>{if(u.includes('/job/Virtual-India/Senior-Atlassian')&&s.listingRequests===37)r.value.jobPostingInfo.jobDescription+='<p>Additional mandatory professional license required.</p>'}})
 assert.equal(jobs.length,27);const role=jobs.find(j=>j.jobId==='JR-020174');assert.equal(role.sourceDetailComplete,false);assert.equal(jobs.filter(j=>j.sourceDetailComplete===true).length,26);assert.ok(role.sourceDetailFailureReasons.includes('retained-role-native-detail-changed'));assert.doesNotMatch(role.nativeDetailReconciliation.opening.payload.jobPostingInfo.jobDescription,/Additional mandatory professional license/);assert.match(role.nativeDetailReconciliation.closing.payload.jobPostingInfo.jobDescription,/Additional mandatory professional license/);assert.ok(audit.incompleteIndiaRoles.some(j=>j.requisitionId==='JR-020174'));assert.ok(jobs.every(j=>j.lifecycleCleanupAllowed===false))
})
test('Solera transient native extraction metadata must agree with both closing-cohort snapshots',async t=>{
 const{jobs}=await execute(t,{change:(r,u,s)=>{if(u.includes('/job/Virtual-India/Senior-Atlassian')&&s.listingRequests>=18&&s.listingRequests<=28)r.value.jobPostingInfo.endDate='2026-12-31'}})
 const role=jobs.find(j=>j.jobId==='JR-020174');assert.equal(role.sourceDetailComplete,false);assert.ok(role.sourceDetailFailureReasons.includes('retained-role-native-extracted-metadata-mismatch'));assert.equal(role.nativeDetailReconciliation.closing.payload.jobPostingInfo.endDate,'2026-11-30')
})
test('Solera unknown global listing criteria cannot leave retained roles detail-complete',async t=>{
 const{jobs}=await execute(t,{change:(r,u)=>{if(u===api)r.value.mandatoryRequirements='All roles require a newly mandatory license.'}});assert.equal(jobs.length,27);assert.ok(jobs.every(j=>j.sourceDetailComplete===false))
})
test('Solera retained India country must agree with both raw metadata snapshots',async t=>{
 const{jobs}=await execute(t,{change:(r,u,s)=>{if(u.includes('/job/Virtual-India/Senior-Atlassian')&&(s.listingRequests===9||s.listingRequests===37)){r.value.jobPostingInfo.country={descriptor:'United States of America',id:'bc33aa3152ec42d4995f4791a106ed09'};r.value.jobPostingInfo.jobRequisitionLocation.country={descriptor:'United States of America',id:'bc33aa3152ec42d4995f4791a106ed09',alpha2Code:'US'}}}})
 const role=jobs.find(j=>j.jobId==='JR-020174');assert.equal(role.sourceDetailComplete,false);assert.ok(role.sourceDetailFailureReasons.includes('retained-role-native-extracted-metadata-mismatch'))
})
test('Solera top-level raw country conflict revokes complete detail even when the nested worksite stays India',async t=>{
 const{jobs}=await execute(t,{change:(r,u,s)=>{if(u.includes('/job/Virtual-India/Senior-Atlassian')&&(s.listingRequests===9||s.listingRequests===37))r.value.jobPostingInfo.country={descriptor:'United States of America',id:'bc33aa3152ec42d4995f4791a106ed09'}}})
 const role=jobs.find(j=>j.jobId==='JR-020174');assert.equal(role.sourceDetailComplete,false);assert.equal(jobs.filter(j=>j.sourceDetailComplete===true).length,26);assert.equal(role.nativeDetailReconciliation.opening.payload.jobPostingInfo.jobRequisitionLocation.country.descriptor,'India');assert.equal(role.nativeDetailReconciliation.closing.payload.jobPostingInfo.country.descriptor,'United States of America')
})
for(const[label,field,rawValue,engineValue]of[
 ['publication calendar rollover','startDate','2026-09-31','2026-10-01'],
 ['closing calendar rollover','endDate','2026-11-31','2026-12-01'],
 ['invalid closing date matching a missing extracted date','endDate','not-a-date',null],
])test(`Solera rejects raw ${label} when reconciling retained role dates`,async t=>{
 const{jobs}=await execute(t,{change:(r,u,s)=>{if(!u.includes('/job/Virtual-India/Senior-Atlassian'))return;const raw=s.listingRequests===9||s.listingRequests===37;if(raw)r.value.jobPostingInfo[field]=rawValue;else if(engineValue===null)delete r.value.jobPostingInfo[field];else r.value.jobPostingInfo[field]=engineValue}})
 const role=jobs.find(j=>j.jobId==='JR-020174');assert.equal(role.sourceDetailComplete,false);assert.equal(jobs.filter(j=>j.sourceDetailComplete===true).length,26);assert.ok(role.sourceDetailFailureReasons.includes('retained-role-native-extracted-metadata-mismatch'));assert.equal(role.nativeDetailReconciliation.closing.payload.jobPostingInfo[field],rawValue)
})
