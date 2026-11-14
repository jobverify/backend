import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {validateNativeDetail} from './nativeContract.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {fixture,listing,details,board,textOf,fixtureReplay} from './test-data/currentResponseFixture.js'
const assets=fixture.responses.filter(packet=>packet.url.endsWith('.js')||packet.url.endsWith('.css')),firstAsset=assets[0],firstStyle=assets.find(packet=>packet.url.endsWith('.css')),finance=listing.Result[1],current={now:fixture.now,currentPublicRender:true}
const noNativeAPI=reads=>assert.ok(!reads.some(row=>row.url.includes('thapi-stage2.azurewebsites.net')),'No native session/listing/role authority may be used after an unreviewed deployment')
for(const packet of assets)for(const mutation of ['same-size byte','BOM prefix'])test(`original current ${packet.url.split('/').at(-1)} rejects ${mutation} before native API`,async()=>{
 const replay=fixtureReplay((row,body)=>{
  if(row.url!==packet.url)return body
  if(mutation==='BOM prefix')return Buffer.concat([Buffer.from([239,187,191]),body])
  const changed=Buffer.from(body);changed[Math.floor(changed.length/2)]^=1;assert.equal(changed.length,body.length);return changed
 })
 await assert.rejects(run(replay.options),/immutable original entity bytes changed/);noNativeAPI(replay.reads)
})
for(const packet of [firstAsset,firstStyle])test(`invalid original UTF8 ${packet.url.endsWith('.css')?'CSS':'JS'} cannot pass a decoded replacement`,async()=>{
 const replay=fixtureReplay((row,body)=>row.url===packet.url?Buffer.concat([Buffer.from([255]),body.subarray(1)]):body)
 await assert.rejects(run(replay.options),/immutable original entity bytes changed|invalid UTF8/);noNativeAPI(replay.reads)
})
for(const [name,mutate]of[
 ['new external program',html=>html.replace('</head>','<script src="https://example.invalid/new.js"></script></head>')],
 ['new token-case stylesheet',html=>html.replace('</head>','<link rel="alternate STYLESHEET" href="https://example.invalid/new.css"></head>')],
 ['inline generated criteria stylesheet',html=>html.replace('</head>','<style>p:after{content:"Mandatory extra qualification"}</style></head>')],
 ['edited native inline program',html=>html.replace('</head>','<script>document.body.dataset.criteria="changed"</script></head>')],
 ['hidden alternate program',html=>html.replace('</head>','<template><script src="https://example.invalid/inert.js"></script></template></head>')],
])test(`complete native shell rejects ${name}`,async()=>{
 const replay=fixtureReplay((packet,body)=>packet.url===board.url?Buffer.from(mutate(body.toString('utf8'))):body)
 await assert.rejects(run(replay.options),/complete public shell\/declarations changed/);noNativeAPI(replay.reads)
})
for(const [name,wrap]of[
 ['class activation',html=>'<p class="invisible">'+html+'</p>'],['client data trigger',html=>'<p data-toggle="collapse">'+html+'</p>'],
 ['event attribute',html=>'<p onmouseover="hideCriteria()">'+html+'</p>'],['new criterion identity',html=>'<p id="collapseCriteria">'+html+'</p>'],
 ['generated inline content',html=>'<span style="content:attr(data-extra)">'+html+'</span>'],['opacity zero',html=>'<span style="opacity: 0">'+html+'</span>'],
 ['hidden subtree',html=>'<p hidden>'+html+'</p>'],['inert subtree',html=>'<p inert>'+html+'</p>'],
 ['interactive alternate content',html=>'<details><summary>Requirements</summary>'+html+'</details>'],['executable descendant',html=>html+'<script>renderExtraCriteria()</script>'],
 ['embedded alternate carrier',html=>html+'<iframe src="https://example.invalid/criteria"></iframe>'],['unknown author link',html=>html+'<a href="https://example.invalid/full">More mandatory requirements</a>'],
])test(`current criteria holds ${name} without certifying partial visible text`,()=>{
 const detail=structuredClone(details[finance.JobId]);detail.JobDescriptionV2=wrap(detail.JobDescriptionV2)
 assert.equal(validateNativeDetail(detail,finance,current).sourceDetailComplete,false)
})
for(const notice of ['This role has been filled.','This vacancy has expired.','Applications are closed.','We are no longer accepting applications.'])test(`explicit native availability contradiction holds: ${notice}`,()=>{
 const detail=structuredClone(details[finance.JobId]);detail.JobDescriptionV2='<p>'+notice+'</p>'+detail.JobDescriptionV2
 assert.equal(validateNativeDetail(detail,finance,current).sourceDetailComplete,false)
})
for(const [name,mutate]of[
 ['wrong GUID',detail=>{detail.JobId=listing.Result[2].JobId}],['wrong obfuscated application identity',detail=>{detail.JobIdObfuscated=listing.Result[2].JobIdObfuscated}],
 ['foreign legal employer',detail=>{detail.OrgDetails.OrgName='Other company'}],['native country contradiction',detail=>{detail.Location=JSON.stringify([{Address:'Bengaluru, Karnataka, India',Country:'US'}])}],
 ['changed CareerPage closing date',detail=>{detail.ExpiryDates.CAREERPAGE='2026-12-30T18:29:00.117Z'}],
])test(`registered current full response cannot publish ${name}`,async()=>{
 const replay=fixtureReplay((packet,body)=>{if(!packet.url.includes('/api/publicjobs/'+finance.JobId+'?'))return body;const detail=JSON.parse(body);mutate(detail);return Buffer.from(JSON.stringify(detail))})
 await assert.rejects(run(replay.options),/conflict|contradict|employer/i)
})

