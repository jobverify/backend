import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {runBlackRockEarlyCareers, parseBlackRockTalnetBoard, parseBlackRockTalnetDetail, readBlackRockEarlyCareersScope} from '../shared/blackrockTalnet.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/blackrockTalnet/native-excerpts.json',import.meta.url)))
const boardUrl = 'https://blackrock.tal.net/vx/lang-en-GB/mobile-0/brand-3/candidate/jobboard/vacancy/1/adv/'
const fetcher = (f=fixture) => async url => {
  if(url===f.apacUrl)return f.apacHtml
  if(f.corporate[url])return f.corporate[url]
  if(url===f.applicationUrl)return {body:f.applicationHtml,status:200,finalURL:f.applicationFinalUrl}
  if(url===f.boardNavigationUrl||url===boardUrl)return f.boardHtml
  if(f.details[url])return f.details[url]
  throw Error('Unexpected fixture request')
}
test('actual finite 13 program board proves foreign scope, not global employer vacancy count',async()=>{
  const jobs=await runBlackRockEarlyCareers({fetchText:fetcher()})
  assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).reportedTotal,13)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,0)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.equal(readBlackRockEarlyCareersScope(jobs).programs.length,13)
})
for(const [name,mutate] of [
  ['India',s=>s.replace(/>\s*Japan\s*</,'>India<')],
  ['unknown country',s=>s.replace(/>\s*Japan\s*</,'>Unknown<')],
  ['new city',s=>s.replace(/>\s*Tokyo\s*</,'>Bengaluru<')],
  ['wrong apply identity',s=>s.replace('/opp/11985/apply/','/opp/99999/apply/')],
  ['data-only canonical',s=>s.replace('rel="canonical" href=','rel="canonical" data-href=')],
  ['wrong title',s=>s.replace('2028 Full-Time Analyst Program - APAC</h1>','Wrong company role</h1>')],
  ['inert detail',s=>`<template>${s}</template>`],
  ['missing full description',s=>s.replace(/(datafield_26498_1_1"[\s\S]*?>)[\s\S]*?(<\/div>)/,'$1$2')],
]) test(`rejects ${name}`,()=>{
  const row=parseBlackRockTalnetBoard(fixture.boardHtml).rows.find(r=>r.id==='11985')
  assert.throws(()=>parseBlackRockTalnetDetail(mutate(fixture.details[row.url]),row))
})
for(const [name,mutate] of [
  ['count drift',s=>s.replace('13 results match!','14 results match!')],
  ['unknown total',s=>s.replace('13 results match!','Results')],
  ['duplicate ID',s=>s.replace('data-oppid="12219"','data-oppid="12218"')],
  ['next page',s=>s+'<a href="?page=2" rel="next">Next</a>'],
  ['inert board',s=>`<template>${s}</template>`],
]) test(`rejects board ${name}`,()=>assert.throws(()=>parseBlackRockTalnetBoard(mutate(fixture.boardHtml))))
test('cap cannot certify zero',async()=>assert.rejects(runBlackRockEarlyCareers({fetchText:fetcher(),maxPrograms:5})))
test('corporate handoff must be active',async()=>{
 const f=structuredClone(fixture);f.apacHtml=`<template>${f.apacHtml}</template>`
 await assert.rejects(runBlackRockEarlyCareers({fetchText:fetcher(f)}))
})
test('aborted caller settles even when injected transport ignores signal',async()=>{
 const controller=new AbortController();const promise=runBlackRockEarlyCareers({signal:controller.signal,fetchText:()=>new Promise(()=>{})});controller.abort();await assert.rejects(promise)
})
test('HTTP failure never establishes zero',async()=>assert.rejects(runBlackRockEarlyCareers({fetchText:async()=>({status:503,body:fixture.apacHtml})})))
test('actual native descriptions and all listed countries are checked for every role',()=>{
 for(const row of parseBlackRockTalnetBoard(fixture.boardHtml).rows){
  const detail=parseBlackRockTalnetDetail(fixture.details[row.url],row)
  assert.ok(detail.description.length>1000);assert.ok(detail.countryCodes.length>0)
  assert.ok(!detail.countryCodes.includes('IN'));assert.equal(detail.id,row.id)
 }
})
test('India added as secondary country cannot certify zero',()=>{
 const row=parseBlackRockTalnetBoard(fixture.boardHtml).rows.find(r=>r.id==='11985')
 assert.throws(()=>parseBlackRockTalnetDetail(fixture.details[row.url].replace(/>\s*Japan\s*</,'>Japan, India<'),row),/country/)
})
test('valid foreign primary with a remote secondary city cannot certify zero',()=>{
 const row=parseBlackRockTalnetBoard(fixture.boardHtml).rows.find(r=>r.id==='11985')
 assert.throws(()=>parseBlackRockTalnetDetail(fixture.details[row.url].replace(/>\s*Tokyo\s*</,'>Tokyo, Global Remote<'),row),/city/)
})
test('description present only in inert markup cannot establish full content',()=>{
 const row=parseBlackRockTalnetBoard(fixture.boardHtml).rows.find(r=>r.id==='11985')
 const s=fixture.details[row.url]
 for(const tag of ['template','script','style','textarea','xmp','iframe','noembed','noframes']){
  const mutation=s.replace(/(datafield_26498_1_1"[\s\S]*?>)([\s\S]*?)(<\/div>)/,`$1<${tag}>$2</${tag}>$3`)
  assert.throws(()=>parseBlackRockTalnetDetail(mutation,row),/description|apply/)
 }
})
test('final inventory title drift fails the whole scope check',async()=>{
 const base=fetcher()
 await assert.rejects(runBlackRockEarlyCareers({fetchText:async url=>url===boardUrl?fixture.boardHtml.replace('data-title="2027 Full-Time Analyst Program - AMRS"','data-title="Changed title"'):base(url)}),/changed/)
})
test('a failed detail after other full details cannot return a complete empty result',async()=>{
 const base=fetcher()
 await assert.rejects(runBlackRockEarlyCareers({fetchText:async url=>url.includes('/opp/12232-')?{status:500,body:fixture.details[url]}:base(url)}),/HTTP/)
})
test('corporate/native APAC set must reconcile',async()=>{
 const f=structuredClone(fixture);const removed=Object.keys(f.corporate)[1];f.apacHtml=f.apacHtml.split('\n').filter(s=>!s.includes(removed)).join('\n')
 await assert.rejects(runBlackRockEarlyCareers({fetchText:fetcher(f)}),/APAC scope/)
})
test('explicit zero timeout or concurrency is not replaced with defaults',async()=>{
 await assert.rejects(runBlackRockEarlyCareers({fetchText:fetcher(),timeoutMs:0}),/timeout/)
 await assert.rejects(runBlackRockEarlyCareers({fetchText:fetcher(),detailConcurrency:0}),/concurrency/)
})
