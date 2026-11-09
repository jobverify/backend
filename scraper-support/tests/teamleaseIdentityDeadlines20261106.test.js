import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as teamlease from '../../scraper/teamlease/script.js'
import {createTeamleaseReader} from '../../scraper/teamlease/boundedRead.js'

// Synthetic mutations/models only. The genuine original fixture stays intact;
// no public request, downloaded-program execution or new inventory occurs.
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/teamlease20261106/capture.json.gz',import.meta.url))))
const records=JSON.parse(fixture.documents[teamlease.buildSearchUrl(1)].body)
const row=teamlease.extractSearchResults(records)[0]
const original=fixture.documents[row.sourceUrl].body
const other=records[1]
const now='2026-11-06T09:30:00.000Z'
const block=milliseconds=>{const start=performance.now();while(performance.now()-start<milliseconds){}}
const text='<p>Synthetic public document for a local transport control.</p>'
const response=()=>{const value=new Response(text,{status:200,headers:{'content-type':'text/html'}});Object.defineProperty(value,'url',{value:teamlease.CAREERS_URL});return value}

test('review: an earlier retained hidden body cannot transfer native post identity to a later body',()=>{
 const changed=original.replace(/<body\b[^>]*>/i,opening=>'<body hidden class="single-awsm_job_openings postid-'+other.id+'"></body>'+opening)
 assert.notEqual(changed,original)
 assert.throws(()=>teamlease.extractJobDetail(changed,row,{now}),/TeamLease.*(?:body|post|identity|detail)/i)
})

test('review: a hidden outside-role duplicate application ID cannot own the public application fragment',()=>{
 const shadow='<form hidden id="awsm-application-form" action="https://marcom.teamlease.com/form/submit?formId=12" method="post"><input name="generic-contact"></form>'
 const changed=original.replace(/<body\b[^>]*>/i,opening=>opening+shadow)
 assert.notEqual(changed,original)
 assert.throws(()=>teamlease.extractJobDetail(changed,row,{now}),/TeamLease.*(?:application|form|identity|detail)/i)
})

test('review: an application-form copy in a true HTML template does not own the document fragment',()=>{
 const shadow='<template><form id="awsm-application-form" action="https://marcom.teamlease.com/form/submit?formId=12"></form></template>'
 const changed=original.replace(/<body\b[^>]*>/i,opening=>opening+shadow)
 assert.notEqual(changed,original)
 assert.equal(teamlease.extractJobDetail(changed,row,{now}).applyUrl,row.sourceUrl+'#awsm-application-form')
})

test('review: a20ms header deadline rejects60ms synchronous work after exactly one callback entry',async()=>{
 const page=response()
 let calls=0
 const reader=createTeamleaseReader({requestTimeoutMs:20,sourceTimeoutMs:1000,fetchImpl:()=>{calls++;block(60);return page}})
 try{
  await assert.rejects(reader.read(teamlease.CAREERS_URL),error=>error?.name==='TimeoutError')
  assert.equal(calls,1,'The actual header callback must be entered; pre-entry expiry is not this control')
 }finally{reader.close()}
})

test('review: a20ms body deadline rejects60ms synchronous work after exactly one body read entry',async()=>{
 const bytes=new TextEncoder().encode(text)
 let calls=0
 const page={status:200,url:teamlease.CAREERS_URL,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({
  read(){calls++;if(calls===1){block(60);return Promise.resolve({done:false,value:bytes})}return Promise.resolve({done:true})},
  cancel(){return Promise.resolve()},releaseLock(){},
 })}}
 const reader=createTeamleaseReader({requestTimeoutMs:20,sourceTimeoutMs:1000,fetchImpl:()=>page})
 try{
  await assert.rejects(reader.read(teamlease.CAREERS_URL),error=>error?.name==='TimeoutError')
  assert.equal(calls,1,'The first body read must be entered and expiry must stop before a second read')
 }finally{reader.close()}
})

test('review: the separate source elapsed guard rejects synchronous overrun',async()=>{
 let calls=0
 const reader=createTeamleaseReader({sourceTimeoutMs:20,requestTimeoutMs:1000,fetchImpl:()=>{calls++;block(35);return response()}})
 try{
  await assert.rejects(reader.read(teamlease.CAREERS_URL),error=>error?.name==='TimeoutError')
  assert.equal(calls,1)
 }finally{reader.close()}
})

test('review: SVG template descendants still own document IDs and cannot shadow the application fragment',()=>{
 const shadow='<svg><template><g id="awsm-application-form"></g></template></svg>'
 const changed=original.replace(/<body\b[^>]*>/i,opening=>opening+shadow)
 assert.notEqual(changed,original)
 assert.throws(()=>teamlease.extractJobDetail(changed,row,{now}),/TeamLease.*(?:application|form|identity|detail)/i)
})

test('review: MathML template descendants still own document IDs and cannot shadow the application fragment',()=>{
 const shadow='<math><template><mrow id="awsm-application-form"></mrow></template></math>'
 const changed=original.replace(/<body\b[^>]*>/i,opening=>opening+shadow)
 assert.notEqual(changed,original)
 assert.throws(()=>teamlease.extractJobDetail(changed,row,{now}),/TeamLease.*(?:application|form|identity|detail)/i)
})

for(const shadow of ['<template id="awsm-application-form"></template>',
 '<object><form id="awsm-application-form"></form></object>']){
 test('review: a retained template element or object fallback cannot shadow the application fragment: '+shadow,()=>{
  const changed=original.replace(/<body\b[^>]*>/i,opening=>opening+shadow)
  assert.notEqual(changed,original)
  assert.throws(()=>teamlease.extractJobDetail(changed,row,{now}),/TeamLease.*(?:application|form|identity|detail)/i)
 })
}
