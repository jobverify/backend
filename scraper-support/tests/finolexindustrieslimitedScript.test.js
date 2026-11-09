import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,createFinolexIndustriesLimitedScraper} from '../../scraper/finolexindustrieslimited/script.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/currentNative20261106C27/capture.json.gz',import.meta.url))))

test('the Finolex public run reads full original native records through an injected metadata transport',async()=>{
 const seen=[],jobs=await run({fetchPage:async(url,init)=>{
  seen.push({url,method:init.method,body:init.body??null})
  const row=capture.responses.find(row=>row.requestedUrl===url);assert.ok(row,'Unexpected original URL '+url)
  return {status:row.status,finalUrl:row.finalUrl,headers:row.headers,body:row.body}
 }})
 assert.equal(jobs.length,14);assert.equal(jobs[0].jobId,'43')
 assert.deepEqual(seen.filter(row=>row.method==='POST').map(row=>row.body),['Activity=joblist','Activity=joblist'])
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
})

test('the Finolex factory rejects body-only legacy responses without original HTTP evidence',async()=>{
 await assert.rejects(createFinolexIndustriesLimitedScraper().run({fetchPage:async()=>({html:'<html>no openings</html>'})}),/original|metadata|entity/i)
})
