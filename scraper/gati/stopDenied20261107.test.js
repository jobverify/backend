import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
const {responses}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/current-declared-client-20261106.json.gz',import.meta.url))))
const listing='https://allcargologistics.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main'
for(const status of [401,403,429])test('registered Gati stops all native reads immediately after public HTTP '+status,async()=>{
 let denied=false,afterDenial=0,listingCalls=0
 await assert.rejects(createCatalogScraper(getScraperCatalog().find(p=>p.source==='gati')).run({fetchImpl:async url=>{
  if(denied)afterDenial++
  const row=responses.find(p=>p.url===url);assert.ok(row,url)
  if(url===listing){denied=true;listingCalls++}
  const response=new Response(url===listing?'Denied':Buffer.from(row.bodyBase64,'base64'),{status:url===listing?status:row.status,
   headers:{...row.headers,'set-cookie':'offline_public_session=synthetic; Path=/'}});Object.defineProperty(response,'url',{value:url});return response
 }}),error=>{assert.equal(error.status,status);assert.equal(error.abortRetries,true);assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.inventoryEvidence.listingComplete,false);return true})
 assert.equal(listingCalls,1);assert.equal(afterDenial,0)
})
