import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import * as adapter from './script.js';
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js';
import {getScraperCatalog,buildScrapers} from '../../scraper-support/providers/index.js';
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-001.json.gz',import.meta.url))));
const API='https://api.smartrecruiters.com/v1/companies/AveryDennison/postings',CORPORATE='https://www.averydennison.com/en/home/careers/search-jobs.html',now=fixture.capturedAt;
const india=fixture.packets.slice(6,33).map(p=>JSON.parse(p.body)),first=india[0];
function transport(mutate=r=>r){const calls=[],counts=new Map();return {calls,fetchImpl:async(url,init)=>{
 assert.equal(init.method,'GET');calls.push(url);const n=counts.get(url)??0;counts.set(url,n+1);
 const packet=fixture.packets.find(p=>p.url===url);assert.ok(url===CORPORATE||packet,'Unadvertised endpoint '+url);
 let response={url,status:200,type:url===CORPORATE?'text/html':'application/json',body:url===CORPORATE?fixture.corporate:packet.body};response=mutate(response,n);
 return {status:response.status,ok:response.status===200,url:response.url,headers:{get:k=>k==='content-type'?response.type:null},text:async()=>response.body};
}};}
function jsonMutation(fn,predicate=(url=>url.startsWith(API))){return transport((r,n)=>{if(predicate(r.url)){const p=JSON.parse(r.body);fn(p,r.url,n);r.body=JSON.stringify(p);}return r;});}

