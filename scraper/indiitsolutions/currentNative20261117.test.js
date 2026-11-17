import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,extractOpportunityCards} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
mock.method(globalThis,'fetch',async()=>{throw Error('Uncaptured network disabled in source-backed tests')})
const originals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))).originals
const replay=change=>{let i=0;return{reads:()=>i,fetchImpl:async(url,init)=>{assert.equal(init.redirect,'manual');const p=structuredClone(originals[i++%9]);assert.equal(url,p.requestedURL);change?.(p,i);const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}}}
test('exact current302 and all7declared programmes close without inventing vacancies from marketing',async()=>{
 const io=replay(),jobs=await run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=readInventoryEvidence(jobs),a=jobs.nativeCollectionEvidence
 assert.deepEqual(jobs,[]);assert.equal(io.reads(),18);assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(a.fullNativeClosingEqual,true);assert.deepEqual(a.nativeFooterCareerPreference,{label:'Careers',href:null});assert.equal(a.companyGlobalTotal,null)
})
test('status-only redirect spoof and full closing programme drift cannot pass',async()=>{
 for(const target of [1,10,18]){const io=replay((p,i)=>{if(i!==target)return;if(i===1||i===10)p.status=200;else p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString()+' changed').toString('base64')});await assert.rejects(run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/302|profile|closing/i)}
})
test('historical brief cards and metadata-free callbacks never infer India/full criteria',async()=>{
 const rows=extractOpportunityCards('<article class="indi-role-card"><h3>Analyst</h3><p class="experience">Minimum2years</p><p class="vacancies">2Vacancies</p><a href="#Career">Apply Now</a></article>');assert.equal(rows.length,1);assert.equal(rows[0].country,null);assert.equal(rows[0].location,null)
 await assert.rejects(run({fetchText:async()=>''}),/metadata|unsupported/i)
})
