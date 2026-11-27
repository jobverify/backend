import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261125/current-native.json.gz',import.meta.url))))

test('Licious genuine current registered native replay retains all35 published role models and unresolved criteria without manufacturing India coverage',async()=>{
 const counts=new Map(),reads=[]
 const jobs=await run({fetchPage:async(url,init)=>{
  const matches=fixture.responses.filter(packet=>packet.requestedURL===url&&packet.method===(init.method??'GET')&&packet.requestBody===(init.body??null))
  const key=JSON.stringify([url,init.method??'GET',init.body??null]),count=counts.get(key)??0;counts.set(key,count+1)
  const packet=matches[count];assert.ok(packet,'Only retained current native observation '+key+' #'+count)
  const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256);reads.push(packet)
  return{url:packet.responseURL,status:packet.status,contentType:packet.headers['content-type'],body:bytes.toString()}
 }})
 const audit=jobs.nativeCollectionEvidence
 assert.equal(fixture.synthetic,false);assert.equal(reads.length,47);assert.equal(jobs.length,0)
 assert.equal(audit.observations.length,35);assert.equal(audit.closingRecords.length,35)
 assert.deepEqual(audit.observations.map(value=>value.listingRecord),audit.closingRecords)
 assert.ok(audit.observations.every(value=>value.listingRecord&&value.detailRecord))
 assert.equal(audit.reasons.filter(reason=>reason.startsWith('native-role-country-unpublished:')).length,33)
 assert.ok(audit.reasons.includes('full-native-description-unavailable:1617'));assert.ok(audit.reasons.includes('role-employer-scope-unresolved:1557'))
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null)
 assert.equal(readInventoryEvidence(jobs).status,'discovery-only');assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
