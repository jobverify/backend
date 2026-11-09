import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'
import {verifyCurrentDocumentActivation,verifyCurrentPublisher} from './currentPublisher.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-publisher-20261106.json.gz',import.meta.url))))
const official=fixture.packets.find(p=>p.requestedURL==='https://gcore.com/careers').body
const expected={softFailure:true,upstreamOutage:false,failureKind:'surface_drift_or_fail_closed'}
const changed=official.replace('<head>','<head><script>/* unreviewed current publisher program */</script>')
assert.notEqual(changed,official)

test('unreviewed whole document programs retain the exact guard failure as typed unresolved drift',()=>{
 assert.throws(()=>verifyCurrentDocumentActivation(changed,'https://gcore.com/careers'),error=>{
  assert.match(error.message,/unreviewed complete document activation programs: https:\/\/gcore\.com\/careers SHA256 [a-f0-9]{64}$/)
  assert.deepEqual(classifyScraperError(error),expected)
  assert.equal(error.incompleteScope,true);assert.equal(error.abortRetries,true)
  assert.equal(error.lifecycleCleanupAllowed,false)
  assert.equal(error.status,undefined);assert.equal(error.statusCode,undefined)
  return true
 })
})

test('registered source stops after the same changed official document and never certifies empty inventory',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='gcore'),calls=[]
 const read=async(url,kind)=>{
  calls.push(url);assert.equal(url,'https://gcore.com/careers','No board, API, retry or alternate route is authorized')
  return kind==='page'?{body:changed,status:200,url,contentType:'text/html'}:changed
 }
 let result
 await assert.rejects(async()=>{result=await createCatalogScraper(provider).run({fetchText:url=>read(url,'text'),fetchPage:url=>read(url,'page'),fetchJson:()=>{throw Error('API must not execute')}})},error=>{
  assert.deepEqual(classifyScraperError(error),expected)
  assert.match(error.message,/unreviewed complete document activation programs/)
  assert.equal(error.lifecycleCleanupAllowed,false);return true
 })
 assert.equal(result,undefined);assert.deepEqual(calls,['https://gcore.com/careers'])
})

test('an unexpected callback exception remains exact and hard rather than becoming publisher drift',async()=>{
 const bug=TypeError('Unexpected implementation exception'),calls=[]
 await assert.rejects(verifyCurrentPublisher({official,verifyNavigation(){},readPage:async url=>{calls.push(url);throw bug}}),error=>error===bug)
 assert.deepEqual(calls,['https://gcore.com/open-positions'])
 assert.equal(classifyScraperError(bug).softFailure,false)
 assert.equal(Object.hasOwn(bug,'failureKind'),false)
})
