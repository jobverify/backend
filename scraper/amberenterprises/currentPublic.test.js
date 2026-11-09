import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const C='https://www.ambergroupindia.com/careers/',N='https://www.naukri.com/amber-enterprises-india-overview-4576343?tab=jobs&src=JDLogo'

test('Amber follows only its exact active employer handoff and preserves native denial without browser fallback',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Offline default HTTP tripwire')})
 const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-public-20261103.json.gz',import.meta.url)))),calls=[];let browserCalls=0
 await assert.rejects(run({fetchPage:async url=>{calls.push(url);if(url===N)return{url,status:403,html:'denied',headers:{'retry-after':'45'}};const row=f.responses.find(row=>row.url===url);assert.ok(row);return{url,status:row.status,html:row.body,headers:row.headers}},fetchBrowserText:async()=>{browserCalls++;throw Error('No denial retry')}}),error=>error.status===403&&error.abortRetries===true&&error.retryDelayMs===45000&&error.inventoryEvidence.reportedTotal===null)
 assert.deepEqual(calls,[C,N]);assert.equal(browserCalls,0)
})
