import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

test('AVG retains its current empty advertised row as unqualified markup without guessed routes or operational login gates',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Offline default HTTP tripwire')})
 const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-public-20261103.json.gz',import.meta.url)))),calls=[];let audit
 const jobs=await run({fetchPage:async url=>{calls.push(url);const row=f.responses.find(row=>row.url===url);assert.ok(row,'Only a currently declared corporate surface');return{url,status:row.status,html:row.body,headers:row.headers}},onAudit:value=>{audit=value}})
 assert.deepEqual(calls,['https://avglogistics.com/careers','https://avglogistics.com/careers']);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(audit.advertisedJobRow.observedElementCount,0);assert.equal(audit.advertisedJobRow.nativeVacancyCount,null);assert.equal(audit.observations[0].vacancy,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false)
})