test('current complete advertised public feed hydrates 27 active typed-India full JDs and keeps native provenance',async()=>{
 const t=transport(),jobs=await adapter.run({...t,now});assert.equal(jobs.length,27,'Sentinel must be replaced by full native extraction');
 for(const j of jobs){const d=india.find(d=>d.id===j.jobId);assert.ok(d);assert.equal(j.source,'averydennison');assert.equal(j.title,d.name);assert.equal(j.country,'India');assert.equal(j.city,d.location.city);assert.equal(j.location,d.location.fullLocation);assert.equal(j.sourceUrl,d.postingUrl);assert.equal(j.applyUrl,d.applyUrl);assert.equal(j.postingDate,d.releasedDate);assert.equal(j.nativeReleasedDate,d.releasedDate);assert.equal(j.nativePublicationDate,d.releasedDate);assert.equal(j.nativeFirstPublicationDate,null);assert.equal(j.nativeUpdatedAt,null);assert.equal(j.nativeClosingDate,null);assert.equal(j.nativeLegalEmployer,null);assert.equal(j.sourceDetailComplete,true);assert.equal(j.sourceScopeComplete,false);assert.equal(j.sourceListingComplete,false);assert.equal(j.sourceIndiaJobCount,null);assert.equal(j.sourceGlobalJobCount,null);assert.equal(j.sourceObservedNativeIndiaRecords,27);assert.equal(j.sourceObservedNativeRecords,484);assert.equal(j.scrapedAt,now);assert.equal(j.applicationAccessValidated,false);assert.equal(j.applicationEligibilityQualified,false);assert.equal(j.applicationSubmitted,false);assert.equal(j.remoteStatus,d.location.remote?'Remote':d.location.hybrid?'Hybrid':'On-site');for(const s of Object.values(d.jobAd.sections))if(s.text?.trim())assert.ok(j.jobDescription.includes(s.text),'Full native section must be retained');}
 assert.equal(t.calls.length,67);assert.ok(t.calls.every(url=>!url.includes('jobs.smartrecruiters.com')));const e=readInventoryEvidence(jobs);assert.equal(e.status,'coverage-gap');assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null);
});
test('corporate inline client must retain exact native API and tenant binding in executable active script',async()=>{
 for(const change of [s=>s.replace('company: "AveryDennison"','company: "Other"'),s=>s.replace('apiBase: "https://api.smartrecruiters.com/v1/companies"','apiBase: "https://example.com"'),s=>'<template>'+s+'</template>']){const t=transport(r=>r.url===CORPORATE?{...r,body:change(r.body)}:r);await assert.rejects(adapter.run({...t,now}));}
});
test('duplicate IDs, incomplete page, offset mismatch, excessive totals and malformed release fail closed',async()=>{
 for(const change of [p=>p.content[1].id=p.content[0].id,p=>p.content.pop(),p=>p.offset=1,p=>p.totalFound=5000,p=>p.totalFound='484',p=>p.content[0].releasedDate='yesterday',p=>p.content[0].company.identifier='Other',p=>p.content[0].visibility='INTERNAL']){const t=jsonMutation(p=>change(p),u=>u===API+'?limit=100&offset=0');await assert.rejects(adapter.run({...t,now}));}
});
test('typed country conflicts including custom native Country/Region cannot be overridden by India labels',async()=>{
 for(const change of [r=>r.location.country=null,r=>r.location.country='us',r=>r.location.fullLocation='Delhi, United States',r=>r.customField.find(f=>f.fieldId==='COUNTRY').valueId='us',r=>r.customField.find(f=>f.fieldLabel==='Country of vacancy').valueLabel='United States']){const t=jsonMutation(p=>{if(p.content){const row=p.content.find(r=>r.id===first.id);if(row)change(row);}else if(p.id===first.id)change(p);});await assert.rejects(adapter.run({...t,now}));}
});
test('detail must preserve exact title, tenant, ID, location, release and active public identity',async()=>{
 for(const change of [d=>d.name+=' changed',d=>d.id='123',d=>d.company.identifier='Other',d=>d.location.city='Mumbai',d=>d.releasedDate='2026-10-20T00:00:00.000Z',d=>d.active=false,d=>d.visibility='INTERNAL',d=>d.postingUrl=d.postingUrl.replace('/AveryDennison/','/Other/'),d=>d.applyUrl='https://example.com/apply']){const t=jsonMutation(change,u=>u===API+'/'+first.id);await assert.rejects(adapter.run({...t,now}));}
});
test('missing, instruction-only or closed role content stays a failure including closure in additional information',async()=>{
 for(const change of [d=>d.jobAd.sections.jobDescription.text='',d=>d.jobAd.sections.jobDescription.text='<p>'+('Please click apply now to see the full job description. ').repeat(30)+'</p>',d=>d.jobAd.sections.jobDescription.text+='<p>This position is closed.</p>',d=>d.jobAd.sections.additionalInformation.text+='<p>This role is closed.</p>']){const t=jsonMutation(change,u=>u===API+'/'+first.id);await assert.rejects(adapter.run({...t,now}));}
});
test('late listing or detail drift and detail HTTP failure invalidate whole extraction',async()=>{
 for(const kind of ['listing','detail','status']){const t=transport((r,n)=>{if(n===1&&r.url===(kind==='listing'?API+'?limit=100&offset=0':API+'/'+first.id)){if(kind==='status')r.status=403;else{const p=JSON.parse(r.body);if(kind==='listing')p.content[0].name+=' changed';else p.jobAd.sections.qualifications.text+='<p>Changed</p>';r.body=JSON.stringify(p);}}return r;});await assert.rejects(adapter.run({...t,now}));}
});
test('scoped native empty remains coverage-gap with unknown company counts',async()=>{
 const t=jsonMutation(p=>{p.totalFound=0;p.content=[];},u=>u.startsWith(API+'?'));const jobs=await adapter.run({...t,now});assert.equal(jobs.length,0);const e=readInventoryEvidence(jobs);assert.equal(e?.status,'coverage-gap');assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null);
});
test('bad transport, timeout and truncation cannot produce qualified zero',async()=>{
 for(const mutation of [r=>({...r,status:403}),r=>({...r,url:'https://example.com'}),r=>({...r,type:'text/plain'})])await assert.rejects(adapter.run({...transport(mutation),now}));
 await assert.rejects(adapter.run({...transport(),now,maxJobs:1}));await assert.rejects(adapter.run({fetchImpl:()=>new Promise(()=>{}),timeoutMs:20,now}));
});
test('unrelated foreign country contradictions remain explicit exclusions while all India evidence agrees',async()=>{
 const jobs=await adapter.run({...transport(),now});assert.equal(jobs.length,27);assert.equal(jobs[0].sourceExcludedNativeCountryConflicts.length,7);assert.ok(jobs[0].sourceExcludedNativeCountryConflicts.every(r=>r.country!=='in'&&r.customCountry!=='in'));
});
test('cross-page duplicates and late terminal drift cannot qualify a complete native extraction',async()=>{
 for(const kind of ['duplicate','terminal']){const t=jsonMutation((p,url,n)=>{if(kind==='duplicate'&&p.offset===100)p.content[0]=JSON.parse(fixture.packets[0].body).content[0];if(kind==='terminal'&&p.offset===484&&n===1)p.totalFound++;},u=>u.startsWith(API+'?'));await assert.rejects(adapter.run({...t,now}),/Duplicate native ID across pages|page size|terminal|total/i);}
});
test('native UTC release age stays subject to unchanged one-calendar-month publication filter',async()=>{
 const jobs=await adapter.run({...transport(),now}),metrics=analyzePublishableJobs(jobs,{now:new Date(now)});assert.equal(jobs.length,27);assert.equal(metrics.eligibleJobs.length,14);assert.equal(metrics.filterCounts.old,13);assert.ok(jobs.every(j=>j.nativeReleasedDate===j.postingDate&&j.nativeCreatedAt===null&&j.scrapedAt!==j.nativeReleasedDate));
});
test('optional absent/null native sections preserve all remaining substantive content',async()=>{
 for(const key of ['qualifications','additionalInformation']){const t=jsonMutation(d=>{delete d.jobAd.sections[key];},u=>u===API+'/'+first.id);const jobs=await adapter.run({...t,now});assert.equal(jobs.length,27);assert.ok(jobs[0].jobDescription.includes(first.jobAd.sections.jobDescription.text));}
});
test('source059 changes one effective provider while preserving unknown counts and protected lifecycle scope',()=>{
 const all=getScraperCatalog(),p=all.find(p=>p.source==='averydennison');assert.equal(all.filter(row=>row.source==='averydennison').length,1);assert.equal(p.companyDomain,'averydennison.com');assert.equal(p.atsPlatform,'smartrecruiters-public-postings');assert.match(p.modulePath,/averydennison.workday[\\/]script.js$/);for(const k of ['verifiedOn','verifiedAt','verifiedPublicJobCount','verifiedIndiaJobCount'])assert.equal(p[k],null);assert.equal(p.sourceScopeComplete,false);assert.equal(p.zeroResultPolicy,'coverage-gap');assert.ok(buildScrapers().some(s=>s.name==='averydennison'));
});
test('AD059-R1 quoted archive and nonexecuted client bodies cannot bind current recruitment',async()=>{
 const fragments=['const CONFIG = { company: "AveryDennison", apiBase: "https://api.smartrecruiters.com/v1/companies"','`${CONFIG.apiBase}/${CONFIG.company}/postings?limit=${limit}&offset=${offset}`','`${CONFIG.apiBase}/${CONFIG.company}/postings/${encodeURIComponent(id)}`'];
 const fake='<html><script>const archivedSource = ['+fragments.map(s=>"'"+s+"'").join(',')+']; const CONFIG={company:"Other",apiBase:"https://example.invalid"};</script></html>';
 const client=[...fixture.corporate.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(m=>m[1]).find(s=>s.includes('const CONFIG = {'));
 assert.ok(client);
 const mutants=[fake,'<script>if(false){'+client+'}</script>','<script>function archivedClient(){'+client+'}</script>','<script type="application/json">'+client+'</script>','<script nomodule>'+client+'</script>','<script type="module">'+client+'</script>','<script>'+client+'</script><script>'+client+'</script>','<script>'+client+'\n// client revision requires requalification</script>','<script src="">'+client+'</script>'];
 for(const html of mutants){assert.throws(()=>adapter.parseBinding(html),/corporate client/i);const t=transport(r=>r.url===CORPORATE?{...r,body:html}:r);await assert.rejects(adapter.run({...t,now}),/corporate client/i);}
});
test('AD059-R2 company boilerplate and explicitly partial role descriptions cannot be marked full',async()=>{
 for(const replacement of [d=>d.jobAd.sections.companyDescription.text,d=>d.jobAd.sections.companyDescription.text+'<p>Read more.</p>',d=>d.jobAd.sections.jobDescription.text.slice(0,700)+'</p><p>This job description is truncated. Read more to view the full job description.</p>',d=>d.jobAd.sections.jobDescription.text+'<p>Job description excerpt. Click to read the full job description.</p>',d=>d.jobAd.sections.companyDescription.text.repeat(2)]){const t=jsonMutation(d=>d.jobAd.sections.jobDescription.text=replacement(d),u=>u===API+'/'+first.id);await assert.rejects(adapter.run({...t,now}),/boilerplate|truncat|excerpt|incomplete/i);}
});
test('AD059-R1 residual classic type and legacy language precedence matches executable JavaScript',async()=>{
 const client=[...fixture.corporate.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(m=>m[1]).find(s=>s.includes('const CONFIG = {'));assert.ok(client);
 for(const attrs of ['language="vbscript"','language="json"','language="text/javascript"','language=" javascript "','type="application/json" language="javascript"','type=" " language="javascript"']){const html='<script '+attrs+'>'+client+'</script>';assert.throws(()=>adapter.parseBinding(html),/corporate client/i);const t=transport(r=>r.url===CORPORATE?{...r,body:html}:r);await assert.rejects(adapter.run({...t,now}),/corporate client/i);assert.equal(t.calls.length,1);}
 for(const attrs of ['','language=""','language="javascript"','language="JAVASCRIPT"','language="javascript1.5"','language="ecmascript"','type="" language="vbscript"','type="" language="json"','type="text/javascript" language="vbscript"','type="application/javascript" language="json"','type=" text/javascript " language="vbscript"']){const html='<script '+attrs+'>'+client+'</script>';assert.equal(adapter.parseBinding(html),API);const t=transport(r=>r.url===CORPORATE?{...r,body:html}:r);const jobs=await adapter.run({...t,now});assert.equal(jobs.length,27);assert.equal(t.calls.length,67);}
});
