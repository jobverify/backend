import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as byte from '../../scraper/byteridge/nativeContract.js'
import * as mono from '../../scraper/monocept/nativeContract.js'
import {run as runByte} from '../../scraper/byteridge/script.js'
import {run as runMono} from '../../scraper/monocept/script.js'
import {nativeOptions as byteOptions} from '../../scraper/byteridge/fixtures/options.js'
import {nativeOptions as monoOptions} from '../../scraper/monocept/fixtures/options.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

const unpack=url=>JSON.parse(gunzipSync(fs.readFileSync(url)))
const current=unpack(new URL('./fixtures/turboHireBuild20261106/capture.json.gz',import.meta.url))
const oldByte=unpack(new URL('../../scraper/byteridge/test-inputs/native-shell-20261031.json.gz',import.meta.url))
const oldMono=unpack(new URL('../../scraper/monocept/test-inputs/native-build-20261031.json.gz',import.meta.url))
const sha=b=>createHash('sha256').update(b).digest('hex')
const packets=new Map()
for(const p of current.packets){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(b.length,p.bytes);assert.equal(sha(b),p.sha256);assert.equal(p.status,200);assert.ok(!packets.has(p.requestedUrl));packets.set(p.requestedUrl,{...p,body:b.toString('utf8')})}
const newFiles=['runtime-main.a3801c5ec8c75a558b86.js','18.0a0a3f53b49041744779.chunk.js','30.812b9abed47cf2099f54.chunk.js','main.bc8f2fdf0fa9e74f4468.chunk.js','24.52ad9596a317e0433e77.chunk.js','40.3ec75e9eb87caff145b7.chunk.js']
const scriptFiles=newFiles.slice(0,4)
const currentByte=packets.get(oldByte.url)
const currentMono=packets.get(mono.BOARD_URL)
const oldCases=[['Byteridge',oldByte.body,html=>byte.nativePageContract(html,{JobTitle:'Sr. SDE (Dot Net)'})],['Monocept',oldMono.shell.body,mono.nativeShellContract]]

test('current fixture retains18 exact original public entities and no substituted incomplete main body',()=>{
 assert.equal(packets.size,18);assert.equal(current.incompleteBodiesNotInvented.length,1)
 assert.equal(current.incompleteBodiesNotInvented[0].status,200)
 assert.equal(current.incompleteBodiesNotInvented[0].bodyUnavailable,true)
 assert.equal(packets.get(mono.NATIVE_ORIGIN+'/'+newFiles[3]).bytes,10425980)
})
test('current original Monocept native board binds the exact newly declared four-script set with unqualified company scope',()=>{
 const result=mono.nativeShellContract(currentMono.body)
 assert.deepEqual(result.clientURLs,scriptFiles.map(f=>mono.NATIVE_ORIGIN+'/'+f))
 assert.deepEqual(result.publicClientURLs,newFiles.map(f=>mono.NATIVE_ORIGIN+'/'+f))
 assert.equal(result.companyScopeUnqualified,true)
})
test('current original historically published Byteridge role binds the new client without changing typed country or employer',()=>{
 const result=byte.nativePageContract(currentByte.body,{JobTitle:'Sr. SDE (Dot Net)'})
 assert.deepEqual(result.clientURLs,scriptFiles.map(f=>byte.NATIVE_ORIGIN+'/'+f))
 assert.deepEqual(result.publicClientURLs,newFiles.map(f=>byte.NATIVE_ORIGIN+'/'+f))
 assert.equal(result.companyScopeUnqualified,true)
 assert.equal(result.posting.hiringOrganization.name,'Byteridge Software Private Limited')
 assert.deepEqual(result.countries,['India'])
})
for(const [source,html,parse]of [['Monocept',currentMono.body,mono.nativeShellContract],['Byteridge',currentByte.body,value=>byte.nativePageContract(value,{JobTitle:'Sr. SDE (Dot Net)'})]]){
 test(source+' rejects synthetic authored integrity that can prevent the reviewed main program from executing',()=>{
  const changed=html.replace('<script src="/main.bc8f2fdf0fa9e74f4468.chunk.js">','<script integrity="sha512-AAAA" src="/main.bc8f2fdf0fa9e74f4468.chunk.js">')
  assert.notEqual(changed,html)
  assert.throws(()=>parse(changed),/client version|execution drift/i)
 })
}
for(const [name,origin,validate]of [['Byteridge',byte.NATIVE_ORIGIN,(url,body)=>{assert.equal(byte.reviewedNativeClients[url],sha(body))}],['Monocept',mono.NATIVE_ORIGIN,mono.clientContract]]){
 test(name+' current six original programs each retain the exact pinned whole-entity digest',()=>{
  for(const file of newFiles){const p=packets.get(origin+'/'+file);assert.ok(p);validate(p.requestedUrl,p.body)}
 })
}

