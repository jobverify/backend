import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import {runNative} from '../shared/rmkNativePair.js'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {NATIVE_CONFIG as hersheyConfig} from '../../scraper/hershey.workday/script.js'
import {NATIVE_CONFIG as hubbellConfig} from '../../scraper/hubbell.workday/script.js'
const configs={hershey:hersheyConfig,hubbell:hubbellConfig}
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/rmkNativePair/native-capture.json',import.meta.url),'utf8'))
const read=(source,file)=>{const f=fixture.sources[source][file];assert.ok(f,'Missing captured fixture '+source+'/'+file);const bytes=gunzipSync(Buffer.from(f.gzipBase64,'base64'));assert.equal(bytes.length,f.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);return bytes.toString('utf8')}
const originalFetch=globalThis.fetch
const response=(url,status,{location,html='',onCancel=()=>{},onRead=()=>{}}={})=>({url,status,ok:status>=200&&status<300,headers:new Headers(location===undefined?{}:{location}),body:{cancel:async()=>onCancel()},text:async()=>{onRead();return html}})
function fixtures(source){
 const readFile=f=>read(source,f),map=new Map();let initial=true
 for(const f of Object.keys(fixture.sources[source]).filter(f=>f.endsWith('.json'))){const r=JSON.parse(readFile(f)),body=r.bodyFile??r.hops?.at(-1)?.bodyFile;if(r.requestedURL&&r.status===200&&body)map.set(r.requestedURL,readFile(body))}
 return url=>{if(url===configs[source].origin+'/search/'){const h=readFile(initial?'003-search-hop0.body':'listing-closure-001.body');initial=false;return h}if(url===configs[source].home+'hubbell/en')return readFile('001-home-hop1.body');assert.ok(map.has(url),'Uncaptured stub URL '+url);return map.get(url)}
}
const withFetch=async(stub,work)=>{globalThis.fetch=stub;try{return await work()}finally{globalThis.fetch=originalFetch}}
test('default transport follows observed Hubbell301 manually and keeps complete captured inventory',async()=>{
 const requests=[],read=fixtures('hubbell');let cancelled=0
 const jobs=await withFetch(async(url,options)=>{requests.push(url);assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');assert.ok(options.signal instanceof AbortSignal);return url===configs.hubbell.home?response(url,301,{location:'/hubbell/en',onCancel:()=>cancelled++}):response(url,200,{html:read(url)})},()=>runNative(configs.hubbell,{now:'2026-10-21T23:40:30.384Z'}))
 assert.deepEqual(requests.slice(0,2),['https://www.hubbell.com/','https://www.hubbell.com/hubbell/en']);assert.equal(cancelled,1);assert.equal(jobs.length,19)
})
test('direct Hershey200 default transport still replays full native nine without redirects',async()=>{
 const read=fixtures('hershey');const jobs=await withFetch(async(url,options)=>{assert.equal(options.redirect,'manual');return response(url,200,{html:read(url)})},()=>runNative(configs.hershey,{now:'2026-10-21T23:39:13.532Z'}));assert.equal(jobs.length,9)
})
test('redirect destinations are rejected before a second GET and intermediate body is cancelled',async()=>{
 for(const location of['https://external.example/','https://careers.hubbell.com/','https://www.hubbell.com.evil.example/hubbell/en','https://user:pass@www.hubbell.com/hubbell/en','/login','/auth','/consent','/talentcommunity/apply/1440740000/','/sfcareer/jobreqcareer?jobId=1','/hubbell/en?application=1','http://www.hubbell.com/hubbell/en','http://[broken','/hubbell/en#login','','/']){
  let calls=0,cancelled=0
  await withFetch(async(url,options)=>{calls++;assert.equal(options.redirect,'manual');return response(url,302,{location,onCancel:()=>cancelled++})},async()=>assert.rejects(runNative(configs.hubbell),/redirect|Unapproved|loop|URL|credential/i))
  assert.equal(calls,1,location);assert.equal(cancelled,1,location)
 }
})
test('redirect loops and missing Location stop after bounded reads without reading intermediate text',async()=>{
 for(const missing of[false,true]){let calls=0,cancelled=0
  await withFetch(async(url)=>{calls++;return response(url,301,{location:missing?undefined:calls===1?'/hubbell/en':'/',onCancel:()=>cancelled++,onRead:()=>assert.fail('Intermediate redirect body must not be read')})},async()=>assert.rejects(runNative(configs.hubbell),/redirect|loop|Location/i))
  assert.equal(calls,missing?1:2);assert.equal(cancelled,calls)
 }
})
test('abort between redirect hops stops before destination GET',async()=>{
 const controller=new AbortController();let calls=0,cancelled=0
 await withFetch(async(url)=>{calls++;controller.abort(Error('stop between hops'));return response(url,301,{location:'/hubbell/en',onCancel:()=>cancelled++})},async()=>assert.rejects(runNative(configs.hubbell,{signal:controller.signal}),/stop between hops/))
 assert.equal(calls,1);assert.equal(cancelled,1)
})
test('HTTP failures and request failures remain errors and cancel unread response bodies',async()=>{
 for(const status of[401,403,404,429,500,503]){let calls=0,cancelled=0
  await withFetch(async url=>{calls++;return response(url,status,{onCancel:()=>cancelled++,onRead:()=>assert.fail('HTTP error body is not a native page')})},async()=>assert.rejects(runNative(configs.hubbell),new RegExp('HTTP '+status)))
  assert.equal(calls,1);assert.equal(cancelled,1)
 }
 await withFetch(async()=>{throw Error('network unavailable')},async()=>assert.rejects(runNative(configs.hubbell),/network unavailable/))
})
test('career redirect queries cannot reach auth/application or change inventory scope',async()=>{
 const read=fixtures('hershey')
 for(const location of['/search?auth=1','/search?q=changed','/search?startrow=1&startrow=2','/job/Engineer/1440740000/?application=1']){let calls=0,cancelled=0
  await withFetch(async url=>{calls++;return url===configs.hershey.home?response(url,200,{html:read(url)}):response(url,302,{location,onCancel:()=>cancelled++})},async()=>assert.rejects(runNative(configs.hershey),/redirect query/))
  assert.equal(calls,2);assert.equal(cancelled,1)
 }
})
test('six successive unique native redirects stop at the hop bound and drain all responses',async()=>{
 const read=fixtures('hershey');let calls=0,cancelled=0
 await withFetch(async(url,options)=>{calls++;assert.equal(options.redirect,'manual');return url===configs.hershey.home?response(url,200,{html:read(url)}):response(url,302,{location:'/job/Engineer/'+calls+'/',onCancel:()=>cancelled++})},async()=>assert.rejects(runNative(configs.hershey),/hop bound/))
 assert.equal(calls,7);assert.equal(cancelled,6)
})
test('a final body read failure remains an error and cancellation cannot mask that failure',async()=>{
 let calls=0,cancelled=0
 await withFetch(async url=>{calls++;const r=response(url,200,{onCancel:()=>{cancelled++;throw Error('cancel also failed')}});r.text=async()=>{throw Error('body read failed')};return r},async()=>assert.rejects(runNative(configs.hershey),/body read failed/))
 assert.equal(calls,1);assert.equal(cancelled,1)
})
