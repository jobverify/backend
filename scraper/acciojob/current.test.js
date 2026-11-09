import test from 'node:test'
import assert from 'node:assert/strict'
import {createAcciojobScraper} from './script.js'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const responses=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-public-20261103.json.gz',import.meta.url)))).responses
const transport=change=>async(url,options)=>{const e=responses[url];assert.ok(e,'reviewed public URL');const body=change?.(url,e.body,options)??e.body;const r=new Response(body,{status:e.status,headers:{'content-type':e.contentType}});Object.defineProperty(r,'url',{value:e.finalUrl});return r}
test('acciojob traverses current official handoff and complete native API inventory',async()=>{const jobs=await createAcciojobScraper().run({fetchImpl:transport(),requestIntervalMs:0});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs)?.status,'coverage-gap');})
test('acciojob does not certify complete source scope after another renderer channel appears',async()=>{const jobs=await createAcciojobScraper().run({fetchImpl:transport((url,body)=>url.includes('/api/embedjobs/js/')?body+`;document.body.insertAdjacentHTML('beforeend','<a href="https://jobs.ashbyhq.com/another">More roles</a>');`:body),requestIntervalMs:0});assert.equal(readInventoryEvidence(jobs)?.listingComplete,false);assert.equal(readInventoryEvidence(jobs)?.reportedTotal,null)})
test('Accio retains unknown employer totals for the real own mentor channel while proving the separate employee board',async()=>{const result=await createAcciojobScraper().collect({fetchImpl:transport()});assert.equal(result.nativeEmployeeBoard.listingComplete,true);assert.equal(result.nativeEmployeeBoard.reportedTotal,0);assert.equal(readInventoryEvidence(result.jobs)?.listingComplete,false);assert.equal(readInventoryEvidence(result.jobs)?.reportedTotal,null);assert.match(readInventoryEvidence(result.jobs)?.reason,/mentor/)})
