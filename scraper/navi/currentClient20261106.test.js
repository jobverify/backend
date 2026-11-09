import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,CAREERS_PAGE_URL,TURBOHIRE_BOARD_URL,ORIGIN,NOAUTH_TOKEN_URL} from './script.js'

globalThis.fetch=()=>{throw Error('OFFLINE_NETWORK_TRIPWIRE')}
const unpack=url=>JSON.parse(gunzipSync(fs.readFileSync(url)))
const capture=unpack(new URL('./test-data/current-client-20261106.json.gz',import.meta.url))
const client=unpack(new URL('../britannia/test-data/current-client-20261106.json.gz',import.meta.url)).client
assert.equal(createHash('sha256').update(client).digest('hex'),capture.clientSHA256)
const clientURL=ORIGIN+capture.clientPath
const exercise=async(change=(body)=>body)=>{
 const reads=[],stop=Object.assign(Error('declared native anonymous API reached'),{publicReadFailure:true,status:403});let error
 try{await run({requestIntervalMs:0,
  fetchPage:async url=>{reads.push(url);const body=url===CAREERS_PAGE_URL?capture.corporate:url===TURBOHIRE_BOARD_URL?capture.board:url===clientURL?client:null;assert.equal(typeof body,'string','only actual declared public resources may be fetched');return{status:200,url,html:change(body,url)}},
  fetchJson:async url=>{reads.push(url);assert.equal(url,NOAUTH_TOKEN_URL);throw stop},
 })}catch(failure){error=failure}
 return{reads,error,stop}
}

test('Navi verifies its genuine current stage2 main before native API access',async()=>{
 const result=await exercise();assert.equal(result.error,result.stop)
 assert.deepEqual(result.reads,[CAREERS_PAGE_URL,TURBOHIRE_BOARD_URL,clientURL,NOAUTH_TOKEN_URL])
})
test('Navi refuses unknown declared program URL before fetching code or native API',async()=>{
 const result=await exercise((body,url)=>url===TURBOHIRE_BOARD_URL?body.replace(capture.clientPath,'/main.00000000000000000000.chunk.js'):body)
 assert.match(result.error.message,/unreviewed current public client URL/);assert.deepEqual(result.reads,[CAREERS_PAGE_URL,TURBOHIRE_BOARD_URL])
})
test('Navi rejects edited current program bytes before anonymous API access',async()=>{
 const result=await exercise((body,url)=>url===clientURL?body+'/*changed*/':body)
 assert.match(result.error.message,/client bytes changed/);assert.ok(!result.reads.includes(NOAUTH_TOKEN_URL))
})
