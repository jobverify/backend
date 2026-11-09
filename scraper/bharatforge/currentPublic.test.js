import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

test('Bharat Forge forwards run options and retains public general-expertise intake without invented job criteria or country',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Offline default HTTP tripwire')})
 const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-public-20261103.json.gz',import.meta.url)))),calls=[];let audit
 const jobs=await run({fetchPage:async url=>{calls.push(url);const row=f.responses.find(row=>row.url===url);assert.ok(row);return{url,status:row.status,html:row.body,headers:row.headers}},onAudit:value=>{audit=value}})
 assert.deepEqual(calls,['https://www.bharatforge.com/careers/careers','https://www.bharatforge.com/careers/careers']);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(audit.observations[0].kind,'general-expertise-resume-intake');assert.equal(audit.observations[0].vacancy,false);assert.equal(audit.observations[0].country,null);assert.equal(audit.observations[0].postingDate,null);assert.equal(audit.observations[0].descriptionComplete,false);assert.equal(audit.observations[0].applicationActionPerformed,false)
})
