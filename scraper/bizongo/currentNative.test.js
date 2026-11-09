import test from 'node:test'
import assert from 'node:assert/strict'
import {nativeFixture} from './nativeFixture.js'
import {createBizongoScraper,CAREERS_URL,CAREERS_HANDOFF_URL} from './script.js'
const fixture=nativeFixture(import.meta.url),timeout=value=>new Promise(resolve=>setTimeout(()=>resolve(value),80))
test('ordinary native TLS failure is preserved and audited, never converted into empty jobs',async()=>{
 const reason=Object.assign(new TypeError('fetch failed'),{cause:{code:'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR'}}),reports=[],calls=[]
 await assert.rejects(createBizongoScraper().run({fetchPage:async u=>{calls.push(u);if(u===CAREERS_URL)return fixture.fetchPage(u);throw reason},onAudit:r=>reports.push(r)}),e=>e===reason)
 assert.equal(calls.filter(u=>u===CAREERS_HANDOFF_URL).length,1)
 assert.equal(reports.length,1);assert.equal(reports[0].nativeFailure.code,'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR');assert.equal(reports[0].sourceScopeComplete,false)
})
test('hidden or inert corporate links cannot authorize the unavailable native host',async()=>{
 const html=fixture.get(CAREERS_URL).replaceAll('href="https://careers.bizongo.com/"','hidden href="https://careers.bizongo.com/"'),calls=[]
 await assert.rejects(createBizongoScraper().run({fetchPage:async u=>{calls.push(u);return{status:200,url:u,body:html,html}}}),/handoff/i)
 assert.deepEqual(calls,[CAREERS_URL])
})
test('abort settles an ignoring public reader with the exact caller reason',async()=>{
 const controller=new AbortController(),reason={abort:'bizongo-reader'},promise=createBizongoScraper().run({signal:controller.signal,fetchPage:()=>{controller.abort(reason);return new Promise(()=>{})}})
 assert.equal(await Promise.race([promise.then(()=>null,e=>e),timeout('hung')]),reason)
})
test('failed-handoff audit callback is awaited under caller cancellation',async()=>{
 const controller=new AbortController(),reason={abort:'bizongo-observer'},promise=createBizongoScraper().run({signal:controller.signal,fetchPage:async u=>{if(u===CAREERS_URL)return fixture.fetchPage(u);throw Error('TLS unavailable')},onAudit:()=>{controller.abort(reason);return new Promise(()=>{})}})
 assert.equal(await Promise.race([promise.then(()=>null,e=>e),timeout('hung')]),reason)
})
