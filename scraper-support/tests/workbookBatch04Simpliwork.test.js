import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

test('Simpliwork effective catalog and ordinary adapter qualify genuine current own native publications',async t=>{
 const provider=getScraperCatalog().find(p=>p.source==='simpliwork')
 assert.ok(provider);assert.equal(provider.authoritativeCurrentPublication,true)
 assert.equal(provider.parser,'custom-script');assert.equal(provider.backfillMode,'live-parser')
 assert.equal(provider.companyCareerPage,'https://simpliwork.com/careers/')
 assert.equal(provider.verifiedOn,null);assert.equal(provider.verifiedIndiaJobCount,null)
 const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/simpliwork/fixtures/current-native-20261120.json.gz',import.meta.url)))),counts=new Map(),calls=[]
 t.mock.method(globalThis,'fetch',()=>assert.fail('Fixture replay must not use uncontrolled HTTP'))
 const jobs=await createCatalogScraper(provider).run({now:()=>fixture.observedAt,requestIntervalMs:0,fetchImpl:async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const index=counts.get(url)??0;counts.set(url,index+1);const packet=fixture.responses.filter(p=>p.requestedUrl===url)[index]
  assert.ok(packet,'Only genuine current public URL '+url);calls.push(url)
  return Object.defineProperties(new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers}),{url:{value:packet.url},redirected:{value:false}})
 }})
 assert.equal(calls.length,4);assert.equal(jobs.length,5)
 assert(jobs.every(j=>j.source==='simpliwork'&&j.country==='India'&&!j.sourceDetailComplete&&j.nativePublicJobId===null&&j.requisitionId===null&&!j.lifecycleCleanupAllowed))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
