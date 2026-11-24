import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-20261121.json.gz',import.meta.url))))

test('the real registered default keeps native rejection and does not replace it with generic recruitment recovery',async t=>{
 const calls=[]
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push(String(url));t.diagnostic('default public request '+calls.length+': '+url)
  assert.equal(options.method??'GET','GET')
  assert.equal(options.redirect,'manual')
  const page=[...fixture.pages,...fixture.assets].find(page=>page.requestedUrl===String(url))
  assert.ok(page,'Native rejection must stop before generic recovery request: '+url)
  return{status:page.status,url:page.url,headers:new Headers(page.headers),text:async()=>page.html}
 })
 t.mock.method(console,'warn',()=>{})
 const provider=getScraperCatalog().find(provider=>provider.source==='techjays')
 await assert.rejects(createCatalogScraper(provider).run(),error=>{
  assert.equal(error.code,'incomplete_location_scope')
  assert.equal(error.diagnostic.unknownJobs.length,1)
  assert.equal(error.nativeCollectionEvidence.boardInventoryComplete,true)
  assert.equal(error.softFailureRecruitmentRecovery,undefined)
  return true
 })
 assert.equal(calls.length,27,'3 original documents +21 directly declared assets +3 closing documents')
})
