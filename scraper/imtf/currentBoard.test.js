import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import zlib from 'node:zlib'
import {collect} from './native.js'
import {verifyCurrentBoard} from './currentBoard.js'
import {HOME,CAREERS,parseListing,parseRoleHTML} from './parser.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'

const fixture=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./test-data/current-board-20261105.json.gz',import.meta.url))))
const index='https://apply.workable.com/imtf/jobs.md',detail='https://apply.workable.com/imtf/jobs/view/40AEB306B4.md'
const own='https://apply.workable.com/api/v2/accounts/imtf/jobs/40AEB306B4',seed='https://apply.workable.com/imtf/j/6A5764CB0F'
const originalText=url=>Buffer.from(fixture.responses[url].bodyBase64,'base64').toString('utf8')
const listing=parseListing(originalText(HOME),originalText(CAREERS))
const transport=(change={})=>{let inventoryReads=0;return async url=>{
 const packet=fixture.responses[url]
 if(!packet)throw Error('Unretained source response')
 let body=url===index&&inventoryReads++>0?Buffer.from(fixture.closingInventory.bodyBase64,'base64'):Buffer.from(packet.bodyBase64,'base64')
 if(change[url] instanceof Error)throw change[url]
 if(typeof change[url]==='function')body=Buffer.from(change[url](body.toString('utf8'),inventoryReads))
 return {...packet,body}
}}
// Exercise the retained board algorithm directly. These archived model checks
// do not qualify the registered reader or grant fresh/empty source credit.
async function diagnose(change={}){
 const io=transport(change),calls=[]
 const read=async(url,kind)=>{
  calls.push(url);const p=await io(url)
  assert.equal(p.status,200);assert.equal(p.bodyComplete,true)
  assert.equal(p.headers['content-type'].split(';')[0],kind==='markdown'?'text/markdown':kind==='json'?'application/json':'text/html')
  return p.body.toString('utf8')
 }
 const identity=parseRoleHTML(await read(seed,'html'),listing.candidates.find(c=>c.url===seed))
 const evidence=await verifyCurrentBoard(read,identity,()=>{})
 return {evidence,calls}
}
const held=({evidence})=>assert.ok(!evidence.complete||evidence.observedIndiaRoles.length>0)
async function sourceHeld(change,stage){
 const io=transport(change),calls=[]
 await assert.rejects(createCatalogScraper(getScraperCatalog().find(p=>p.source==='imtf')).run({transport:async url=>{calls.push(url);return io(url)}}),e=>{
  assert.equal(e.code,'IMTF_NATIVE_INCOMPLETE');assert.equal(e.nativeEvidence.verifiedZeroInventory,false)
  assert.equal(e.nativeEvidence.sourceScopeComplete,false);assert.equal(e.nativeEvidence.cleanupAllowed,false)
  if(stage)assert.ok(e.nativeEvidence.failures.some(f=>f.stage===stage))
  return true
 })
 assert.equal(calls.includes('https://apply.workable.com/imtf/llms.txt'),false)
 assert.equal(calls.some(u=>u.includes('/api/v2/')),false)
 return calls
}