test('current original HTTP entities cannot be replaced by body-only callbacks',async()=>{
 const replay=fixtureReplay();await assert.rejects(run({...replay.options,fetchText:async url=>textOf(fixture.responses.find(row=>row.url===url))}),/original HTTP entity bytes.*body-only/);noNativeAPI(replay.reads)
})
for(const [name,change]of[
 ['final URL',response=>{const changed=new Response(response.body,{status:response.status,headers:response.headers});Object.defineProperty(changed,'url',{value:firstAsset.url+'?redirected=1'});return changed}],
 ['MIME',response=>{response.headers.set('content-type','text/html');return response}],
])test(`current asset original ${name} is mandatory`,async()=>{
 const replay=fixtureReplay(),acquire=replay.options.fetchImpl
 replay.options.fetchImpl=async(url,init)=>{const response=await acquire(url,init);if(url===firstAsset.url)return change(response);return response}
 await assert.rejects(run(replay.options),/original final URL changed|MIME changed/);noNativeAPI(replay.reads)
})
for(const packet of [firstAsset,firstStyle])test(`current original ${packet.url.endsWith('.css')?'CSS':'JS'} preserves its streaming body bound`,async()=>{
 const replay=fixtureReplay((row,body)=>row.url===packet.url?Buffer.alloc(packet.url.endsWith('.css')?4000001:16000001,32):body)
 await assert.rejects(run(replay.options),/original response body limit/);noNativeAPI(replay.reads)
})

test('a zero caller cap performs no native reads and cannot certify cleanup',async()=>{
 const replay=fixtureReplay(),jobs=await run({...replay.options,maxJobs:0});assert.equal(replay.reads.length,0);assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('all selected native roles unavailable remains unknown company inventory',async()=>{
 const replay=fixtureReplay((packet,body)=>{if(!packet.url.includes('/api/publicjobs/'))return body;const detail=JSON.parse(body);detail.JobDescriptionV2='<p>This position is closed. We are no longer accepting applications.</p>'+detail.JobDescriptionV2;return Buffer.from(JSON.stringify(detail))}),jobs=await run(replay.options)
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,44);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(jobs[Symbol.for('jobverify.verified-recruitment-observations')].sourceScopeComplete,false)
})

test('opaque caller abort settles a hanging current raw response and cancels its reader',async()=>{
 const replay=fixtureReplay(),acquire=replay.options.fetchImpl,controller=new AbortController(),reason={nativeCallerAbort:'opaque'},packet=firstAsset;let cancelled=false,started=false
 replay.options.fetchImpl=async(url,init)=>{
  if(url!==packet.url)return acquire(url,init)
  const response=new Response(new ReadableStream({pull(){if(!started){started=true;queueMicrotask(()=>controller.abort(reason))}return new Promise(()=>{})},cancel(){cancelled=true}}),{status:packet.status,headers:{'content-type':packet.contentType}})
  Object.defineProperty(response,'url',{value:packet.finalUrl});return response
 }
 await assert.rejects(run({...replay.options,signal:controller.signal}),error=>error===reason);await new Promise(resolve=>setTimeout(resolve,10));assert.equal(cancelled,true);noNativeAPI(replay.reads)
})

test('opaque caller abort disposes a late current original response',async()=>{
 const replay=fixtureReplay(),acquire=replay.options.fetchImpl,controller=new AbortController(),reason={nativeCallerAbort:'late-original'};let cancelled=false
 replay.options.fetchImpl=async(url,init)=>{
  if(url!==firstAsset.url)return acquire(url,init)
  queueMicrotask(()=>controller.abort(reason));await new Promise(resolve=>setTimeout(resolve,10))
  const response=new Response(new ReadableStream({cancel(){cancelled=true}}),{status:firstAsset.status,headers:{'content-type':firstAsset.contentType}})
  Object.defineProperty(response,'url',{value:firstAsset.finalUrl});return response
 }
 await assert.rejects(run({...replay.options,signal:controller.signal}),error=>error===reason);await new Promise(resolve=>setTimeout(resolve,30));assert.equal(cancelled,true);noNativeAPI(replay.reads)
})
