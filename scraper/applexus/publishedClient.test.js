import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {parseBoundedProgram} from '../../scraper-support/utils/remoteScriptData.js'
import {extractPublishedApplexusClient} from './publishedClient.js'

const redacted=gunzipSync(fs.readFileSync(new URL('./test-data/careers-widget-redacted-20261103.js.gz',import.meta.url))).toString()
const marker='PUBLIC_CLIENT_CREDENTIAL_REDACTED'
// Stop generically before assertion diffs if a fixture ever loses redaction.
try{
 const literals=[]
 const visit=node=>{if(!node||typeof node!=='object')return;if(node.type==='Literal'&&typeof node.value==='string'&&node.value.startsWith('Basic '))literals.push(node.value);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value)}
 visit(parseBoundedProgram(redacted))
 if(literals.length!==2||literals.some(value=>value!=='Basic '+marker))throw Error('redaction')
}catch{throw Error('Applexus test client fixture must remain redacted')}
const listingToken=Buffer.from('anonymous-public-fixture:listing-only').toString('base64')
const formToken=Buffer.from('unused-form-fixture:never-requested').toString('base64')
const current=()=>redacted.replace(marker,listingToken).replace(marker,formToken)
const expected=()=>({authorization:'Basic '+listingToken,apiOrigin:'https://admin.applexus.com',listingPath:'/api/careers_list',pageSize:9,method:'GET'})
const reject=source=>assert.throws(()=>extractPublishedApplexusClient(source),error=>{
 assert.equal(error.message,'Applexus published careers client unavailable or changed')
 assert.equal(error.message.includes(listingToken),false)
 assert.equal(error.message.includes(formToken),false)
 assert.equal(Object.hasOwn(error,'cause'),false)
 assert.equal(Object.hasOwn(error,'authorization'),false)
 return true
})

test('current published Applexus SWR listing module binds its own public GET credential and nine-item pagination',()=>{
 assert.equal(redacted.split(marker).length-1,2)
 assert.deepEqual(extractPublishedApplexusClient(current()),expected())
})

test('the distinct application POST module credential cannot replace the public career-list configuration',()=>{
 const result=extractPublishedApplexusClient(current().replace(formToken,Buffer.from('other-unused-fixture:application').toString('base64')))
 assert.equal(result.authorization,'Basic '+listingToken)
})

test('an explicit unchanged GET method preserves the same read-only client configuration',()=>{
 assert.deepEqual(extractPublishedApplexusClient(current().replace('fetch(e,{headers:','fetch(e,{method:"GET",headers:')),expected())
})

test('reader parses quote and formatting changes without executing webpack modules or fetchers',()=>{
 const source=current().replace('let f=e=>fetch','let /* public listing */ f = e => fetch').replace('"https://admin.applexus.com/"',"'https://admin.applexus.com/'").replace('8190:(e,l,t)=>{','8190:(e,l,t)=>{globalThis.__applexusClientExecuted=true;')
 const before=globalThis.__applexusClientExecuted
 assert.deepEqual(extractPublishedApplexusClient(source),expected())
 assert.equal(globalThis.__applexusClientExecuted,before)
})

for(const[name,before,after]of[
 ['foreign API origin','https://admin.applexus.com/','https://other.example/'],
 ['dynamic API origin','"https://admin.applexus.com/"','window.apiOrigin'],
 ['changed career endpoint','/api/careers_list?location=','/api/application?location='],
 ['changed native limit','.concat(9,"&offset=")','.concat(18,"&offset=")'],
 ['changed offset arithmetic','.concat(9*l)','.concat(18*l)'],
 ['changed pagination renderer','l.total)||0)/9)','l.total)||0)/18)'],
 ['changed POST method','fetch(e,{headers:','fetch(e,{method:"POST",headers:'],
 ['dynamic method','fetch(e,{headers:','fetch(e,{method:window.requestMethod,headers:'],
 ['GET request body','fetch(e,{headers:','fetch(e,{body:undefined,headers:'],
 ['dynamic authorization','Authorization:"Basic '+listingToken+'"','Authorization:window.authorization'],
 ['duplicate authorization','Authorization:"Basic '+listingToken+'"','Authorization:"Basic '+listingToken+'",Authorization:"Basic '+listingToken+'"'],
 ['unbound SWR fetcher',')(l,t),f,{revalidateOnFocus',')(l,t),otherFetcher,{revalidateOnFocus'],
 ['shadowed listing fetcher','var l,t,a;let{data:s,size:r','var f=window.otherFetcher;var l,t,a;let{data:s,size:r'],
 ['shadowed global fetch','8190:(e,l,t)=>{','8190:(fetch,l,t)=>{'],
 ['shadowed SWR import','var l,t,a;let{data:s,size:r','var p=window.otherLibrary;var l,t,a;let{data:s,size:r'],
 ['foreign pagination data','Math.ceil(((null==s||null==(a=s[0])||','Math.ceil(((null==foreign||null==(a=foreign[0])||'],
])test('rejects '+name+' with a generic credential-free error',()=>{
 const original=current(),changed=original.replace(before,after)
 assert.notEqual(changed,original,'Fixture mutation must exercise the intended contract')
 reject(changed)
})

test('duplicate listing configuration is ambiguous even when both credentials are literal',()=>{
 const source=current(),start=source.indexOf('8190:(e,l,t)=>{'),end=source.indexOf('39470:',start)
 assert.ok(start>=0&&end>start)
 const module=source.slice(start,end).replace(/^8190:/,'98190:')
 const duplicate=source.slice(0,end)+module+source.slice(end)
 assert.doesNotThrow(()=>parseBoundedProgram(duplicate))
 reject(duplicate)
})

test('a shadowed country capture cannot turn page indexes into country filters',()=>{
 const source=current().replace('=>((l,t)=>{var a;','=>((e,t)=>{var a;').replace('.concat(9*l)','.concat(9*e)')
 assert.notEqual(source,current())
 reject(source)
})

for(const[scope,declaration]of[
 ['module','function fetch(){}'],['module','class fetch {}'],
 ['module','function Math(){}'],['module','class Math {}'],
 ['intervening function','function f(){}'],['intervening function','class f {}'],
 ['intervening function','function p(){}'],['intervening function','class p {}'],
 ['intervening function','function Math(){}'],['intervening function','class Math {}'],
])test('rejects '+scope+' binding '+declaration+' without executing or exposing configuration',()=>{
 const before=scope==='module'?'8190:(e,l,t)=>{"use strict";':'var l,t,a;let{data:s,size:r'
 const after=scope==='module'?before+declaration:declaration+before
 const original=current(),source=original.replace(before,after)
 assert.notEqual(source,original)
 assert.doesNotThrow(()=>parseBoundedProgram(source))
 reject(source)
})

test('bare string and commented endpoints do not establish an active webpack listing module',()=>{
 reject('/* '+current().slice(0,100)+' */ const note="/api/careers_list?location=";')
 reject('const note="https://admin.applexus.com//api/careers_list?location=";')
})

test('redacted, malformed and oversized input never exposes embedded authorization text',()=>{
 reject(redacted)
 reject(current().slice(0,-10))
 reject('x'.repeat(2_000_001))
 reject(null)
})
