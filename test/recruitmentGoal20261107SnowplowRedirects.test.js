import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createCurrentSnowplowScraper} from '../scraper/snowplow/currentNative.js'
import {retained} from '../scraper/snowplow/current.fixture.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const review=JSON.parse(fs.readFileSync(new URL('../scraper/snowplow/reviewedNative.json',import.meta.url)))
const alias=review.resources.find(p=>p.finalUrl&&p.finalUrl!==p.url)
assert.ok(alias,'Original independently reviewed publisher redirect is retained')
function fixture(){const calls=[],count=new Map();return{calls,fetchPage:async url=>{
 calls.push(url)
 if(url===alias.url)return{url,status:302,headers:{location:alias.finalUrl},contentType:'text/css',body:null,bodyComplete:false}
 const key=url===alias.finalUrl?alias.url:url,all=retained.receipts.filter(p=>p.url===key&&p.bodyBase64),at=count.get(key)??0,p=all[Math.min(at,all.length-1)];count.set(key,at+1)
 assert.ok(p,'Retained exact source endpoint only: '+url)
 return{status:p.status,url:url===alias.finalUrl?url:p.finalUrl,contentType:p.contentType,body:await new Response(Buffer.from(p.bodyBase64,'base64')).text()}
}}}
test('Snowplow follows only the exact retained publisher stylesheet redirect and counts both GETs',async()=>{
 const io=fixture(),jobs=await createCurrentSnowplowScraper(io).run()
 const at=io.calls.indexOf(alias.url);assert.ok(at>=0);assert.equal(io.calls[at+1],alias.finalUrl)
 assert.equal(readInventoryEvidence(jobs).pagesFetched,io.calls.length)
})
test('Snowplow page cap stops before the canonical stylesheet redirect GET',async()=>{
 const baseline=fixture();await createCurrentSnowplowScraper(baseline).run()
 const pages=baseline.calls.indexOf(alias.url)+1,io=fixture()
 await assert.rejects(createCurrentSnowplowScraper({...io,maxPages:pages}).run(),e=>e.code==='SNOWPLOW_PAGE_BUDGET')
 assert.equal(io.calls.length,pages);assert.equal(io.calls.at(-1),alias.url);assert.equal(io.calls.includes(alias.finalUrl),false)
})

test('Snowplow rejects the first redirect identity before requesting its reviewed target',async()=>{
 const io=fixture(),load=io.fetchPage
 await assert.rejects(createCurrentSnowplowScraper({fetchPage:async(url,init)=>{const p=await load(url,init);return url===alias.url?{...p,url:'https://wrong.example/redirect'}:p}}).run(),e=>{
  assert.equal(e.code,'SNOWPLOW_NATIVE_INCOMPLETE');assert.equal(io.calls.at(-1),alias.url);assert.equal(io.calls.includes(alias.finalUrl),false);assert.equal(e.retainedNativeResponses.at(-1).response.url,'https://wrong.example/redirect');return true
 })
})
