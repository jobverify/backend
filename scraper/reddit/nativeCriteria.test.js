import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{gunzipSync}from'node:zlib';
import * as reddit from './script.js';
import {readInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js';
import {getScraperCatalog,createCatalogScraper}from'../../scraper-support/providers/index.js';
const fixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261029.json.gz',import.meta.url)))),payload=()=>JSON.parse(Buffer.from(fixture().responses[1].bodyBase64,'base64'));
test('actual foreign native role survives before India selection with publication and full metadata',()=>{
 const raw=payload(),jobs=reddit.extractNativeJobsFromGreenhousePayload(raw),job=jobs.find(j=>j.jobId==='8153017');
 assert.equal(jobs.length,165);assert.equal(job.postingDate,'2026-10-07T05:26:26-04:00');assert.equal(job.sourceUpdatedAt,'2026-10-29T08:15:13-04:00');assert.deepEqual(job.sourceNativeRecord,raw.jobs.find(j=>j.id===8153017));assert.equal(job.legalHiringEmployer,'Reddit Netherlands B.V.');assert.equal(job.company,'Reddit');assert.equal(job.employmentType,null);assert.equal(job.sourceEmploymentCriteria.workerSubType,'Fixed Term');assert.equal(job.sourceEmploymentCriteria.timeType,'Full time');assert.equal(job.sourceEmploymentCriteria.scheduledWeeklyHours,'40.0');assert.equal(job.country,null);
});
test('actual registered script retains global raw criteria and partial strongest engine evidence despite zero India selection',async()=>{
 const f=fixture(),raw=payload(),provider=getScraperCatalog().find(p=>p.source==='reddit');assert.equal(provider.adapter,'script');assert.ok(provider.modulePath.replaceAll('\\','/').endsWith('/reddit/script.js'));
 let audit;const requested=[];const jobs=await createCatalogScraper(provider).run({fetchText:async url=>{requested.push(url);return Buffer.from(f.responses[0].bodyBase64,'base64').toString('utf8')},fetchJson:async url=>{requested.push(url);return raw},onAudit:value=>{audit=value}});
 const evidence=readInventoryEvidence(jobs);assert.equal(jobs.length,0);assert.ok(evidence);assert.equal(evidence.listingComplete,false);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.reportedTotal,null);assert.deepEqual(audit.originalNativePayload,raw);assert.equal(audit.nativeRecords.length,165);assert.equal(audit.lifecycleCleanupAllowed,false);assert.ok(audit.strongestEngineEvidence);assert.equal(audit.noClosingCaptureClaimed,true);assert.deepEqual(requested,fixture().responses.map(r=>r.url));
});
test('all158 actual publication/edit differences use the source publication without mutating the full165 envelope',()=>{
 const raw=payload(),before=JSON.stringify(raw),jobs=reddit.extractNativeJobsFromGreenhousePayload(raw);assert.equal(raw.jobs.filter(j=>j.first_published!==j.updated_at).length,158);for(const [index,job]of jobs.entries()){assert.equal(job.postingDate,raw.jobs[index].first_published);assert.equal(job.sourceUpdatedAt,raw.jobs[index].updated_at);assert.equal(job.sourceNativeContent,raw.jobs[index].content);assert.deepEqual(job.sourceNativeMetadata,raw.jobs[index].metadata)}assert.equal(JSON.stringify(raw),before);
});
test('missing publication stays null while the actual edit timestamp survives separately',()=>{
 const raw=payload();delete raw.jobs[0].first_published;const job=reddit.extractNativeJobsFromGreenhousePayload(raw)[0];assert.equal(job.postingDate,null);assert.equal(job.sourceFirstPublished,null);assert.equal(job.sourceUpdatedAt,raw.jobs[0].updated_at);
});
test('impossible calendar publication does not roll forward or use updated_at',()=>{
 const raw=payload();raw.jobs[0].first_published='2026-09-31T05:26:26-04:00';const job=reddit.extractNativeJobsFromGreenhousePayload(raw)[0];assert.equal(job.postingDate,null);assert.ok(job.sourceCriteriaIssues.includes('invalid-native-first-published'));assert.equal(job.sourceFirstPublished,'2026-09-31T05:26:26-04:00');
});
test('unknown mandatory metadata remains lossless and visibly unreviewed',()=>{
 const raw=payload(),entry={id:9999999,name:'Mandatory Professional License',value:{license:'Required'},value_type:'unreviewed'};raw.jobs[0].metadata.push(entry);const job=reddit.extractNativeJobsFromGreenhousePayload(raw)[0];assert.deepEqual(job.sourceNativeMetadata.at(-1),entry);assert.deepEqual(job.sourceNativeRecord.metadata.at(-1),entry);assert.equal(job.sourceCriteriaReviewComplete,false);assert.ok(job.sourceCriteriaIssues.includes('malformed-native-metadata-entry'));
});
test('new native raw criteria fields are retained without asserting known schema',()=>{
 const raw=payload();raw.jobs[0].mandatoryQualification={license:'Required'};const job=reddit.extractNativeJobsFromGreenhousePayload(raw)[0];assert.deepEqual(job.sourceNativeRecord.mandatoryQualification,{license:'Required'});assert.ok(job.sourceCriteriaIssues.includes('unreviewed-native-role-field:mandatoryQualification'));assert.equal(job.sourceCriteriaReviewComplete,false);
});
test('conflicting legal employer entries stay ambiguous instead of falling back to Reddit publisher',()=>{
 const raw=payload();raw.jobs.find(j=>j.id===8153017).metadata.push({id:9999999,name:'Company',value:'A different legal employer',value_type:'single_select'});const job=reddit.extractNativeJobsFromGreenhousePayload(raw).find(j=>j.jobId==='8153017');assert.equal(job.legalHiringEmployer,null);assert.equal(job.company,'Reddit');assert.equal(job.sourceNativeMetadata.filter(m=>m.name==='Company').length,2);assert.ok(job.sourceCriteriaIssues.includes('repeated-native-metadata-name:Company'));
});
test('actual null employer metadata remains unknown while the source publisher stays Reddit',()=>{
 const raw=payload(),original=raw.jobs.find(j=>j.metadata.some(m=>m.name==='Company'&&m.value===null)),job=reddit.extractNativeJobsFromGreenhousePayload(raw).find(j=>j.jobId===String(original.id));assert.ok(original);assert.equal(job.legalHiringEmployer,null);assert.equal(job.sourcePublisher,'Reddit');
});
for(const [label,mutate]of [['duplicate native identity',p=>p.jobs.push(p.jobs[0])],['foreign board identity',p=>p.jobs[0].absolute_url='https://job-boards.greenhouse.io/other/jobs/'+p.jobs[0].id],['missing content',p=>delete p.jobs[0].content],['foreign publisher',p=>p.jobs[0].company_name='Other']])test(label+' is rejected before India filtering',()=>{const raw=payload();mutate(raw);assert.throws(()=>reddit.extractNativeJobsFromGreenhousePayload(raw),/native|Verified Reddit/)});
test('actual full native meta.total mismatch is rejected by the unchanged strongest runtime',async()=>{
 const raw=payload();raw.meta.total=164;await assert.rejects(reddit.run({fetchText:async()=>Buffer.from(fixture().responses[0].bodyBase64,'base64').toString('utf8'),fetchJson:async()=>raw}),/Incomplete greenhouse inventory/);
});
test('cancellation raised by audit callback cannot return a partial success',async()=>{
 const controller=new AbortController();await assert.rejects(reddit.run({fetchText:async()=>Buffer.from(fixture().responses[0].bodyBase64,'base64').toString('utf8'),fetchJson:async()=>payload(),signal:controller.signal,onAudit:()=>controller.abort()}),{name:'AbortError'});
});
