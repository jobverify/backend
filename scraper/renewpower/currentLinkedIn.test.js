import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { run as runPower } from './script.js';
import { run as runReNew } from '../renew/script.js';
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js';
const fixture=async name=>fs.readFile(new URL('./fixtures/current-linkedin/'+name+'.html',import.meta.url),'utf8');
const URLS={
 authority:'https://www.renew.com/growth-opportunities',
 alias:'https://www.renew.com/events/renew-unveils-new-brand-identity-as-it-reinforces-leadership-in-providing-decarbonisation-solutions',
 profile:'https://in.linkedin.com/company/renew',
 listing:'https://www.linkedin.com/jobs/renew-jobs-worldwide?f_C=2563081',
};
const fixedNow=()=> '2026-10-09T00:40:00.000Z';
async function fake(extra={}) {
 const pages=new Map(await Promise.all(Object.entries(URLS).map(async([key,url])=>[url,await fixture(key==='alias'?'brand-alias':key)])));
 for(const name of ['india','india-second','foreign']){const html=await fixture(name);const url=html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];assert.ok(url);pages.set(url,html);}
 const seen=[];const fetchPublishedText=async(url,opts={})=>{seen.push(url);opts.signal?.throwIfAborted();if(extra.read)return extra.read(url,pages.get(url),seen);assert.ok(pages.has(url),'Unexpected published URL: '+url);return pages.get(url);};
 return {pages,seen,fetchPublishedText};
}
test('ReNew Power default transport uses currently published strict native authority and returns only verified partial India jobs',async()=>{
 const f=await fake();const original=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{assert.ok(init.signal instanceof AbortSignal);assert.equal(Object.hasOwn(init.headers||{},'signal'),false);return {ok:true,status:200,url:String(url),text:()=>f.fetchPublishedText(String(url))};};
 try{const jobs=await runPower({now:fixedNow});assert.equal(jobs.length,2);assert.deepEqual(jobs.map(j=>j.country),['India','India']);assert.ok(jobs.every(j=>j.source==='renewpower'&&j.sourceListingComplete===false&&j.jobDescription.length>1000));assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null);assert.equal(f.seen.filter(u=>u===URLS.listing).length,2);assert.ok(!f.seen.some(u=>u.startsWith('https://careers.renew.com')));}
 finally{globalThis.fetch=original;}
});
test('ReNew wrapper preserves partial lifecycle evidence and native descriptions',async()=>{
 const f=await fake();const jobs=await runReNew({fetchPublishedText:f.fetchPublishedText,now:fixedNow});
 assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.source==='renew'&&j.country==='India'&&j.sourceListingComplete===false&&j.jobDescription.length>1000));
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null);
});
export {fake,fixture,URLS,fixedNow};

