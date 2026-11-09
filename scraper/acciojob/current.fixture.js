import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
export function retainedFixture(name){return JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+name,import.meta.url))).toString('utf8'))}
export function retainedBody(entry){const bytes=Buffer.from(entry.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256??entry.receipt.sha256);return bytes.toString('utf8')}
const map=retainedFixture('current-keka-real-responses.json.gz').responses
export function transport(change){return async(url,options)=>{const entry=map[url];assert.ok(entry,`unexpected request ${url}`);const text=retainedBody(entry);const body=change?.(url,text,options)??text;return{status:entry.status,url:entry.finalUrl,ok:entry.status===200,headers:{get:name=>name==='location'?entry.location??null:name==='content-type'?entry.contentType??null:null},text:async()=>body}}}
