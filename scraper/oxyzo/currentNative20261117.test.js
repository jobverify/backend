import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
let wire=async()=>{throw Error('Uncaptured network disabled')};mock.method(globalThis,'fetch',(...args)=>wire(...args))
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),source=await import('./script.js')
test('current Oxyzo corporate declared careers target preserves genuine Wix404 without zero or country promotion',async()=>{
 let reads=0;wire=async(url,init)=>{const p=fixture.originals[reads++];assert.equal(url,p.requestedURL);assert.equal(init.redirect,'manual');const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}
 await assert.rejects(source.run({fetchImpl:wire,requestIntervalMs:0}),error=>error.status===404);assert.equal(reads,2)
})
test('corporate careers handoff drift is held before any unbound target is fetched',async()=>{
 let reads=0;await assert.rejects(source.run({requestIntervalMs:0,fetchImpl:async(url)=>{reads++;assert.equal(reads,1);const p=fixture.originals[0],body=Buffer.from(p.bodyBase64,'base64').toString().replaceAll('https://www.oxyzocareers.in','https://example.org/new-careers'),r=new Response(body,{headers:p.headers});Object.defineProperty(r,'url',{value:url});return r}}),/declared careers target/);assert.equal(reads,1)
})
test('a newly accessible but unreviewed careers carrier cannot become a company zero',async()=>{
 let reads=0;await assert.rejects(source.run({requestIntervalMs:0,fetchImpl:async(url)=>{const p=fixture.originals[reads++],r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:200,headers:p.headers});Object.defineProperty(r,'url',{value:url});return r}}),/newly accessible|not been verified/);assert.equal(reads,2)
})
