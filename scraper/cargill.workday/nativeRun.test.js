import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {runNativeCargill} from './nativeRun.js'
import {HOME,CAREERS,SEARCH,CLIENT,CORE,parseCargillPage,parseCargillOfficialRole} from './nativeContract.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261021.json.gz',import.meta.url)))),now='2026-10-21T03:00:00Z',row=parseCargillPage(f.pages[0],1,81).jobs[0],role=parseCargillOfficialRole(f.roles[0].public.body,row,{now})
const p={hasJobs:true,hasContent:false,filters:'<input type="checkbox" checked data-facet-type="2" data-id="1269750" data-display="India" data-count="1">',results:'<section id="search-results" data-total-results="1" data-total-job-results="1" data-total-pages="1" data-current-page="1" data-records-per-page="15"><a data-job-id="'+row.publicJobId+'" href="'+row.sourceUrl+'"><h3>'+row.title.replace('&','&amp;')+'</h3><span class="job-location">Bengaluru, India</span></a></section>'}
function transport(change){let listed=0;return async(url)=>{let body,finalURL=url;if(url===HOME)body=f.corporate;else if(url===CAREERS){body=f.careers;finalURL=CAREERS+'en'}else if(url===SEARCH)body=f.search.replace('data-count="81"\n', 'data-count="1"\n').replace(/(data-id="1269750"[^>]*data-count=")81"/,'$11"');else if(url===CLIENT)body=f.client;else if(url===CORE)body=f.core;else if(url.startsWith(SEARCH+'/results?')){listed++;body=JSON.stringify(p)}else if(url===row.sourceUrl)body=f.roles[0].public.body;else if(url===role.applicationURL){body=f.roles[0].native.body;finalURL=f.roles[0].native.finalURL}else throw Error('Unexpected URL');const response={status:200,url:finalURL,text:async()=>body};return change?.(response,url,listed)||response}}
test('native country-filter enumeration and full role remain partial for whole-company scope',async()=>{const jobs=await runNativeCargill({fetchImpl:transport(),now});assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'335762');assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].sourceListingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)})
test('HTTP202, cap0 and final inventory drift cannot yield a successful zero',async()=>{await assert.rejects(()=>runNativeCargill({maxJobs:0,fetchImpl:transport(),now}));await assert.rejects(()=>runNativeCargill({fetchImpl:transport(r=>({...r,status:202})),now}));await assert.rejects(()=>runNativeCargill({fetchImpl:transport((r,url,count)=>url.startsWith(SEARCH+'/results?')&&count===2?{...r,text:async()=>JSON.stringify({...p,ERROR:'failure'})}:r),now}))})
test('caller cancellation and uncooperative deadline are bounded',async()=>{const c=new AbortController();c.abort(Error('caller cancelled'));await assert.rejects(()=>runNativeCargill({signal:c.signal,fetchImpl:transport(),now}),/cancelled/);await assert.rejects(()=>runNativeCargill({timeoutMs:20,fetchImpl:()=>new Promise(()=>{}),now}),/deadline/)})
test('final-page caller abort and changed role identity cannot certify a successful result',async()=>{const c=new AbortController();await assert.rejects(()=>runNativeCargill({now,signal:c.signal,fetchImpl:transport((r,url,count)=>{if(count===2&&url.startsWith(SEARCH+'/results?'))c.abort(Error('final-page cancelled'));return r})}),/cancelled/);await assert.rejects(()=>runNativeCargill({now,fetchImpl:transport((r,url,count)=>count===2&&url.startsWith(SEARCH+'/results?')?{...r,text:async()=>JSON.stringify({...p,results:p.results.replaceAll(row.publicJobId,'999999999999')})}:r)}),/inventory drift/)})
for(const[name,target,change]of[
 ['inert full JD',role.applicationURL,s=>s.replace(/(<span\b[^>]*itemprop="description")/,'$1 inert')],
 ['inert native title',role.applicationURL,s=>s.replace(/(<[^>]+itemprop="title")/,'$1 inert')],
 ['inert public JobPosting',row.sourceUrl,s=>s.replace('<script type="application/ld+json"','<script inert type="application/ld+json"')],
 ['inert visible public title',row.sourceUrl,s=>s.replaceAll('<h2','<h2 inert')],
 ['inert corporate handoff',HOME,s=>'<div inert>'+s+'</div>'],
 ['hidden corporate handoff',HOME,s=>'<div hidden>'+s+'</div>'],
 ['inert public apply anchors',row.sourceUrl,s=>s.replaceAll('<a ','<a inert ')],
])test('required active native evidence rejects '+name,async()=>{await assert.rejects(()=>runNativeCargill({now,fetchImpl:transport((r,url)=>url===target?{...r,text:async()=>change(await r.text())}:r)}))})
