import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {nativeCollection,ownRole} from './data20261107.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/stale-native-model20261110.json.gz',import.meta.url))))
const collection=nativeCollection(fixture.feed.response.body)
const held=collection.jobs.find(row=>row.id===6250757004)

test('current genuine Cribl own model still binds the complete matching collection role',()=>{
 const listing=collection.jobs.find(row=>row.id===6225541004)
 const parsed=ownRole(fixture.matchingOwnRole.response.body,listing)
 assert.equal(parsed.model.id,6225541004)
 assert.equal(parsed.model.title,'Cloud Partner Sales Manager  (Northeast)')
 assert.equal(parsed.model.company_name,'Cribl')
 assert.deepEqual(parsed.model,listing)
 assert.ok(parsed.full.jobDescription.length>1000)
})

for(const [index,label]of ['initial canonical public GET','ordinary HTTP revalidation','public updated_at version query'].entries())test('Cribl holds the genuine country-sensitive stale model after '+label,()=>{
 assert.equal(held.location.name,'Remote - Houston, Texas')
 const packet=fixture.staleOwnRoles[index].response
 assert.equal(packet.status,200)
 assert.throws(()=>ownRole(packet.body,held),error=>error.code==='CRIBL_NATIVE_PROOF'&&/own complete native model conflicts with collection/.test(error.message))
})
