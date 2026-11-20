import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {runCurrentNative} from './currentNative20261120.js'
const f=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/failed-first-native-prefix-20261120.json.gz',import.meta.url))))
test('Mastercard native first GET phase reads the original robots text MIME before its exact declared sitemap URL',async()=>{const calls=[],sentinel=Error('sentinel-declared-index');await assert.rejects(runCurrentNative({now:()=>f.observedAt,requestIntervalMs:0,fetchImpl:async(url,init)=>{calls.push(url);if(calls.length===3)throw sentinel;const p=f.responses[calls.length-1];assert.equal(url,p.requestedUrl);assert.equal(init.method,'GET');return Object.defineProperties(new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers}),{url:{value:p.url},redirected:{value:p.redirected}})}}),e=>e===sentinel);assert.equal(calls[2],'https://careers.mastercard.com/us/en/sitemap_index.xml')})
