import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../utils/inventoryEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
const loadModule=()=>import('../../scraper/hanosoftwaresolutions/script.js')
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/hanosoftwaresolutions/test-data/current-native-20261117.json.gz',import.meta.url))))
test('registered Hano default preserves actual parking carrier as unknown employer and company inventory',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='hanosoftwaresolutions');let reads=0
 const jobs=await createCatalogScraper(provider).run({requestIntervalMs:0,fetchImpl:async(url,init)=>{const p=fixture.originals[reads++%2];assert.equal(url,p.requestedURL);assert.equal(init.redirect,'manual');const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}}),e=readInventoryEvidence(jobs)
 assert.deepEqual(jobs,[]);assert.equal(reads,4);assert.equal(e.firstParty,false);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('Hano current runtime refuses metadata-free historical shell callbacks before I/O',async()=>{
 const hano=await loadModule();let calls=0
 await assert.rejects(hano.run({fetchPage:async()=>{calls++;return{status:200,html:'historical body only'}}}),/metadata|unsupported/i);assert.equal(calls,0)
})
test('Hano current DNS failure remains exact and cannot masquerade as an inventory receipt',async()=>{
 const hano=await loadModule(),reason=Object.assign(new Error('fetch failed'),{cause:{code:'ENOTFOUND',message:'getaddrinfo ENOTFOUND www.hanosoftwaresolutions.com'}});let calls=0
 await assert.rejects(hano.run({requestIntervalMs:0,fetchImpl:async()=>{calls++;throw reason}}),error=>error===reason);assert.equal(calls,1)
})
test('Hano current unbound redirect cannot follow another domain or publish zero',async()=>{
 const hano=await loadModule();let calls=0
 await assert.rejects(hano.run({requestIntervalMs:0,fetchImpl:async url=>{calls++;const r=new Response('',{status:302,headers:{location:'https://example.org/','content-type':'text/html'}});Object.defineProperty(r,'url',{value:url});return r}}));assert.equal(calls,1)
})
