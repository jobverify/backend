import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {setImmediate as flush} from 'node:timers/promises'
import {createBiofourmisScraper} from '../scraper/biofourmis/native.js'
import {GENERAL} from '../scraper/biofourmis/publicInventory.js'
import {createCurrentGreenhouseScraper} from '../scraper/buildkite/currentNative.js'
import {NATIVE_GREENHOUSE_PROFILES} from '../scraper-support/native-sources/declaredGreenhouse/nativeCareers.js'
const deferred=()=>{let resolve;return{promise:new Promise(r=>{resolve=r}),resolve:value=>resolve(value)}}
for(const source of ['biofourmis','buildkite','tripadvisor'])test(source+': an owned callback cannot start another read after its native read deadline',async t=>{
 const primary=source==='biofourmis'?GENERAL:NATIVE_GREENHOUSE_PROFILES[source].primaryURL
 const fixture=source==='biofourmis'?null:JSON.parse(gunzipSync(readFileSync(new URL('../scraper/'+source+'/test-data/native-current-20261103.json.gz',import.meta.url))))
 const originals=new Map(fixture?.responses.map(r=>[r.url,r])||[])
 const page=url=>{const r=originals.get(url);return r?{url:r.finalUrl,status:r.status,headers:r.headers,bodyBase64:r.bodyBase64}:{url,status:200,headers:{'content-type':'text/html'},bodyBase64:Buffer.from('<html><title>Synthetic callback timing control</title></html>').toString('base64')}}
 const started=deferred(),completion=deferred(),reads=[]
 t.mock.timers.enable({apis:['setTimeout']})
 const fetchPage=url=>{reads.push(url);if(reads.length===1){started.resolve();return completion.promise}return Promise.resolve(page(url))}
 const scraper=source==='biofourmis'?createBiofourmisScraper():createCurrentGreenhouseScraper(source)
 const pending=scraper.run({fetchPage})
 await started.promise;t.mock.timers.tick(15001);await assert.rejects(pending,/native read deadline/)
 completion.resolve(page(primary));await flush();assert.deepEqual(reads,[primary])
})
