import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const SOURCE='systemtwo',fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),nativeReads=1
mock.method(globalThis,'fetch',async()=>{throw Error('Finally ownership regression prohibits physical network')})
const original=(row,url,status=row.status,headers=row.headers)=>Object.defineProperty(new Response(Buffer.from(row.bodyBase64,'base64'),{status,headers}),'url',{value:row.finalURL??url})
test('finally cleanup must retain exact null, frozen object and Error caller reasons for current native result',async()=>{
 for(const reason of [null,Object.freeze({source:SOURCE,phase:'finally-current'}),new Error(SOURCE+' exact caller reason')]){const caller=new AbortController();let reads=0;await assert.rejects(run({signal:caller.signal,requestIntervalMs:0,fetchImpl:async(url,init)=>{const row=fixture.originals[reads++%fixture.originals.length];assert.equal(url,row.requestedURL);init.signal.addEventListener('abort',()=>caller.abort(reason),{once:true});return original(row,url)}}),error=>error===reason);assert.equal(reads,nativeReads)}
})
test('finally cleanup caller reason must own observed403429and202challenge failures',async()=>{
 for(const [status,extra]of [[403,{}],[429,{}],[202,{'x-amzn-waf-action':'challenge'}]])for(const reason of [null,Object.freeze({source:SOURCE,status})]){const caller=new AbortController();let reads=0;await assert.rejects(run({signal:caller.signal,requestIntervalMs:0,fetchImpl:async(url,init)=>{reads++;const row=fixture.originals[0];init.signal.addEventListener('abort',()=>caller.abort(reason),{once:true});return original(row,url,status,{...row.headers,...extra})}}),error=>error===reason);assert.equal(reads,1)}
})
test('unaborted caller preserves actual native result and observed HTTP over cleanup-only local expiry',async()=>{
 const caller=new AbortController();let reads=0;const operation=run({signal:caller.signal,requestIntervalMs:0,fetchImpl:async(url)=>{const row=fixture.originals[reads++%fixture.originals.length];return original(row,url)}})
 await assert.rejects(operation,error=>error.status===404&&error.failureKind==='parser_or_contract_error');assert.equal(reads,nativeReads);assert.equal(caller.signal.aborted,false)
 for(const status of [403,429]){const clock=performance.now.bind(performance);let offset=0;const cm=mock.method(performance,'now',()=>clock()+offset);try{await assert.rejects(run({signal:caller.signal,sourceTimeoutMs:1000,requestIntervalMs:0,fetchImpl:async(url,init)=>{const row=fixture.originals[0];init.signal.addEventListener('abort',()=>{offset=5000},{once:true});return original(row,url,status)}}),error=>error.status===status&&error.failureKind==='blocked_or_access_denied')}finally{cm.mock.restore()}}
})
