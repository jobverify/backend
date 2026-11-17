import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
let wire=async()=>{throw Error('Uncaptured network disabled')}
mock.method(globalThis,'fetch',(...args)=>wire(...args))
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),source=await import('./script.js')
test('configured Akers employer root preserves actual403 without parked-domain or guessed-route dependency',async()=>{
 let calls=0,consumed=0;const p=fixture.originals[0]
 wire=async(url,init)=>{calls++;assert.equal(url,'https://akersbio.com/');assert.equal(init.redirect,'manual');return{status:p.status,url:p.finalURL,headers:new Headers(p.headers),body:{cancel:async()=>{},getReader(){consumed++;throw Error('Denied body')}}}}
 await assert.rejects(source.run({requestIntervalMs:0,fetchImpl:wire}),error=>error.status===403&&error.failureKind==='blocked_or_access_denied')
 assert.equal(calls,1);assert.equal(consumed,0)
})
