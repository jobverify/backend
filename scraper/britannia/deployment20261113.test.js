import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {verifyBritanniaPublicClient} from './publicClient.js'
const fixture=name=>gunzipSync(readFileSync(new URL('./test-data/deployment-20261113/'+name+'.gz',import.meta.url))).toString('utf8')
const url='https://britannia.turbohire.co/main.aa5b044542056e5c6e59.chunk.js'
test('November 13 Britannia advertised deployment retains its reviewed public jobs service',async()=>{
 const calls=[]
 const result=await verifyBritanniaPublicClient({boardHTML:fixture('board'),fetchScript:async requested=>{calls.push(requested);return fixture('main')}})
 assert.deepEqual(calls,[url]);assert.equal(result.apiBaseURL,'https://thapi-stage2.azurewebsites.net')
 assert.equal(result.sha256,'50a44f5a5be38ad3738a63a19ebf2bc3b4b65ebb2dbe0e01be4c7e69349c4dda')
})
test('November 13 Britannia deployment still rejects altered public client bytes',async()=>{
 await assert.rejects(verifyBritanniaPublicClient({boardHTML:fixture('board'),fetchScript:async()=>fixture('main')+'/* unexpected */'}),/client bytes changed/)
})
