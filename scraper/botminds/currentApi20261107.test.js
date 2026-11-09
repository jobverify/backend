import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/hard-failures-20261107.json.gz',import.meta.url))))
async function collect(t,change=p=>p){
 const calls=[],seen=new Map();const mock=t.mock.method(globalThis,'fetch',async url=>{
  const p=packets.find(p=>p.url===url);assert.ok(p,'Declared and captured public URL '+url)
  const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),p.bodySHA256)
  const count=(seen.get(url)||0)+1;seen.set(url,count);const q=change({...p,body:bytes,count});calls.push(url)
  const response=new Response(q.body,{status:q.status,headers:{'content-type':q.contentType}});Object.defineProperty(response,'url',{value:q.responseUrl||url});return response
 });try{return {jobs:await createCatalogScraper(getScraperCatalog().find(p=>p.source==='botminds')).run(),calls}}finally{mock.mock.restore()}
}
test('registered Botminds binds the current declared public API and role renderer while retaining complete original criteria',async t=>{
 const {jobs,calls}=await collect(t);assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.country==='India'&&j.city==='Chennai'))
 const associate=jobs.find(j=>j.jobId==='agentic-solutions-associate');assert.ok(associate);assert.match(associate.sourceDescription,/Exceptional ability/);assert.match(associate.sourceDescription,/Complete ownership/)
 assert.equal(associate.postingDate,'2026-11-06');assert.equal(associate.lifecycleCleanupAllowed,false)
 assert.equal(calls.filter(url=>url==='https://www.botminds.ai/api/jobs').length,2)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,3)
})
test('current client byte drift cannot authorize an undocumented recruitment API',async t=>{
 await assert.rejects(collect(t,p=>p.url.includes('index.astro_astro_type_script')?{...p,body:Buffer.from(p.body+';fetch("/undocumented")')}:p),/client|renderer|program/)
})
test('same-slug native detail cannot contradict the public listing country',async t=>{
 await assert.rejects(collect(t,p=>p.url.includes('?slug=agentic-solutions-associate')?{...p,body:Buffer.from(p.body.toString().replace('"country":"IN"','"country":"US"'))}:p),/listing.*detail|role.*changed|identity/)
})
test('closing full inventory changes cannot certify the earlier native criteria',async t=>{
 await assert.rejects(collect(t,p=>p.url==='https://www.botminds.ai/api/jobs'&&p.count===2?{...p,body:Buffer.from(p.body.toString().replace('Exceptional ability','Changed closing criteria'))}:p),/closing|changed/)
})
