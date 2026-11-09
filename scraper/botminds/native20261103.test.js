import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {createBotmindsScraper, run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const {captures}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))))
const body=key=>Buffer.from(captures[key].body,'base64').toString('utf8')
const hub='https://www.botminds.ai/careers',slugs=['agentic-software-architect','forward-deployed-engineer','software-architect','solution-architect']
const replay=mutate=>{const calls=new Map();return async url=>{const key=url===hub||url==='https://botminds.ai/careers'?'careers':url.split('/').at(-1),count=(calls.get(key)||0)+1;calls.set(key,count);assert.ok(captures[key],'unexpected native URL '+url);return mutate?.(key,count,body(key))??body(key)}}
test('current official static board returns all four full native criteria with country and publication provenance',async()=>{
 const jobs=await createBotmindsScraper().run({fetchText:replay()})
 assert.equal(jobs.length,4);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,4)
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.requisitionId,null);assert.equal(job.sourceDetailComplete,true);assert.ok(job.jobDescription.length>2000);assert.match(job.jobDescription,/What you bring/);assert.match(job.jobDescription,/What you.ll do/);assert.ok(slugs.includes(job.jobId));assert.equal(job.sourceUrl,hub+'/'+job.jobId);assert.match(job.postingDate,/^2026-07-1[78]$/);assert.equal(job.closingDate,null)}
 const fde=jobs.find(job=>job.jobId==='forward-deployed-engineer');assert.equal(fde.city,null);assert.match(fde.location,/Chennai \+ customer site/)
 assert.ok(jobs[0].nativeCollectionEvidence.closingInventoryMatches)
 assert.ok(jobs[0].jobDescription.length>jobs[0].sourceNativeSchemaSummary.length*5)
})
test('exported production run forwards injected read-only transport and audit callback',async()=>{
 let audit;const jobs=await run({fetchText:replay(),onAudit:value=>{audit=value}});assert.equal(jobs.length,4);assert.equal(audit.extractedDetailJobs,4)
})
test('missing native country preserves full observation and makes source partial without guessing from Chennai',async()=>{
 let audit;const jobs=await createBotmindsScraper().run({fetchText:replay((key,_n,html)=>key===slugs[0]?html.replace('"addressCountry":"IN"','"addressCountry":""'):html),onAudit:value=>{audit=value}})
 assert.equal(jobs.length,3);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(audit.unknownCountryListingCount,1);assert.equal(audit.observedDetails[0].country,null);assert.ok(audit.observedDetails[0].jobDescription.length>2000)
})
test('schema summary cannot substitute for removed visible full criteria',async()=>{
 const jobs=await createBotmindsScraper().run({fetchText:replay((key,_n,html)=>key===slugs[0]?html.replace('class="wrap-narrow prose"','class="summary-only"'):html)})
 assert.equal(jobs.length,3);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('schema title or employer conflict quarantines only its native role',async()=>{
 const jobs=await createBotmindsScraper().run({fetchText:replay((key,_n,html)=>key===slugs[0]?html.replaceAll('"name":"Botminds"','"name":"Other Employer"'):html)})
 assert.equal(jobs.length,3);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('closing removal withholds that role and does not claim a complete board',async()=>{
 const jobs=await createBotmindsScraper().run({fetchText:replay((key,count,html)=>key==='careers'&&count===2?html.replace(/<a class="featured"[\s\S]*?<\/a>/,''):html)})
 assert.equal(jobs.length,3);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.ok(!jobs.some(job=>job.jobId===slugs[0]))
})
test('closing full criteria mutation cannot publish opening criteria as current',async()=>{
 const jobs=await createBotmindsScraper().run({fetchText:replay((key,count,html)=>key===slugs[0]&&count===2?html.replace('What you bring','What the role now requires'):html)})
 assert.equal(jobs.length,3);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('legacy next-data without a current native employer and board identity cannot qualify empty',async()=>{
 await assert.rejects(createBotmindsScraper().run({fetchText:async()=>'<script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>'}),/Botminds native/)
})
test('result cap retains partial evidence after complete board observation',async()=>{
 const jobs=await createBotmindsScraper({maxJobs:2}).run({fetchText:replay()});assert.equal(jobs.length,2);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('read and audit observer are bounded and caller abort is honored',async()=>{
 await assert.rejects(createBotmindsScraper().run({fetchText:()=>new Promise(()=>{}),timeoutMs:25}),/abort|timeout/i)
 await assert.rejects(createBotmindsScraper().run({fetchText:replay(),onAudit:()=>new Promise(()=>{}),timeoutMs:25}),/abort|timeout/i)
 await assert.rejects(createBotmindsScraper().run({fetchText:replay(),signal:AbortSignal.abort(new Error('caller stopped'))}),/caller stopped/)
})
