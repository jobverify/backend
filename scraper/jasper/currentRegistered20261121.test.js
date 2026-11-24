import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {CORPORATE,BOARD,API} from './currentProgrammeRenderer.js'
const fixture=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/'+name,import.meta.url))))
const corporate=fixture('current-corporate-20261121.json.gz'),api=fixture('current-api-20261121.json.gz')
test('Jasper actual registered dispatch consumes retained C/API/C prefix and preserves controlled native board403 without generic fallback',async t=>{
 const provider=getScraperCatalog().find(row=>row.source==='jasper');assert.equal(provider.authoritativeCurrentPublication,true)
 const expected=[CORPORATE,API,CORPORATE,BOARD],calls=[]
 const fetchImpl=async(input,init={})=>{const url=String(input),index=calls.length;calls.push(url);assert.equal(url,expected[index],'Only the measured source prefix and explicit controlled board refusal are allowed');assert.equal(init.method??'GET','GET');const f=url===API?api:corporate,status=index===3?403:200,body=status===403?'Forbidden':Buffer.from(f.bodyBase64,'base64');const response=new Response(body,{status,headers:status===403?{'content-type':'text/html'}:f.receipt.headers});Object.defineProperty(response,'url',{value:url});return response}
 t.mock.method(globalThis,'fetch',fetchImpl)
 let error;try{await createCatalogScraper(provider).run({fetchImpl,requestIntervalMs:0})}catch(e){error=e}
 assert.ok(error);assert.equal(error.status??error.httpStatus,403);assert.equal(error.failureKind,'blocked_or_access_denied');assert.deepEqual(calls,expected)
 const audit=error.nativeCollectionEvidence;assert.equal(audit.currentTransactionQualified,false);assert.equal(audit.currentDeclaredSourceProgramComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.rawPages[0].phase,'opening-C');assert.equal(audit.rawPages[1].phase,'opening-B');assert.equal(audit.rawPages[1].status,403)
})
