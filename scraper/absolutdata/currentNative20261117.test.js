import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const original=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))).originals[0]
mock.method(globalThis,'fetch',async()=>{throw Error('Network disabled in original fixture tests')})
test('current original TLS hostname failure remains the cause; never a verified empty inventory',async()=>{
 const cause=Object.assign(Error(original.transportError.causeMessage),{code:original.transportError.causeCode}),error=Object.assign(TypeError(original.transportError.message),{cause});let reads=0
 await assert.rejects(run({requestIntervalMs:0,fetchImpl:async url=>{reads++;assert.equal(url,original.requestedURL);throw error}}),value=>value.cause===error&&value.code==='ERR_TLS_CERT_ALTNAME_INVALID'&&value.lifecycleCleanupAllowed===false&&value.failureKind==='network_or_timeout')
 assert.equal(reads,1)
})
test('legacy timeout observations cannot establish a zero inventory',async()=>{
 await assert.rejects(run({probeUrl:async url=>({url,status:null,html:null,errorKind:'timeout'})}),/metadata|unsupported/i)
})
