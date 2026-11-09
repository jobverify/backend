import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {runNativeExperion} from './nativeRun.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {HOME,CAREERS,CLIENT} from './nativeContract.js'
const f=JSON.parse(fs.readFileSync(new URL('./fixtures/native-20261021.json',import.meta.url)))
const one=f.listing.replace(/<a\b[^>]*class="career-job-row"[^>]*>[\s\S]*?<\/a>/g,s=>s.includes('/jobs/test-lead/')?s:'')
function options(mutate=()=>{}){const calls=[];return{now:'2026-10-21T00:20:00Z',timeoutMs:5000,calls,fetchImpl:async url=>{calls.push(url);const response={status:200,url,text:async()=>url===HOME?f.homepage:url===CAREERS?one:url===CLIENT?f.client:f.detail};mutate(response,calls);return response}}}
test('native current listing plus role details and stable final listing reconciles',async()=>{const jobs=await runNativeExperion(options());assert.equal(jobs.length,1);assert.equal(jobs[0].sourceListingComplete,true);assert.equal(readInventoryEvidence(jobs).listingComplete,true)})
test('explicit cap zero preserves known positive count and incomplete evidence',async()=>{const jobs=await runNativeExperion({...options(),maxJobs:0});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).reportedTotal,1);assert.equal(readInventoryEvidence(jobs).listingComplete,false)})
test('unbounded remote alongside actual native India offices preserves partial scope',async()=>{const opt=options(r=>{const get=r.text;r.text=async()=> (await get()).replaceAll('Hybrid, Kochi, Trivandrum','Remote, Kochi, Trivandrum')});const jobs=await runNativeExperion(opt);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].sourceListingComplete,false);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')})
for(const status of [202,403,500])test('native HTTP'+status+' never certifies empty',async()=>assert.rejects(runNativeExperion(options(r=>r.status=status))))
test('redirected native role cannot retain original identity',async()=>assert.rejects(runNativeExperion(options(r=>{if(r.url.includes('/jobs/'))r.url='https://other.example/'}))))
test('final stable listing must retain title and role identities',async()=>assert.rejects(runNativeExperion(options((r,c)=>{if(r.url===CAREERS&&c.filter(x=>x===CAREERS).length===2)r.text=async()=>one.replaceAll('Test Lead','Changed')}))))
test('abort after final response rejects',async()=>{const controller=new AbortController();await assert.rejects(runNativeExperion({...options((r,c)=>{if(r.url===CAREERS&&c.filter(x=>x===CAREERS).length===2)controller.abort(new Error('caller abort'))}),signal:controller.signal}),/abort/)})
