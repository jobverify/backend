import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {run} from './script.js';
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js';

const fixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261030.json.gz',import.meta.url))));
const feed='https://api.ashbyhq.com/posting-api/job-board/baseten';
async function replay(mutator,callback){
 const {responses}=fixture(),calls=[],original=globalThis.fetch;
 globalThis.fetch=async(input,init={})=>{
  const url=String(input),record=responses[url];calls.push(url);assert.ok(record,'Unexpected request: '+url);
  const value={...record,body:Buffer.from(record.bodyBase64,'base64')};mutator?.(value,{url,calls,init});
  const response=new Response(value.body,{status:value.status,headers:{'content-type':value.contentType}});
  Object.defineProperty(response,'url',{value:value.finalUrl});return response;
 };
 try{return await callback(calls)}finally{globalThis.fetch=original}
}

test('current104 complete native descriptions remain audited while47 unreviewed assets and3 JD worksites prevent company zero',async()=>{
 await replay(null,async()=>{const jobs=await run(),evidence=readInventoryEvidence(jobs),audit=jobs.sourceAudit;assert.equal(jobs.length,0);assert.equal(evidence.reportedTotal,104);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.listingComplete,false);assert.equal(audit.nativeCount,104);assert.equal(audit.fullNativeCriteriaCopies,104);assert.equal(audit.fullNativeDetails,101);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.reasons.length,50);assert.equal(audit.reasons.filter(r=>r.startsWith('unreviewed-declared-asset:')).length,47);assert.equal(audit.reasons.filter(r=>r.startsWith('role-owned-description-geography-unresolved:')).length,3);assert.equal(audit.opening.cms.length,105);assert.equal(audit.opening.cmsIds.length,104);assert.equal(audit.opening.unavailable.length,4);assert.equal(audit.closing.unavailable.length,4);assert.equal(audit.opening.native.proofs.flatMap(p=>p.countryProofs.slice(1)).filter(p=>p.countryCode==='CA').length,48);assert.match(audit.opening.strongestEvidence.reason,/provider-source-scope-unresolved/);});
});

for(const field of ['fetchText','fetchPage'])test('body-only '+field+' override is rejected before transport',async()=>{await assert.rejects(run({[field]:async()=>''}),/metadata|body-only|unsupported/i)});
for(const field of ['maxJobs','maxPages'])test('inventory '+field+' caps cannot certify a native subset',async()=>{await assert.rejects(run({[field]:1}),/caps unsupported/i)});

