import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{gunzipSync}from'node:zlib';
import * as sigma from'./script.js';import{getScraperCatalog,createCatalogScraper}from'../../scraper-support/providers/index.js';import{readInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js';
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js';
import {SIGMA_OFFICES_URL} from './worksiteCountry.js';
const boardOnlyJSON=raw=>async url=>{if(url!==sigma.buildGreenhouseJobsApiUrl())throw Error('Historical capture lacks original role detail responses');return raw};
const fixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261029.json.gz',import.meta.url)))),payload=()=>JSON.parse(Buffer.from(fixture().responses[1].bodyBase64,'base64'));
test('actual77 rows retain7 required and15 optional raw education flags before India selection',()=>{
 const raw=payload(),rows=sigma.extractNativeJobsFromGreenhousePayload(raw),job=rows.find(j=>j.jobId==='8015269003');assert.equal(rows.length,77);assert.equal(rows.filter(j=>j.sourceNativeEducation!==null).length,22);assert.equal(rows.filter(j=>j.sourceNativeEducation==='education_required').length,7);assert.equal(rows.filter(j=>j.sourceNativeEducation==='education_optional').length,15);assert.ok(rows.find(j=>j.sourceNativeEducation==='education_optional').sourceCriteriaSchemaKnown);assert.equal(job.postingDate,'2026-10-06T21:58:00-04:00');assert.equal(job.sourceUpdatedAt,'2026-10-20T16:45:53-04:00');assert.equal(job.sourceNativeEducation,'education_required');assert.deepEqual(job.sourceNativeRecord,raw.jobs[0]);assert.equal(job.sourceNativeContent,raw.jobs[0].content);assert.equal(job.sourceNativeMetadata,null);assert.equal(job.legalHiringEmployer,null);assert.equal(job.country,null);assert.ok(job.jobDescription.startsWith('<div'));assert.equal(job.jobDescription.includes('&lt;div'),false);
});
test('all66 actual edit/publication differences retain first_published and leave original records untouched',()=>{
 const raw=payload(),before=JSON.stringify(raw),rows=sigma.extractNativeJobsFromGreenhousePayload(raw);assert.equal(raw.jobs.filter(j=>j.first_published!==j.updated_at).length,66);for(const [index,row]of rows.entries()){assert.equal(row.postingDate,raw.jobs[index].first_published);assert.equal(row.sourceUpdatedAt,raw.jobs[index].updated_at);assert.deepEqual(row.sourceNativeRecord,raw.jobs[index]);assert.equal(row.sourceNativeMetadata,null)}assert.equal(JSON.stringify(raw),before);
});
test('actual native HTML is decoded without dropping raw encoded content, line breaks or education evidence',()=>{
 const raw=payload(),job=sigma.extractNativeJobsFromGreenhousePayload(raw)[0];assert.equal(job.sourceNativeContent,raw.jobs[0].content);assert.ok(job.jobDescription.includes('\n'));assert.ok(job.jobDescription.includes('<strong>About the Role</strong>'));assert.equal(job.sourceNativeEducation,'education_required');assert.equal(job.employmentType,null);assert.equal(job.legalHiringEmployer,null);
});
test('missing publication never substitutes the actual edit timestamp',()=>{
 const raw=payload();delete raw.jobs[0].first_published;const job=sigma.extractNativeJobsFromGreenhousePayload(raw)[0];assert.equal(job.postingDate,null);assert.equal(job.sourceFirstPublished,null);assert.equal(job.sourceUpdatedAt,'2026-10-20T16:45:53-04:00');
});
test('invalid calendar publication remains unknown rather than rolling forward',()=>{
 const raw=payload();raw.jobs[0].first_published='2026-09-31T21:58:00-04:00';const job=sigma.extractNativeJobsFromGreenhousePayload(raw)[0];assert.equal(job.postingDate,null);assert.equal(job.sourceFirstPublished,'2026-09-31T21:58:00-04:00');assert.ok(job.sourceCriteriaIssues.includes('invalid-native-first-published'));
});
test('unknown education shape retains exact mandatory criteria without inventing a degree',()=>{
 const raw=payload();raw.jobs[0].education={mandatoryLicense:'Required'};const job=sigma.extractNativeJobsFromGreenhousePayload(raw)[0];assert.deepEqual(job.sourceNativeEducation,{mandatoryLicense:'Required'});assert.deepEqual(job.sourceNativeRecord.education,raw.jobs[0].education);assert.equal(job.sourceCriteriaSchemaKnown,false);assert.ok(job.sourceCriteriaIssues.includes('unreviewed-native-education-requirement'));
});
test('new nonnull metadata remains raw and unreviewed without guessing a legal employer',()=>{
 const raw=payload();raw.jobs[0].metadata=[{id:123456,name:'Company',value:'A published legal entity',value_type:'single_select'},{id:123457,name:'Mandatory License',value:{license:'Required'}}];const job=sigma.extractNativeJobsFromGreenhousePayload(raw)[0];assert.deepEqual(job.sourceNativeMetadata,raw.jobs[0].metadata);assert.equal(job.legalHiringEmployer,null);assert.equal(job.sourceCriteriaSchemaKnown,false);assert.ok(job.sourceCriteriaIssues.includes('unreviewed-native-metadata'));
});
test('new raw mandatory fields survive intact and are not silently treated as reviewed criteria',()=>{
 const raw=payload();raw.jobs[0].requiredProfessionalLicense={license:'Required'};const job=sigma.extractNativeJobsFromGreenhousePayload(raw)[0];assert.deepEqual(job.sourceNativeRecord.requiredProfessionalLicense,{license:'Required'});assert.ok(job.sourceCriteriaIssues.includes('unreviewed-native-role-field:requiredProfessionalLicense'));assert.equal(job.sourceCriteriaSchemaKnown,false);
});
for(const [name,mutate]of [['duplicate identity',p=>p.jobs.push(p.jobs[0])],['foreign account',p=>p.jobs[0].absolute_url='https://job-boards.greenhouse.io/other/jobs/'+p.jobs[0].id],['foreign publisher',p=>p.jobs[0].company_name='Other'],['absent full content',p=>delete p.jobs[0].content]])test(name+' is rejected before country selection',()=>{const raw=payload();mutate(raw);assert.throws(()=>sigma.extractNativeJobsFromGreenhousePayload(raw),/Sigma Computing native/)});
test('native meta.total mismatch is rejected by the unchanged strongest engine',async()=>{
 const raw=payload();raw.meta.total=76;await assert.rejects(sigma.run({fetchText:async()=>Buffer.from(fixture().responses[0].bodyBase64,'base64').toString('utf8'),fetchJson:async()=>raw}),/Incomplete greenhouse inventory/);
});
test('audit callback cancellation cannot be swallowed into a partial successful return',async()=>{
 const controller=new AbortController();await assert.rejects(sigma.run({fetchText:async()=>Buffer.from(fixture().responses[0].bodyBase64,'base64').toString('utf8'),fetchJson:boardOnlyJSON(payload()),signal:controller.signal,onAudit:()=>controller.abort()}),{name:'AbortError'});
});
test('77 actual published corporate role IDs remain unreconciled when the native envelope unexpectedly becomes empty',async()=>{
 const raw=payload();raw.jobs=[];raw.meta.total=0;let audit;const jobs=await sigma.run({fetchText:async()=>Buffer.from(fixture().responses[0].bodyBase64,'base64').toString('utf8'),fetchJson:async()=>raw,onAudit:value=>{audit=value}});assert.match(readInventoryEvidence(jobs).reason,/official-role-links-not-reconciled/);assert.equal(audit.employerAdvertisedRoleIds.length,77);assert.equal(audit.unreconciledEmployerRoleIds.length,77);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);
});
test('actual registered Sigma SCRIPT invokes strongest original-envelope engine and retains explicit unknown source scope',async()=>{
 const f=fixture(),raw=payload(),provider=getScraperCatalog().find(p=>p.source==='sigmacomputing'),calls=[];assert.equal(provider.adapter,'script');assert.ok(provider.modulePath.replaceAll('\\','/').endsWith('/sigmacomputing/script.js'));let audit;
 const jobs=await createCatalogScraper(provider).run({fetchText:async url=>{calls.push(url);return Buffer.from(f.responses[0].bodyBase64,'base64').toString('utf8')},fetchJson:async url=>{calls.push(url);return boardOnlyJSON(raw)(url)},onAudit:value=>{audit=value}}),evidence=readInventoryEvidence(jobs);
 assert.equal(jobs.length,0);assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.deepEqual(audit.originalNativePayload,raw);assert.equal(audit.nativeRecords.length,77);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.ok(audit.strongestEngineEvidence);assert.equal(audit.noClosingCaptureClaimed,false);assert.equal(audit.closingInventoryStable,true);assert.equal(calls.filter(url=>url.endsWith('?questions=true')).length,154);assert.deepEqual(calls.filter(url=>!url.endsWith('?questions=true')),[...f.responses.map(r=>r.url),SIGMA_OFFICES_URL,...f.responses.map(r=>r.url),SIGMA_OFFICES_URL,sigma.buildGreenhouseJobsApiUrl()]);assert.equal(audit.nativeDetailFailures.length,77);assert.match(audit.officeFailure,/Historical capture lacks/);assert.equal(readSourceObservationEvidence(jobs,'sigmacomputing')?.observedVacancyCount,77);
});

test('Sigma closing comparison ignores unrelated changing document bytes while retaining all published role identities',async()=>{
 const f=fixture(),html=Buffer.from(f.responses[0].bodyBase64,'base64').toString('utf8');let reads=0,audit;
 await sigma.run({fetchText:async()=>html+(reads++?'<!-- unrelated refreshed document nonce -->':''),fetchJson:boardOnlyJSON(payload()),onAudit:value=>{audit=value}});
 assert.equal(audit.closingInventoryStable,true);
});
