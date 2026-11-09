import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createBritanniaScraper, OFFICIAL_CAREERS_URL, BOARD_URL, NOAUTH_TOKEN_URL} from './script.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-client-20261106.json.gz',import.meta.url))))
const currentClient='https://britannia.turbohire.co/main.673138983aeed664d914.chunk.js'
const exercise=async(change=()=>{})=>{
 const reads=[],stop=Object.assign(Error('native public token endpoint reached'),{status:403})
 let error
 try{await createBritanniaScraper().run({requestIntervalMs:0,
  fetchText:async url=>{reads.push(url);const value=url===OFFICIAL_CAREERS_URL?capture.corporate:url===BOARD_URL?capture.board:url===currentClient?capture.client:null;assert.equal(typeof value,'string','request must use a retained native public URL');return change(value,url)??value},
  fetchJson:async url=>{reads.push(url);assert.equal(url,NOAUTH_TOKEN_URL);throw stop},
 })}catch(failure){error=failure}
 return{reads,error,stop}
}

test('Britannia verifies the currently advertised exact client bytes before reaching its declared public native API',async()=>{
 const result=await exercise()
 assert.equal(result.error,result.stop)
 assert.deepEqual(result.reads,[OFFICIAL_CAREERS_URL,BOARD_URL,currentClient,NOAUTH_TOKEN_URL])
})

test('Britannia refuses a changed deployment body before any public token or job reads',async()=>{
 const result=await exercise((value,url)=>url===currentClient?value+'/*changed*/':value)
 assert.match(result.error.message,/client bytes changed/)
 assert.ok(!result.reads.includes(NOAUTH_TOKEN_URL))
})

test('Britannia refuses an unknown advertised main before fetching its code',async()=>{
 const result=await exercise((value,url)=>url===BOARD_URL?value.replace('main.673138983aeed664d914.chunk.js','main.00000000000000000000.chunk.js'):value)
 assert.match(result.error.message,/unreviewed current public client URL/)
 assert.deepEqual(result.reads,[OFFICIAL_CAREERS_URL,BOARD_URL])
})
