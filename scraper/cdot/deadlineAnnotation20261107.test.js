import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/hard-failures-20261107.json.gz',import.meta.url))))
const collect=(change=x=>x)=>{
 const calls=[];return {calls,run:()=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='cdot')).run({minIntervalMs:0,fetchImpl:async url=>{
  const packet=fixture.packets.find(p=>p.url===url);assert.ok(packet,url)
  const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256)
  const body=change({url,body:bytes});calls.push(url)
  const response=new Response(body.body,{status:packet.status,headers:{'content-type':packet.contentType}});Object.defineProperty(response,'url',{value:url});return response
 }})}
}
test('registered C-DOT reconciles the original deadline annotation with the table closing date without changing native role identity',async()=>{
 const io=collect(),jobs=await io.run();assert.equal(jobs.length,1);const job=jobs[0]
 assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,true);assert.equal(job.nativeRoleClosingReconciled,true)
 assert.equal(job.closingDate,'2026-11-13');assert.equal(job.postingDate,null)
 assert.match(job.nativeSourceRecord.listing.title,/Last date for submission extended to 13\/11\/2026/)
 assert.match(job.title,/^Young Professional/);assert.equal(job.numberOfOpenings,5);assert.equal(job.sourceNativePDFPages,17)
 assert.equal(io.calls.length,4);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
})
test('deadline annotation cannot disguise another native post title',async()=>{
 const io=collect(p=>p.url.includes('.php')?{...p,body:Buffer.from(p.body.toString().replace(/Young Professionals - Product Engineering &(?:amp;)? Sustenance\./,'Unrelated Engineering Role.'))}:p)
 await assert.rejects(io.run(),/listed role.*identity conflict/)
})
test('deadline suffix must agree with the separately published native closing calendar date',async()=>{
 const io=collect(p=>p.url.includes('.php')?{...p,body:Buffer.from(p.body.toString().replace('extended to 13/11/2026','extended to 14/11/2026'))}:p)
 await assert.rejects(io.run(),/deadline|identity conflict/)
})
