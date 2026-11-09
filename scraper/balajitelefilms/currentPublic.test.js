import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const source='balajitelefilms',C='https://www.balajitelefilms.com/career-opportunity.php'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-public-20261103.json.gz',import.meta.url))))

test('Balaji retains current public email intake without activating commented openings or manufacturing vacancy zero',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Offline default HTTP tripwire')})
 const f=fixture(),calls=[];let audit
 const jobs=await run({fetchPage:async url=>{calls.push(url);const row=f.responses.find(row=>row.url===url);assert.ok(row);return{url,status:row.status,html:row.body,headers:row.headers}},onAudit:value=>{audit=value}})
 assert.deepEqual(calls,[C,C]);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(audit.observations.length,1);assert.equal(audit.observations[0].vacancy,false);assert.equal(audit.observations[0].email,'careers@balajitelefilms.com');assert.equal(audit.activeNativeHandoffs.length,0);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false)
})

test('Balaji bounds ignored supplied readers and preserves caller cancellation identity',async()=>{
 const controller=new AbortController(),reason={opaqueBalaji:true};let seen
 const pending=run({signal:controller.signal,fetchPage:(_url,options)=>{seen=options?.signal;controller.abort(reason);return new Promise(()=>{})}})
 const outcome=await Promise.race([pending.then(()=>null,error=>error),new Promise(resolve=>setTimeout(()=>resolve('unbounded'),80))])
 assert.equal(outcome,reason);assert.equal(seen,controller.signal)
})
