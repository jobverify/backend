import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {nativePageContract,reviewedNativeClients} from './nativeContract.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/deployment-20261118.json.gz',import.meta.url))))
const posting=JSON.parse(fixture.byteridgeRole.body.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1])
test('current Byteridge coherent public deployment preserves its own India role schema and reviewed complete clients',()=>{
 const value=nativePageContract(fixture.byteridgeRole.body,{JobTitle:posting.title})
 assert.equal(value.publicClientURLs.length,14);assert.equal(value.companyScopeUnqualified,true);assert.deepEqual(value.countries,['India'])
 for(const url of value.publicClientURLs){const packet=fixture.packets.find(p=>new URL(p.url).pathname===new URL(url).pathname);assert.ok(packet,url);assert.equal(reviewedNativeClients[url],packet.sha256)}
})
test('current Byteridge mixed deployment and different employer remain rejected',()=>{
 assert.throws(()=>nativePageContract(fixture.byteridgeRole.body.replace('runtime-main.3227fc0d9e16e672d196.js','runtime-main.22581bcb0af0126ad3a1.js'),{JobTitle:posting.title}),/client version/)
 assert.throws(()=>nativePageContract(fixture.byteridgeRole.body.replaceAll('Byteridge Software Private Limited','Another employer'),{JobTitle:posting.title}),/employer/)
})