// Mount controls below mutate supported genuine October31 bodies only. They
// reproduce the old guard independently of accepting the new client version.
for(const [source,html,parse]of oldCases){
 test(source+' genuine older native body remains supported',()=>assert.doesNotThrow(()=>parse(html)))
 for(const [name,prefix]of [
  ['hidden base','<base hidden href="https://unreviewed.invalid/">'],
  ['inert base','<base inert href="https://unreviewed.invalid/">'],
  ['base under a hidden ancestor','<section hidden><base href="https://unreviewed.invalid/"></section>']
 ])test(source+' rejects a synthetic '+name+' that can change native client resolution',()=>{
  const changed=html.replace('<div id="root">',prefix+'<div id="root">');assert.notEqual(changed,html)
  assert.throws(()=>parse(changed),/base/i)
 })
 test(source+' ignores a synthetic base in a separate template fragment',()=>{
  const changed=html.replace('<div id="root">','<template><base href="https://unreviewed.invalid/"></template><div id="root">');assert.notEqual(changed,html)
  assert.doesNotThrow(()=>parse(changed))
 })
 for(const [name,prefix]of [
  ['hidden earlier root','<div hidden id="root"></div>'],
  ['inert earlier root','<div inert id="root"></div>'],
  ['inert ancestor of earlier root','<section inert><div id="root"></div></section>'],
  ['CSS-hidden earlier root','<div style="display:none" id="root"></div>'],
  ['non-div earlier root','<span id="root">Wrong container</span>'],
  ['template element itself owns earlier ID','<template id="root"><span>Unused</span></template>']
 ])test(source+' rejects a synthetic '+name+' that owns the actual first mount',()=>{
  const changed=html.replace('<div id="root">',prefix+'<div id="root">');assert.notEqual(changed,html)
  assert.throws(()=>parse(changed),/root/i)
 })
 for(const [name,prefix]of [
  ['template-fragment child','<template><div id="root"></div></template>'],
  ['noscript raw fallback','<noscript><div id="root"></div></noscript>']
 ])test(source+' ignores a synthetic '+name+' outside document mount authority',()=>{
  const changed=html.replace('<div id="root">',prefix+'<div id="root">');assert.notEqual(changed,html)
  assert.doesNotThrow(()=>parse(changed))
 })
 test(source+' keeps a later hidden duplicate from replacing the first active mount',()=>{
  const changed=html.replace('<div id="root"></div>','<div id="root"></div><div hidden id="root"></div>');assert.notEqual(changed,html)
  assert.doesNotThrow(()=>parse(changed))
 })
}

// Complete historical source cohorts remain historical. Only their public
// script src values below are synthetically substituted with the current set.
const replaceScripts=html=>html.replace(/(?:runtime-main\.[a-f0-9]+\.js|18\.[a-f0-9]+\.chunk\.js|main\.[a-f0-9]+\.chunk\.js)/g,value=>value.startsWith('runtime-main.')?newFiles[0]:value.startsWith('18.')?newFiles[1]:newFiles[3])
for(const [source,origin,run,optionsFactory]of [['Byteridge',byte.NATIVE_ORIGIN,runByte,byteOptions],['Monocept',mono.NATIVE_ORIGIN,runMono,monoOptions]]){
 const replay=(changedMain=false)=>{
  const options=optionsFactory((p,url)=>{if(url.startsWith(origin+'/')&&p.contentType?.includes('html'))p.body=replaceScripts(p.body)})
  return{...options,fetchImpl:async(url,init)=>{
   const packet=newFiles.some(f=>url===origin+'/'+f)?packets.get(url):null
   if(packet)return{status:200,url,contentType:packet.contentType,body:packet.body+(changedMain&&url.endsWith(newFiles[3])?'\nwindow.unreviewedJobs="/jobs";':'')}
   return options.fetchImpl(url,init)
  }}
 }
 test(source+' explicit synthetic current-client replay preserves historical native roles with incomplete company scope',async()=>{
  const jobs=await run(replay());assert.equal(jobs.length,7)
  assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete===true&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
  const evidence=readInventoryEvidence(jobs);assert.equal(evidence.listingComplete,false);assert.equal(evidence.status,'coverage-gap')
  assert.equal(jobs.nativeInventoryEvidence.observedGlobalRecords,7);assert.equal(jobs.nativeInventoryEvidence.closingReconciled,true)
 })
 test(source+' runtime rejects changed current main bytes before native roles can be accepted',async()=>{
  await assert.rejects(()=>run(replay(true)),/client bytes changed|unreviewed current native client bytes/)
 })
}
