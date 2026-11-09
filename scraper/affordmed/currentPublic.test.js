import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
test('Affordmed current careers200SPA fallback is never a native empty inventory',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Offline default HTTP tripwire')})
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-public-20261103.json.gz',import.meta.url))));let audit
 await assert.rejects(run({fetchPage:async url=>{const r=fixture.responses.find(r=>r.url===url);assert.ok(r,'Captured declared source URL');return{status:r.status,url:r.finalURL,html:r.body,headers:r.headers}},onAudit:value=>{audit=value}}),error=>error.failureKind==='source_inventory_unavailable'&&error.inventoryEvidence.reportedTotal===null)
 assert.equal(audit.routeProof.careersRouteDeclared,false);assert.equal(audit.routeProof.configuredPathUsesHomeFallback,true);assert.equal(audit.nativeInventoryComplete,false)
})
