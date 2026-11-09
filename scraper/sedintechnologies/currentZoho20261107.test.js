import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/hard-failures-20261107.json.gz',import.meta.url))))
async function collect(t,change=p=>p){
 const calls=[],seen=new Map();const mock=t.mock.method(globalThis,'fetch',async url=>{
  calls.push(url);if(url==='https://sedintechnologies.com/career/'){const r=new Response('',{status:200,headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:'https://sedintechnologies.com/careers/'});return r}
  const p=packets.find(p=>p.url===url);assert.ok(p,'Only current declared public URLs '+url)
  const count=(seen.get(url)||0)+1;seen.set(url,count);const q=change({...p,body:Buffer.from(p.bodyBase64,'base64'),count})
  const response=new Response(q.body,{status:q.status,headers:{'content-type':q.contentType}});Object.defineProperty(response,'url',{value:q.responseUrl||url});return response
 });try{return {jobs:await createCatalogScraper(getScraperCatalog().find(p=>p.source==='sedintechnologies')).run(),calls}}finally{mock.mock.restore()}
}
test('registered Sedin follows the current corporate Zoho handoff and excludes locked unpublished native records',async t=>{
 const {jobs,calls}=await collect(t);assert.equal(jobs.length,8);assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDescription?.length>100&&j.lifecycleCleanupAllowed===false))
 assert.ok(!jobs.some(j=>j.jobId==='202020000000735013'));assert.equal(jobs.find(j=>j.jobId==='202020000001855045').postingDate,'2026-10-15')
 assert.ok(calls.includes('https://sedintechnologies.com/careers/'));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('current Sedin recruitment handoff cannot switch to another employer tenant',async t=>{
 await assert.rejects(collect(t,p=>p.url==='https://sedintechnologies.com/careers/'?{...p,body:Buffer.from(p.body.toString().replaceAll('sedintechnologies.zohorecruit.in','foreign.zohorecruit.in'))}:p),/handoff|employer|identity/)
})
test('native Sedin closing full criteria drift cannot publish an earlier verified role',async t=>{
 await assert.rejects(collect(t,p=>p.url.includes('/Job_Openings/202020000001855045?')&&p.count===2?{...p,body:Buffer.from(p.body.toString().replace('SEO Strategist','Changed closing role'))}:p),/closing|identity|changed/)
})
