import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {run} from './script.js';
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js';
import {buildScrapers} from '../../scraper-support/providers/index.js';
import {resolveZeroJobOutcome} from '../../scraper-support/runner.js';
const receipts=['official-home','native-portal','native-all-openings'].flatMap(name=>JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url))));
const replay=(change=r=>r)=>async url=>{const original=receipts.find(r=>r.url===url);assert.ok(original,'Uncaptured '+url);const r=change({...original});const response=new Response(r.body,{status:r.status});Object.defineProperty(response,'url',{value:r.finalUrl});return response};
const gap=e=>{assert.equal(e.code,'DAILYHUNT_COVERAGE_GAP');assert.equal(e.lifecycleCleanupAllowed,false);assert.equal(e.inventoryEvidence.listingComplete,false);assert.equal(e.inventoryEvidence.reportedTotal,null);return true};
test('official Eterno handoff and unfiltered native empty board require three actual reads',async()=>{
 const fetched=[];const jobs=await run({fetchImpl:async url=>{fetched.push(url);return replay()(url)}});
 assert.equal(fetched.length,3);assert.deepEqual(jobs,[]);
 const e=readInventoryEvidence(jobs);assert.equal(e.status,'verified-empty');assert.equal(e.reportedTotal,0);assert.equal(e.listingComplete,true);assert.equal(e.firstParty,true);
});
test('an inaccessible source or generic loading shell cannot establish empty inventory',async()=>{
 for(const [status,body] of [[403,'Access denied'],[200,'Loading...']])await assert.rejects(run({fetchImpl:async url=>{const r=new Response(body,{status});Object.defineProperty(r,'url',{value:url});return r}}),gap);
});
test('filtered, contradictory or newly positive native results fail closed',async()=>{
 for(const change of [
  body=>body.replace('name="q"','value="Engineer" name="q"'),
  body=>body.replace('</form>','<input hidden name="department" value="engineering"></form>'),
  body=>body.replace('</form>','<input style="display:none" name="department" value="engineering"></form>'),
  body=>body.replace('There are currently no open positions','There are open positions'),
  body=>body.replace('The 0 most recent jobs','The 1 most recent jobs'),
  body=>body.replace('</body>','<a class="jobTitle-link" href="/eterno/job/Engineer/123/">Engineer</a></body>'),
 ])await assert.rejects(run({fetchImpl:replay(r=>r.url.includes('/search/')?{...r,body:change(r.body)}:r)}),gap);
});
test('hidden, inert, template or commented source evidence never authorizes an empty inventory',async()=>{
 for(const wrap of [s=>`<div hidden>${s}</div>`,s=>`<div inert>${s}</div>`,s=>`<template>${s}</template>`,s=>`<!--${s}-->`,s=>`<div style="content-visibility:hidden !important">${s}</div>`]){
  await assert.rejects(run({fetchImpl:replay(r=>({...r,body:wrap(r.body)}))}),gap);
 }
});
test('aggregate deadline bounds uncooperative fetch and body, preserving exact caller cancellation',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async url=>({url,status:200,text:()=>new Promise(()=>{})})])await assert.rejects(run({fetchImpl,timeoutMs:10}),gap);
 for(const before of [true,false]){const c=new AbortController(),reason={before};if(before)c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async()=>{c.abort(reason);return new Promise(()=>{})}}),e=>e===reason)}
});
test('stream overflow cancels before allocating the unbounded body',async()=>{
 let canceled=false,reads=0;
 await assert.rejects(run({fetchImpl:async url=>({url,status:200,body:{getReader:()=>({read:async()=>{reads++;return{done:false,value:new Uint8Array(3000001)}},cancel:async()=>{canceled=true},releaseLock(){}})}})}),gap);
 assert.equal(canceled,true);assert.equal(reads,1);
});
test('a response delivered after caller cancellation has its unopened body cancelled',async()=>{
 const c=new AbortController(),reason={stop:true};let canceled=false;
 await assert.rejects(run({signal:c.signal,fetchImpl:async url=>{const r=new Response(new ReadableStream({cancel(){canceled=true}}));Object.defineProperty(r,'url',{value:url});c.abort(reason);return r}}),e=>e===reason);
 assert.equal(canceled,true);
});
test('original native receipts match gzip, decoded and body hashes',()=>{
 const dir=new URL('./fixtures/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('capture-manifest.json',dir))),sha=b=>createHash('sha256').update(b).digest('hex');
 for(const entry of manifest.files){const stored=fs.readFileSync(new URL(entry.file,dir)),raw=gunzipSync(stored);assert.equal(sha(stored),entry.sha256);assert.equal(sha(raw),entry.uncompressedSha256);const rows=JSON.parse(raw);for(const receipt of entry.responses){const row=rows.find(r=>r.url===receipt.url);assert.equal(row.finalUrl,receipt.finalUrl);assert.equal(row.status,receipt.status);assert.equal(sha(row.body),receipt.bodySHA256)}}
});
test('registered runtime and zero-outcome gate accept only the fresh validated empty board',async()=>{
 const scraper=buildScrapers().find(s=>s.name==='dailyhunt');
 assert.equal(scraper.provider.zeroResultPolicy,'evidence-required');
 const jobs=await scraper.run({fetchImpl:replay()});
 assert.equal(resolveZeroJobOutcome(scraper,jobs,[]),'verified-empty');
 assert.equal(resolveZeroJobOutcome(scraper,[],[]),'unverified-zero');
});
