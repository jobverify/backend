import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/corporate-styling-20261121.json.gz',import.meta.url)))).packets
const prior=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261113.json.gz',import.meta.url)))).packets
for(const p of current){assert.equal(p.bodyOriginalUnmodified,true);assert.equal(createHash('sha256').update(p.html).digest('hex'),p.sha256)}
const CAREERS='https://www.dialpad.com/careers/',OPENINGS=CAREERS+'open-opportunities/',oldCSS='645859c2f2901802.css',newCSS='0c0acb4b4eb12fe5.css'
const replay=(change=()=>{},{stopAtOpenings=false}={})=>{
 const calls=[],visits=new Map(),stop=Object.freeze({unacquired:'current unfiltered native inventory'})
 const run=()=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='dialpad')).run({fetchImpl:async url=>{
  calls.push(url);const visit=(visits.get(url)??0)+1;visits.set(url,visit)
  if(stopAtOpenings&&url===OPENINGS)throw stop
  const original=current.find(p=>p.requestedUrl===url)??prior.find(p=>p.requestedUrl===url);assert.ok(original,'Only original retained current corporate/CSS or frozen native-cohort packets: '+url)
  const packet=structuredClone(original)
  // Explicit synthetic styling-only composition for the frozen native cohort:
  // every native role, country and original date remains byte-for-byte intact.
  if(!current.includes(original)&&url.startsWith(CAREERS))packet.html=packet.html.replaceAll(oldCSS,newCSS)
  change(packet,url,visit)
  return Object.defineProperty(new Response(packet.html,{status:packet.status}),'url',{value:packet.url})
 }})
 return{run,calls,visits,stop}
}
test('actual current corporate styling reaches only the unfiltered openings URL without inventing inventory',async()=>{
 const r=replay(()=>{},{stopAtOpenings:true});await assert.rejects(r.run(),error=>error===r.stop)
 assert.equal(r.calls.length,10);assert.equal(r.calls.at(-1),OPENINGS)
})
test('current styling with the frozen native cohort preserves all16 full original records, country and publication fields',async()=>{
 const r=replay(),jobs=await r.run(),audit=jobs.nativeCollectionEvidence,original=JSON.parse(prior.find(p=>p.requestedUrl.endsWith('/jobs?content=true')).html)
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).reportedTotal,16);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.deepEqual(audit.opening,original);assert.deepEqual(audit.details,original.jobs)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.ok(audit.countryProofs.every(p=>p.qualified&&!p.countries.includes('India')))
})
test('changed current stylesheet bytes cannot conceal employer authority',async()=>{
 const r=replay((p,url)=>{if(url.includes(newCSS))p.html+='\na{display:none!important}'})
 await assert.rejects(r.run(),/stylesheet|styling/i);assert.ok(r.calls.some(url=>url.includes(newCSS)))
})
test('an extra hidden preload-as-style declaration is rejected before any alternate CSS acquisition',async()=>{
 const r=replay((p,url)=>{if(url===CAREERS)p.html=p.html.replace('</head>','<div hidden><link rel="preload" as="style" href="https://www.dialpad.com/unknown.css"></div></head>')})
 await assert.rejects(r.run(),/stylesheet|styling/i);assert.equal(r.calls.includes('https://www.dialpad.com/unknown.css'),false)
})
test('a newly shipped hiding utility cannot be added to a reviewed handoff ancestor',async()=>{
 const r=replay((p,url)=>{if(url===CAREERS){const before=p.html;p.html=p.html.replace(/(<main[^>]*class=")([^"]*)/,(_all,start,classes)=>start+classes+' max-md:hidden');assert.notEqual(p.html,before)}})
 await assert.rejects(r.run(),/ancestor|visibility|handoff|styling/i)
})
test('closing cannot mix the former stylesheet deployment with a current opening',async()=>{
 const r=replay((p,url,visit)=>{if(url===CAREERS&&visit===2)p.html=prior.find(p=>p.requestedUrl===CAREERS).html})
 await assert.rejects(r.run(),/stylesheet|styling/i);assert.equal(r.visits.get(CAREERS),2)
})
test('default registration preserves the source stylesheet rejection without generic alternate reads',async t=>{
 const calls=[]
 t.mock.method(globalThis,'fetch',async input=>{
  const url=String(input);calls.push(url);const p=current.find(p=>p.requestedUrl===url)??prior.find(p=>p.requestedUrl===url)
  const body=p?.html??'Uncaptured alternate URL is a mocked404; no public HTTP',status=p?.status??404
  return Object.defineProperty(new Response(url.includes(newCSS)?body+'\na{display:none}':body,{status,headers:p?.headers}),'url',{value:p?.url??url})
 })
 await assert.rejects(createCatalogScraper(getScraperCatalog().find(p=>p.source==='dialpad')).run({signal:AbortSignal.timeout(15000)}),/stylesheet bytes changed/)
 assert.equal(calls.length,3,'Authoritative corporate CSS rejection must be final in the default registered path')
})