import { readReNewLinkedInCards, readReNewLinkedInDetail } from './publishedLinkedIn.js';
const mutateSchema=(html,change)=>html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,(_,a,b,c)=>{const job=JSON.parse(b);change(job);return a+JSON.stringify(job)+c});
for(const [name,file,transform,pattern] of [
 ['foreign corporate handoff','authority',h=>h.replaceAll('/company/renew','/company/foreign'),/corporate careers/],
 ['unproven old brand alias','alias',h=>h.replace('ReNew Power','Unrelated Power'),/brand alias/],
 ['wrong employer domain','profile',h=>h.replace('"sameAs":"http://renew.com"','"sameAs":"http://foreign.example"'),/website is foreign/],
 ['different encoded company','profile',h=>h.replaceAll('2563081','2563082'),/company2563081/],
 ['missing counted native rows','listing',h=>h.replace('job-count">3','job-count">4'),/truncated/],
 ['foreign card employer','listing',h=>h.replaceAll('/company/renew?','/company/other?'),/foreign-employer/],
 ['listing country unknown','india',h=>mutateSchema(h,j=>j.jobLocation.address.addressCountry='ZZ'),/country is unknown/],
 ['foreign country against India card','india',h=>mutateSchema(h,j=>j.jobLocation.address.addressCountry='US'),/foreign native country/],
 ['direct foreign country against structured India','india',h=>mutateSchema(h,j=>j.country='US'),/contradictory/],
 ['direct India country against structured foreign','foreign',h=>mutateSchema(h,j=>j.country='IN'),/contradictory/],
 ['location object country against structured India','india',h=>mutateSchema(h,j=>j.jobLocation.country='US'),/contradictory/],
 ['foreign native hiring organization','india',h=>mutateSchema(h,j=>j.hiringOrganization.sameAs='https://in.linkedin.com/company/other'),/hiringOrganization/],
 ['malformed native JSON','india',h=>h.replace(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/,'<script type="application/ld+json">HTTP 403 malformed JSON</script>'),/malformed native JSON/],
 ['native ID disagrees','india',h=>h.replace('<!--"4475762928"-->','<!--"4475762929"-->'),/identity/],
 ['future native posting','india',h=>mutateSchema(h,j=>j.datePosted='2027-01-01T00:00:00Z'),/lifecycle/],
 ['missing native active Apply','india',h=>h.replaceAll('job-details-topcard-apply-modal','disabled-application'),/application control/],
 ['native JD conflicts with displayed full JD','india',h=>mutateSchema(h,j=>j.description+=' extra responsibilities'),/full description/],
])test('fails closed for '+name,async()=>{const f=await fake();const key=URLS[file]||[...f.pages.keys()].find(u=>u.endsWith(file==='foreign'?'4445852268':'4475762928'));f.pages.set(key,transform(f.pages.get(key)));await assert.rejects(runPower({fetchPublishedText:f.fetchPublishedText,now:fixedNow}),pattern)});
test('both captured native onsite Apply variants remain accepted',async()=>{const h=(await fixture('india-second')).replace('public_jobs_apply-link-simple_onsite','public_jobs_apply-link-onsite');const c=readReNewLinkedInCards(await fixture('listing'))[1];assert.equal(readReNewLinkedInDetail(h,c,fixedNow()).country,'India')});
test('duplicate canonical native IDs are fatal before any details',async()=>{const f=await fake();const h=f.pages.get(URLS.listing).replaceAll('4471162991','04475762928');f.pages.set(URLS.listing,h);await assert.rejects(runPower({fetchPublishedText:f.fetchPublishedText,now:fixedNow}),/duplicate/);assert.equal(f.seen.filter(u=>u.includes('/jobs/view/')).length,0)});
test('actual listing drift after verified details remains fatal',async()=>{const f=await fake({read:(url,html,seen)=>url===URLS.listing&&seen.filter(x=>x===url).length>1?html.replaceAll('Senior Finance Executive','Changed Finance Executive'):html});await assert.rejects(runPower({fetchPublishedText:f.fetchPublishedText,now:fixedNow}),/changed during traversal/)});
test('one unavailable later detail retains only fresh verified rows and incomplete lifecycle',async()=>{const f=await fake({read:(url,html)=>url.endsWith('4471162991')?Promise.reject(new Error('HTTP 403 for '+url)):html});const jobs=await runPower({fetchPublishedText:f.fetchPublishedText,now:fixedNow});assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'4475762928');assert.equal(jobs[0].sourceListingComplete,false);assert.match(readInventoryEvidence(jobs).reason,/details became unavailable/);assert.equal(f.seen.filter(u=>u.includes('/jobs/view/')).length,2)});
test('unavailable final request preserves only already partial nonempty native rows',async()=>{const f=await fake({read:(url,html,seen)=>url.endsWith('4471162991')||url===URLS.listing&&seen.filter(x=>x===url).length>1?Promise.reject(new Error('HTTP 429 for '+url)):html});const jobs=await runPower({fetchPublishedText:f.fetchPublishedText,now:fixedNow});assert.equal(jobs.length,1);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.match(readInventoryEvidence(jobs).reason,/final-snapshot-unavailable/);assert.ok(jobs.every(j=>j.sourceListingComplete===false))});
test('fully obtained details still require an available final snapshot',async()=>{const f=await fake({read:(url,html,seen)=>url===URLS.listing&&seen.filter(x=>x===url).length>1?Promise.reject(new Error('HTTP 403 for '+url)):html});await assert.rejects(runPower({fetchPublishedText:f.fetchPublishedText,now:fixedNow}),/^Error: HTTP 403/)});
test('caller maxJobs limits actual detail traversal and caps cannot excuse final denial',async()=>{const f=await fake();const jobs=await runPower({fetchPublishedText:f.fetchPublishedText,now:fixedNow,maxJobs:1});assert.equal(jobs.length,1);assert.equal(f.seen.filter(u=>u.includes('/jobs/view/')).length,1);const blocked=await fake({read:(url,html,seen)=>url===URLS.listing&&seen.filter(x=>x===url).length>1?Promise.reject(new Error('HTTP 403 for '+url)):html});await assert.rejects(runPower({fetchPublishedText:blocked.fetchPublishedText,now:fixedNow,maxJobs:1}),/^Error: HTTP 403/)});
test('zero visible cards never authorize empty source inventory or expiry',async()=>{const f=await fake();f.pages.set(URLS.listing,f.pages.get(URLS.listing).replace(/<ul[\s\S]*?<\/ul>/,'<ul class="jobs-search__results-list"></ul>').replace('job-count">3','job-count">0'));await assert.rejects(runPower({fetchPublishedText:f.fetchPublishedText,now:fixedNow}),/no currently verified/)});
test('genuine JSON.parse failure containing HTTP 403 cannot be treated as unavailability',async()=>{const f=await fake({read:(url,html)=>{if(url.endsWith('4471162991'))JSON.parse('HTTP 403 malformed native JSON');return html}});await assert.rejects(runPower({fetchPublishedText:f.fetchPublishedText,now:fixedNow}),SyntaxError)});
test('caller cancellation never falls back to earlier partial rows',async()=>{const controller=new AbortController();const f=await fake({read:(url,html)=>{if(url.endsWith('4471162991')){controller.abort();throw new Error('HTTP 403 for '+url)}return html}});await assert.rejects(runPower({fetchPublishedText:f.fetchPublishedText,now:fixedNow,signal:controller.signal}),e=>e.name==='AbortError')});
test('native transport rejects off-authority redirect with TLS settings untouched',async()=>{const original=globalThis.fetch;globalThis.fetch=async(url,init)=>{assert.equal(init.redirect,'error');assert.equal(init.dispatcher,undefined);assert.equal(init.agent,undefined);assert.equal(Object.hasOwn(init.headers,'signal'),false);return{ok:true,url:'https://foreign.example/',text:async()=>''}};try{await assert.rejects(runPower({now:fixedNow}),/redirect changed/)}finally{globalThis.fetch=original}});

