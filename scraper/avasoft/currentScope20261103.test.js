import test from 'node:test'
import assert from 'node:assert/strict'
import {createAvasoftScraper} from './script.js'
import {avasoftCapture,avasoftVisibleOpenings} from '../../scraper-support/tests/fixtures/avasoftNativeOptions.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const replay=(mutate=()=>{})=>{const f=avasoftCapture(),calls=[],visits=new Map();return{calls,options:{now:()=>f.runAt,fetchPage:async(url,init)=>{const visit=(visits.get(url)||0)+1;visits.set(url,visit);calls.push(url);const originals=f.packets.filter(p=>p.url===url),packet=structuredClone(originals[Math.min(visit-1,originals.length-1)]);if(!packet)throw Error('Only original declared Avasoft URL');avasoftVisibleOpenings(packet);mutate(packet,visit);return{...packet,url:packet.finalUrl}}}}}
test('Avasoft final native card traversal follows every closing own detail and holds a card hidden during those reads',async()=>{
 const r=replay((packet,visit)=>{if(packet.url==='https://avasoft.com/career/'&&visit===3)packet.body=packet.body.replace(/<div\b[^>]*data-id="70948da"[^>]*>/,tag=>tag.slice(0,-1)+' style="display:none">')}),jobs=await createAvasoftScraper().run(r.options)
 assert.equal(jobs.some(row=>row.jobId==='trainee-engineer'),false);assert.equal(jobs.length,2);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(r.calls.filter(url=>url==='https://avasoft.com/career/').length,3);assert.equal(r.calls.at(-1),'https://avasoft.com/career/')
})
test('a complete reactivated configured Avasoft board never authorizes company totals or cleanup',async()=>{
 const r=replay(),jobs=await createAvasoftScraper().run(r.options);assert.equal(jobs.length,3);assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.ok(jobs.every(row=>row.sourceCompanyWideScopeComplete===false&&row.lifecycleCleanupAllowed===false&&row.sourceScopeComplete===false))
})
test('Avasoft awaits rejected audit observers and bounds ignored ones',async()=>{
 const first=replay(),error=Error('observer refused');await assert.rejects(createAvasoftScraper().run({...first.options,onAudit:async()=>{throw error}}),caught=>caught===error)
 const second=replay(),controller=new AbortController(),reason={observerAbort:true};let entered=false
 await assert.rejects(createAvasoftScraper().run({...second.options,signal:controller.signal,onAudit:()=>{entered=true;controller.abort(reason);return new Promise(()=>{})}}),caught=>caught===reason);assert.equal(entered,true)
})