test('retained board diagnostic reconstructs all nine foreign models and their full closing checks',async()=>{
 const {evidence,calls}=await diagnose()
 assert.equal(evidence.complete,true);assert.equal(evidence.observedListingCount,9)
 assert.equal(evidence.verifiedForeignRoles.length,9);assert.equal(evidence.observedIndiaRoles.length,0)
 assert.deepEqual([...new Set(evidence.verifiedForeignRoles.map(r=>r.country))].sort(),['Germany','Morocco','Switzerland'])
 assert.equal(evidence.failures.length,0);assert.equal(calls.length,41)
})
test('diagnostic missing detail and country contradictions cannot close its native models',async()=>{
 for(const change of [{[detail]:Error('detail unavailable')},{[detail]:s=>s.replace('Givisiez, Switzerland','Givisiez, India')}]){
  const result=await diagnose(change);held(result);assert.equal(result.evidence.observedListingCount,9)
  assert.ok(result.evidence.failures.length>0);assert.ok(result.calls.includes(detail))
 }
})
test('diagnostic closing inventory change remains incomplete',async()=>{
 const result=await diagnose({[index]:(s,n)=>n>1?s.replace('2026-10-22','2026-10-21'):s})
 held(result);assert.equal(result.calls.filter(u=>u===index).length,2)
})
test('diagnostic advertised India placement conflicting with native own country is held',async()=>{
 const replace=s=>s.replace('Givisiez, Switzerland','Givisiez, India')
 const result=await diagnose({[index]:replace,[detail]:replace});held(result);assert.ok(result.calls.includes(own))
})
test('foreign-tenant advertised diagnostic inventory alternate is rejected before board reads',async()=>{
 await assert.rejects(diagnose({[seed]:s=>s.replace('https://apply.workable.com/imtf/llms.txt','https://apply.workable.com/other/llms.txt')}),e=>e.code==='IMTF_NATIVE_BOARD_SHAPE')
})
test('diagnostic hidden/secondary India/contradictory country or account data stays held',async()=>{
 for(const mutate of [n=>{n.locations[0].hidden=true},n=>{n.locations.push({city:'Bengaluru',country:'India',countryCode:'IN',hidden:false,region:'Karnataka'})},n=>{n.locations[0].countryCode='IN'},n=>{n.accountUid='other-account'}]){
  const result=await diagnose({[own]:s=>{const n=JSON.parse(s);mutate(n);return JSON.stringify(n)}})
  held(result);assert.ok(result.calls.includes(own))
 }
})
test('diagnostic own numeric identity must match the actual seed HTML identity',async()=>{
 const url='https://apply.workable.com/api/v2/accounts/imtf/jobs/6A5764CB0F'
 const result=await diagnose({[url]:s=>{const n=JSON.parse(s);n.id=999999;return JSON.stringify(n)}})
 held(result);assert.ok(result.calls.includes(url))
})
test('diagnostic primary country contradicting all locations stays held',async()=>{
 held(await diagnose({[own]:s=>{const n=JSON.parse(s);n.location={city:'Bengaluru',country:'India',countryCode:'IN'};return JSON.stringify(n)}}))
})
test('DERIVED India-first primary not-found redirect is retained and stops all admission',async()=>{
 const stale='https://apply.workable.com/imtf/j/E90526054F/',row=listing.candidates.find(c=>c.url===stale)
 assert.ok(row)
 const derived=originalText(CAREERS).replace(row.rawHTML,'').replace(listing.candidates[0].rawHTML,row.rawHTML+listing.candidates[0].rawHTML)
 const io=transport({[CAREERS]:()=>derived}),calls=[]
 const result=await collect({transport:async url=>{
  calls.push(url)
  if(url===stale)return {url,status:302,headers:{location:'/imtf/?not_found=true','content-type':'text/html'},body:Buffer.alloc(0),bodyComplete:true}
  return io(url)
 }})
 assert.deepEqual(calls,[HOME,CAREERS,stale]);assert.equal(result.verifiedZeroInventory,false)
 assert.deepEqual(result.notFoundCareersShortcodes,['E90526054F'])
 assert.equal(result.retainedResponses.at(-1).status,302)
})
test('diagnostic closing own worksite changes remain incomplete',async()=>{
 let reads=0
 const result=await diagnose({[own]:s=>{if(++reads===1)return s;const n=JSON.parse(s);n.location.region='Changed region';n.locations[0].region='Changed region';return JSON.stringify(n)}})
 held(result);assert.equal(reads,2)
})
test('selected catalog retains the Swiss city spelling fact and unresolved later roles without certifying archived board zero',async()=>{
 const calls=await sourceHeld({},'role-markdown');assert.equal(calls.length,6)
 const result=await collect({transport:transport()})
 assert.equal(result.facts.length,1)
 assert.equal(result.facts[0].country,'Switzerland')
 assert.equal(result.facts[0].nativeCityRaw,'Z\u00fcrich')
 assert.equal(result.facts[0].listing.locationRaw,'Zurich')
 assert.equal(result.jobs.length,0)
 assert.equal(result.failures[0].message,'Markdown title/employment/header mismatch')
})
test('unreviewed corporate hiring carriers and malformed rows stop registered qualification',async()=>{
 for(const addition of ['<a href="https://apply.workable.com/other-company/j/ABCDEF1234/">Another role</a>','<a href="https://jobs.example.org/imtf/">Other IMTF vacancies</a>','<div class="imtf-careers-position"><a class="imtf-careers-position-1" href="https://apply.workable.com/imtf/j/ABCDEF1234/">Malformed role</a></div>'])
  await sourceHeld({[CAREERS]:s=>s.replace('</body>',addition+'</body>')},'native-listing')
})
test('diagnostic alternative India Markdown Description text stays unresolved',async()=>{
 const result=await diagnose({[detail]:s=>s.replace('## Description\n','## Description\n\nThis role may alternatively be based in Bengaluru, India.\n')})
 held(result);assert.ok(result.calls.includes(detail))
})
test('diagnostic closing-only alternative India own Description text stays unresolved',async()=>{
 let reads=0
 held(await diagnose({[own]:s=>{if(++reads===1)return s;const n=JSON.parse(s);n.description+='<p>This role may alternatively be based in Bengaluru, India.</p>';return JSON.stringify(n)}}))
 assert.equal(reads,2)
})
test('matching unreviewed alternative India text in both diagnostic carriers stays unresolved',async()=>{
 held(await diagnose({[detail]:s=>s.replace('## Description\n','## Description\n\nThis role may alternatively be based in Bengaluru, India.\n'),[own]:s=>{const n=JSON.parse(s);n.description='<p>This role may alternatively be based in Bengaluru, India.</p>'+n.description;return JSON.stringify(n)}}))
})
test('diagnostic closing Markdown is actually reread and its changed criteria rejected',async()=>{
 let reads=0
 held(await diagnose({[detail]:s=>++reads<2?s:s.replace('## Description\n','## Description\n\nThis role may alternatively be based in Bengaluru, India.\n')}))
 assert.equal(reads,2)
})
test('diagnostic unknown alternative-worksites field stays unresolved',async()=>{
 held(await diagnose({[own]:s=>{const n=JSON.parse(s);n.alternativeWorksites=[{city:'Bengaluru',country:'India'}];return JSON.stringify(n)}}))
})
test('diagnostic nongeographic material Requirements changes must reconcile',async()=>{
 const result=await diagnose({[detail]:s=>s.replace('## Requirements\n','## Requirements\n\nA professional accounting certification is mandatory.\n')})
 held(result);assert.ok(result.calls.includes(detail))
})
test('diagnostic matching alternative-office text without country remains unresolved',async()=>{
 held(await diagnose({[detail]:s=>s.replace('## Description\n','## Description\n\nAlternative office: Bengaluru.\n'),[own]:s=>{const n=JSON.parse(s);n.description='<p>Alternative office: Bengaluru.</p>'+n.description;return JSON.stringify(n)}}))
})
for(const [label,document,addition]of[
 ['HOME visible link',HOME,'<a href="https://jobs.lever.co/imtf/">India jobs</a>'],
 ['CAREERS template',CAREERS,'<template><a href="https://jobs.lever.co/imtf/">India jobs</a></template>'],
 ['CAREERS iframe',CAREERS,'<iframe src="https://jobs.lever.co/imtf/"></iframe>'],
 ['HOME noscript',HOME,'<noscript><a href="https://jobs.lever.co/imtf/">India jobs</a></noscript>'],
 ['CAREERS iframe srcdoc',CAREERS,'<iframe srcdoc="&lt;a href=&quot;https://jobs.lever.co/imtf/&quot;&gt;India jobs&lt;/a&gt;"></iframe>'],
 ['CAREERS lazy iframe',CAREERS,'<iframe data-src="https://jobs.lever.co/imtf/"></iframe>'],
 ['CAREERS embedded object',CAREERS,'<object data="https://jobs.lever.co/imtf/"></object>'],
])test(`unreviewed ${label} hiring surface prevents registered completion`,async()=>{
 const calls=await sourceHeld({[document]:s=>s.replace('</body>',addition+'</body>')},document===HOME?'official-home':'native-listing')
 assert.deepEqual(calls,document===HOME?[HOME]:[HOME,CAREERS])
})