test('unknown or foreign visible region cannot contradict authoritative India country',async()=>{const h=(await fixture('india')).replaceAll('Gurugram, Haryana, India','Gurugram, Brazil');const card=readReNewLinkedInCards((await fixture('listing')).replaceAll('Gurugram, Haryana, India','Gurugram, Brazil'))[0];assert.throws(()=>readReNewLinkedInDetail(h,card,fixedNow()),/visible workplace/)});
test('an expired native role is excluded while other fresh India descriptions remain partial',async()=>{const f=await fake();const key=[...f.pages.keys()].find(x=>x.endsWith('4475762928'));f.pages.set(key,mutateSchema(f.pages.get(key),j=>j.validThrough='2026-10-09T00:00:00Z'));const jobs=await runPower({fetchPublishedText:f.fetchPublishedText,now:fixedNow});assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'4471162991');assert.equal(jobs[0].sourceListingComplete,false)});

const wrapInactive=(html,pattern)=>html.replace(pattern,match=>'<!--'+match+'-->');
for(const [name,file,transform,pattern]of[
 ['commented-out corporate employer handoff','authority',h=>wrapInactive(h,/<a\b[^>]*href="https:\/\/in\.linkedin\.com\/company\/renew"[^>]*>[\s\S]*?<\/a>/),/corporate careers/],
 ['commented-out profile company feed handoff','profile',h=>wrapInactive(h,/<a\b[^>]*href="https:\/\/www\.linkedin\.com\/jobs\/renew-jobs-worldwide[^"]*"[^>]*>[\s\S]*?<\/a>/),/company2563081/],
 ['commented-out native JobPosting schema','india',h=>wrapInactive(h,/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/),/JobPosting schema/],
 ['commented-out native Apply button','india',h=>wrapInactive(h,/<button\b[^>]*data-modal="job-details-topcard-apply-modal"[^>]*>[\s\S]*?<\/button>/),/application control/],
 ['commented-out native canonical','india',h=>wrapInactive(h,/<link\b[^>]*rel="canonical"[^>]*>/),/identity/],
 ['commented-out outer code cannot preserve nested metadata','india',h=>wrapInactive(h,/<code\b[^>]*id="decoratedJobPostingId"[^>]*>[\s\S]*?<\/code>/),/identity/],
])test('fails closed for '+name,async()=>{const f=await fake();const key=URLS[file]||[...f.pages.keys()].find(x=>x.endsWith('4475762928'));const before=f.pages.get(key),after=transform(before);assert.notEqual(before,after,'regression must deactivate an existing current native element');f.pages.set(key,after);await assert.rejects(runPower({fetchPublishedText:f.fetchPublishedText,now:fixedNow}),pattern)});
test('commented-out role cards cannot satisfy the advertised current subset count',async()=>{const f=await fake();f.pages.set(URLS.listing,wrapInactive(f.pages.get(URLS.listing),/<li>[\s\S]*?<\/li>/));await assert.rejects(runPower({fetchPublishedText:f.fetchPublishedText,now:fixedNow}),/truncated/)});
test('conflicting explicit JD workplace remains fatal even when visible and schema descriptions agree',async()=>{const f=await fake();const key=[...f.pages.keys()].find(x=>x.endsWith('4475762928'));let h=f.pages.get(key);h=mutateSchema(h,j=>j.description+='&lt;p&gt;Job Location: Les Ulis, France&lt;/p&gt;');h=h.replace(/(<div class="show-more-less-html__markup[^>]*>[\s\S]*?)(<\/div>)/,'$1<p>Job Location: Les Ulis, France</p>$2');f.pages.set(key,h);await assert.rejects(runPower({fetchPublishedText:f.fetchPublishedText,now:fixedNow}),/JD workplace/)});

test('native Runija M.P. JD agrees with the publisher Ujjain Madhya Pradesh India card',async()=>{
 const html=await fixture('india-state-abbreviation');
 const card={id:'4467971386',title:'Land Acquisition',location:'Ujjain, Madhya Pradesh, India',postingDate:'2026-09-16',sourceUrl:'https://in.linkedin.com/jobs/view/land-acquisition-at-renew-4467971386'};
 const job=readReNewLinkedInDetail(html,card,fixedNow());
 assert.equal(job.country,'India');assert.equal(job.location,card.location);
 assert.match(job.jobDescription,/Location: Runija, M\.P\./);assert.equal(job.sourceListingComplete,false);
});
test('a native locality containing parentheses remains a literal workplace',async()=>{
 let html=(await fixture('india')).replaceAll('Gurugram, Haryana, India','Gurugram (NCR), India').replaceAll('Location : Gurugram','Location : Gurugram (NCR)');
 html=mutateSchema(html,j=>{j.jobLocation.address.addressLocality='Gurugram (NCR)';j.jobLocation.address.addressRegion=null;j.description+='&lt;p&gt;Job Location: Gurugram (NCR)&lt;/p&gt;'});
 html=html.replace(/(<div class="show-more-less-html__markup[^>]*>[\s\S]*?)(<\/div>)/,'$1<p>Job Location: Gurugram (NCR)</p>$2');
 const card=readReNewLinkedInCards((await fixture('listing')).replaceAll('Gurugram, Haryana, India','Gurugram (NCR), India'))[0];
 assert.equal(readReNewLinkedInDetail(html,card,fixedNow()).location,'Gurugram (NCR), India');
});
test('the M.P. abbreviation cannot authorize a different native India state',async()=>{
 let html=await fixture('india');
 html=mutateSchema(html,j=>j.description+='&lt;p&gt;Job Location: Runija, M.P.&lt;/p&gt;');
 html=html.replace(/(<div class="show-more-less-html__markup[^>]*>[\s\S]*?)(<\/div>)/,'$1<p>Job Location: Runija, M.P.</p>$2');
 const card=readReNewLinkedInCards(await fixture('listing'))[0];assert.throws(()=>readReNewLinkedInDetail(html,card,fixedNow()),/JD workplace/);
});

test('the same native state declaration can use MP without periods',async()=>{
 const html=(await fixture('india-state-abbreviation')).replaceAll('Location: Runija, M.P.','Location: Runija, MP');
 const card={id:'4467971386',title:'Land Acquisition',location:'Ujjain, Madhya Pradesh, India',postingDate:'2026-09-16',sourceUrl:'https://in.linkedin.com/jobs/view/land-acquisition-at-renew-4467971386'};
 assert.equal(readReNewLinkedInDetail(html,card,fixedNow()).country,'India');
});
for(const foreign of ['France','US'])test('an M.P. state label cannot override an explicit foreign country '+foreign,async()=>{
 const html=(await fixture('india-state-abbreviation')).replaceAll('Location: Runija, M.P.','Location: Runija, M.P., '+foreign);
 const card={id:'4467971386',title:'Land Acquisition',location:'Ujjain, Madhya Pradesh, India',postingDate:'2026-09-16',sourceUrl:'https://in.linkedin.com/jobs/view/land-acquisition-at-renew-4467971386'};
 assert.throws(()=>readReNewLinkedInDetail(html,card,fixedNow()),/JD workplace/);
});
