import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261107.json.gz',import.meta.url))))
const io=(change=p=>p)=>{const calls=[],counts=new Map();return{calls,run:()=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='volopay')).run({fetchImpl:async url=>{
 const p=packets.find(p=>p.url===url);assert.ok(p,'Only captured native route '+url);const count=(counts.get(url)||0)+1;counts.set(url,count);calls.push(url)
 const q=change({...p,body:Buffer.from(p.bodyBase64,'base64'),count});const r=new Response(q.body,{status:q.status,headers:{'content-type':q.contentType,...(q.location?{location:q.location}:{})}});Object.defineProperty(r,'url',{value:q.responseUrl||url});return r
 }})}}
test('registered Volopay follows the exact new published jobs.dover.com redirect with the same employer and seven native India roles',async()=>{
 const {run,calls}=io(),jobs=await run();assert.equal(jobs.length,7);assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDescription?.length>200))
 assert.ok(jobs.every(j=>j.applyUrl.startsWith('https://jobs.dover.com/volopay/')&&j.postingDate===null&&j.sourceDateEvidence.nativeCreated))
 assert.equal(calls.filter(u=>u.includes('/application-portal-job/')).length,14);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('current redirect cannot change employer UUID or introduce another host',async()=>{
 for(const location of ['https://foreign.example/dover/careers/ebed3959-fa8a-4719-b143-0730e1223ec8?src=app','https://jobs.dover.com/dover/careers/00000000-0000-4000-8000-000000000000?src=app']){
  const {run,calls}=io(p=>p.status===302?{...p,location}:p);await assert.rejects(run(),/redirect.*identity/i);assert.equal(calls.length,2)
 }
})
test('current Dover closing detail cannot change native full criteria after a stable listing',async()=>{
 const {run}=io(p=>p.url.includes('/application-portal-job/ad404f91-')&&p.count===2?{...p,body:Buffer.from(p.body.toString().replace('Accounts Executive','Changed closing role'))}:p)
 await assert.rejects(run(),/closing|identity|criteria|changed/i)
})
