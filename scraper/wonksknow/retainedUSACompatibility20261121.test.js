import fs from 'node:fs';
import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {createLegacyWonksknowScraper,createWonksknowScraper,catalog,extractListings} from './script.js';
const digest=value=>createHash('sha256').update(value).digest('hex'),file=new URL('./fixtures/retained-USA-compatibility-20261119.json.gz',import.meta.url),bytes=fs.readFileSync(file);
assert.equal(digest(bytes),'596406c46231f9d1bcba00413485c68a5df92884768e714223f12c4fcd9de0cc');
const retained=JSON.parse(gunzipSync(bytes));
let priorFetch;before(()=>{priorFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('Retained compatibility must not make a live request');};});after(()=>{globalThis.fetch=priorFetch;});
test('separate retained-USA compatibility fixture has3 genuine originals and is not the missing historical HTML suite',()=>{
 assert.equal(retained.responses.length,3);assert.match(retained.purpose,/does not replace/);
 for(const response of retained.responses){assert.equal(digest(Buffer.from(response.bodyBase64,'base64')),response.bodySHA256);assert.equal(response.receipt.status,200);}
 for(const name of['homepage.html','overview.html','job-detail.html'])assert.equal(fs.existsSync(new URL('./fixtures/'+name,import.meta.url)),false);
});
test('explicit legacy factory retains its original3-response USA behavior solely as historical compatibility',async()=>{
 let cursor=0;const jobs=await createLegacyWonksknowScraper().run({fetchText:async url=>{const record=retained.responses[cursor++];assert(record);assert.equal(url,record.receipt.requestedUrl);return Buffer.from(record.bodyBase64,'base64').toString('utf8');},now:()=>retained.responses[2].receipt.startedAt});
 assert.equal(cursor,3);assert.equal(jobs.length,1);assert.equal(jobs[0].title,'Appointment Setter - Education Sales (Part-Time)');assert.match(jobs[0].sourceUrl,/\/wonksknowllc\/view_job_description\?/);
 const overview=Buffer.from(retained.responses[1].bodyBase64,'base64').toString('utf8');assert.equal(extractListings(overview).length,1);
 // The legacy HQ-derived country and reconstructed application behavior are
 // deliberately not promoted as qualified facts for the current collector.
});
test('current factory requires native Responses and its own catalog advertises only the qualified India projection',async()=>{
 let calls=0;await assert.rejects(createWonksknowScraper().run({fetchText:()=>{calls++;return'';}}),/original native Responses required/);assert.equal(calls,0);
 assert.equal(catalog.source,'wonksknow');assert.equal(catalog.companyCareerPage,'https://www.wonksknow.com/');assert.equal(catalog.countryFilter,'India');assert.equal(catalog.sourceScopeComplete,false);assert.equal(catalog.companyIndiaTotal,null);assert.equal(catalog.companyGlobalTotal,null);assert.equal(catalog.lifecycleCleanupAllowed,false);
});
