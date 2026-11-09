import assert from 'node:assert/strict';import test from 'node:test';
import {createDeHaatScraper} from '../../../scraper/dehaat/script.js';import {createDunzoScraper} from '../../../scraper/dunzo/script.js';
import {createIkyaScraper} from '../../../scraper/ikya/script.js';import {createOdinScraper,extractAshbyJobs} from '../../../scraper/odin/script.js';import {createSigtupleScraper} from '../../../scraper/sigtuple/script.js';
import {buildScrapers,getScraperCatalog} from '../../providers/index.js';import {replay,fixture} from './fixtureReplay.js';
const factories={dehaat:createDeHaatScraper,dunzo:createDunzoScraper,ikya:createIkyaScraper,odin:createOdinScraper,sigtuple:createSigtupleScraper};
for(const [source,factory]of Object.entries(factories))test(source+': original public native GET replay emits original audit and preserves unresolved scope',async()=>{
 const r=replay(),jobs=await factory().run(r.options);assert.equal(r.audits.length,1,'exactly one original-model audit required');assert.equal(r.records.length,1,'detached full observations required');
 const a=r.audits[0];assert.equal(a.source,source);assert.equal(a.sourceScopeComplete,false);assert.equal(a.lifecycleCleanupAllowed,false);assert.equal(a.countryFilter,source==='odin'?'Global':'India');
 assert.equal(jobs.length,0,'retained native-only/company-binding holds are not job candidates');assert.ok(!r.requests.some(u=>u.startsWith('http:')),'HTTP company page withheld');
 if(source==='odin'){assert.equal(a.observations.length,6);assert.ok(a.observations.every(o=>o.country==='United Kingdom'&&o.sourceNativeDetailQualified&&o.requisitionId===null&&o.jobDescription.length>5000));assert.equal(a.opening.originalNativeFeed.jobs.length,6);assert.equal(a.closing.originalNativeFeed.jobs.length,6)}
 else {assert.equal(a.phases.length,2);assert.ok(a.phases.every(p=>Array.isArray(p.records)&&p.records.length===0));assert.equal(a.observations.length,0)}
});
test('registered Odin run forwards original HTTP injection, callbacks and maxJobs=0 without live fallback',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Unexpected live fallback: registered run discarded original injection')};
 try{const r=replay(),s=buildScrapers().find(s=>s.name==='odin'),jobs=await s.run({...r.options,maxJobs:0});assert.equal(jobs.length,0);assert.equal(r.audits.length,1);assert.equal(r.records[0].length,6)}finally{globalThis.fetch=previous}
});
test('Odin public posting ID remains distinct from requisition ID in archive extraction too',()=>{
 const row=fixture.entities.find(e=>e.receipt.url.endsWith('/posting-api/job-board/odin'));const jobs=extractAshbyJobs(JSON.parse(Buffer.from(row.bodyBase64,'base64')));assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId&&j.requisitionId===null));
});
for(const source of Object.keys(factories))test(source+': selected registry metadata clears dated empty-feed verification and denies cleanup',()=>{
 const p=getScraperCatalog().find(p=>p.source===source);assert.equal(p.verifiedOn,null);assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.sourceScopeComplete,false);assert.equal(p.lifecycleCleanupAllowed,false);assert.equal(p.zeroResultPolicy,'coverage-gap');assert.equal(p.countryFilter,source==='odin'?'Global':'India');
});
test('parsed-only injection is rejected before native reads',async()=>{
 let reads=0,live=0;const saved=globalThis.fetch;globalThis.fetch=async()=>{live++;throw Error('Unexpected live fallback')};try{await assert.rejects(createDeHaatScraper().run({fetchJson:async()=>{reads++;return {jobs:[]}}}),/original|provenance/i);assert.equal(reads,0);assert.equal(live,0)}finally{globalThis.fetch=saved}
});
