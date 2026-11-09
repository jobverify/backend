import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {createCatalogScraper,getScraperCatalog} from '../providers/index.js'
const fixtures=new URL('./test-data/ats-followup-20261107/',import.meta.url)
const rows=JSON.parse(gunzipSync(fs.readFileSync(new URL('makemytrip-native.json.gz',fixtures))))
for(const row of rows){assert.equal(row.status,200);assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)}
const registered=source=>createCatalogScraper(getScraperCatalog().find(row=>row.source===source))

test('registered MakeMyTrip replays all 35 current native India roles with full descriptions and public/open native status',async()=>{
 const requests=[]
 const read=url=>{requests.push(url);const row=rows.find(row=>row.requestUrl===url);assert.ok(row,'Uncaptured current native request '+url);return row.body}
 const jobs=await registered('makemytrip').run({fetchText:async url=>read(url),fetchJson:async url=>JSON.parse(read(url))})
 assert.equal(jobs.length,35)
 assert.equal(requests.length,37)
 assert.ok(jobs.every(job=>job.country==='India'&&job.jobDescription.length>80))
 for(const job of jobs){const packet=rows.find(row=>new URL(row.url).searchParams.get('jobId')===job.jobId);assert.ok(packet);const detail=JSON.parse(packet.body).data;assert.equal(String(detail.job_status).toUpperCase(),'OPEN');assert.equal(detail.location_country,'India')}
})

test('registered Skyscanner stops at the current CAPTCHA redirect without reading the challenge or native board',async()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('skyscanner-redirect.json',fixtures)))
 assert.equal(receipt.status,307)
 assert.equal(new URL(receipt.location,receipt.requestUrl).pathname,'/sttc/px/captcha-v2/index.html')
 const requests=[]
 await assert.rejects(registered('skyscanner').run({fetchImpl:async(url,init)=>{
  requests.push(url);assert.equal(init.redirect,'manual');assert.equal(url,receipt.requestUrl)
  return new Response(receipt.body,{status:receipt.status,headers:{Location:receipt.location,'Content-Type':receipt.contentType}})
 },fetchJson:async()=>assert.fail('A denied employer cannot bind a native job board')}),error=>error.status===307&&error.failureKind==='public_access_denied'&&error.abortRetries===true)
 assert.deepEqual(requests,[receipt.requestUrl])
})


test('registered Tudip preserves 61 current native full India roles with explicit gaps for the other 9',async()=>{
 const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('tudip-native.json.gz',fixtures))))
 const queues=new Map()
 for(const packet of packets){assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256);const queue=queues.get(packet.requestUrl)||[];queue.push(packet);queues.set(packet.requestUrl,queue)}
 const jobs=await registered('tudiptechnologies').run({now:()=> '2026-11-07T06:34:49.882Z',fetchText:async(url,options={})=>{
  const packet=queues.get(url)?.shift();assert.ok(packet,'Unexpected native request '+url)
  return options.includeResponseMetadata?{status:packet.status,url:packet.url,html:packet.body}:packet.body
 }})
 assert.equal(jobs.length,61)
 assert.ok(jobs.every(job=>job.sourceDetailComplete===true&&job.country==='India'&&job.jobDescription.length>80&&job.lifecycleCleanupAllowed===false))
 assert.ok([...queues.values()].every(queue=>queue.length===0))
 for(const job of jobs){assert.equal(job.nativeSchemaIdentifier,job.sourceUrl);assert.ok(Date.parse(job.closingDate)>Date.parse(job.scrapedAt))}
})