const official='https://www.baseten.co/resources/careers/',board='https://jobs.ashbyhq.com/baseten';
const mutateJSON=(value,fn)=>{const object=JSON.parse(value.body);fn(object);value.body=Buffer.from(JSON.stringify(object))};
test('unknown mandatory raw role fields revoke affected role detail completeness in both phases',async()=>{
 await replay((value,{url})=>{if(url===feed)mutateJSON(value,p=>p.jobs[0].mandatoryProfessionalLicense='Required')},async()=>{const jobs=await run(),audit=jobs.sourceAudit;assert.equal(audit.fullNativeDetails,100);assert.ok(audit.reasons.some(r=>r.startsWith('unknown-role-schema:')));assert.equal(audit.opening.payload.jobs[0].mandatoryProfessionalLicense,'Required');assert.equal(audit.opening.native.proofs[0].fullDetailComplete,false)});
});
test('nested native country metadata cannot conceal new mandatory criteria',async()=>{
 await replay((value,{url})=>{if(url===feed)mutateJSON(value,p=>p.jobs[0].address.postalAddress.addressCountry={mandatoryLicense:'Required'})},async()=>{await assert.rejects(run(),/non-string native location|native/i)});
});
test('criteria drift only on the closing native cohort cannot retain opening detail completeness',async()=>{
 let reads=0;await replay((value,{url})=>{if(url===feed&&++reads===2)mutateJSON(value,p=>p.jobs[0].descriptionHtml+='<p>Mandatory professional license required.</p>')},async()=>{const jobs=await run(),audit=jobs.sourceAudit;assert.equal(audit.fullNativeDetails,100);assert.ok(audit.reasons.includes('native-closing-cohort-or-full-criteria-changed'));assert.notEqual(audit.opening.payload.jobs[0].descriptionHtml,audit.closing.payload.jobs[0].descriptionHtml)});
});
for(const [label,html]of [['hidden script','<script hidden>window.additionalHiring="https://jobs.ashbyhq.com/other"</script>'],['hidden frame','<iframe hidden src="https://jobs.ashbyhq.com/other"></iframe>'],['hidden data','<script type="application/json" hidden>{"mandatoryLicense":"Required"}</script>'],['style','<style>body:after{content:"Additional vacancies"}</style>']])test('new publisher '+label+' retains raw scope and prevents completeness',async()=>{
 await replay((value,{url})=>{if(url===official)value.body=Buffer.from(value.body.toString().replace('</body>',html+'</body>'))},async()=>{const audit=(await run()).sourceAudit;assert.ok(audit.reasons.includes('unreviewed-publisher-whole-dom-flight-or-hiring-scope'));assert.ok(audit.opening.officialBody.includes(html))});
});
test('a modified declared renderer program is not trusted by familiar URL',async()=>{
 await replay((value,{url})=>{if(url.includes('/resources/careers/page-'))value.body=Buffer.concat([value.body,Buffer.from(';window.extraJobs="https://jobs.ashbyhq.com/other";')])},async()=>{const audit=(await run()).sourceAudit;assert.ok(audit.reasons.some(r=>r.startsWith('declared-asset-program-style-or-metadata-changed:')))});
});
test('native root employer mismatch cannot establish corporate identity',async()=>{
 await replay((value,{url})=>{if(url===board)value.body=Buffer.from(value.body.toString().replaceAll('cd6e3ffd-856f-4739-903c-c192a5c1dc54','aaaaaaaa-856f-4739-903c-c192a5c1dc54'))},async()=>{const audit=(await run()).sourceAudit;assert.ok(audit.reasons.includes('native-employer-identity-unavailable'))});
});
test('published stale role becoming active at closing cannot retain an unavailable proof',async()=>{
 let reads=0;const stale=board+'/74b4fde1-d4e9-4080-be05-48adf2b84f6a/';await replay((value,{url})=>{if(url===stale&&++reads===2)value.status=200},async()=>{const audit=(await run()).sourceAudit;assert.ok(audit.reasons.some(r=>r.startsWith('advertised-role-terminal-state-unavailable:')));assert.equal(audit.closing.unavailable.filter(p=>p.error).length,1)});
});
test('non-HTML corporate response does not activate a renderer merely because body bytes match',async()=>{
 await replay((value,{url})=>{if(url===official)value.contentType='text/plain'},async()=>{await assert.rejects(run(),/content type changed/)});
});
test('non-JSON API response cannot certify a structured native inventory',async()=>{
 await replay((value,{url})=>{if(url===feed)value.contentType='text/plain'},async()=>{await assert.rejects(run(),/content type changed/)});
});
test('body-only native JSON override cannot bypass employer/program/HTTP scope guards',async()=>{
 const payload=JSON.parse(Buffer.from(fixture().responses[feed].bodyBase64,'base64'));
 await assert.rejects(run({fetchJson:async()=>payload}),/metadata|body-only|unsupported/i);
});
test('three actual role-owned JD alternative or conflicting worksites remain geography unknown despite native primary US',async()=>{
 await replay(null,async()=>{const audit=(await run()).sourceAudit;assert.equal(audit.fullNativeCriteriaCopies,104);assert.equal(audit.fullNativeDetails,101);assert.equal(audit.nativeCountryScopeUnresolvedRoleIds.length,3);for(const id of ['4dcdf587-38f3-4363-8033-a453f54b38b0','4e507a15-c9bb-4877-b422-f3eb462a3732','b1b5ab31-f90c-41f9-b9f2-13408b1c072b'])assert.ok(audit.nativeCountryScopeUnresolvedRoleIds.includes(id));});
});
test('abort inside the final closing HTTP response cannot resolve as a partial inventory',async()=>{
 const controller=new AbortController(),last=board+'/43b6c299-d5df-4cf4-a816-142ba3014a9d/';let reads=0;
 await replay((value,{url})=>{if(url===last&&++reads===2)controller.abort()},async()=>{await assert.rejects(run({signal:controller.signal}),{name:'AbortError'})});
});
