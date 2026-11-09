import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {freshFetch,freshResponses} from './freshReplay.js'
import {API} from './native.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/requisition-only-row-20261106.json.gz',import.meta.url))))
const sha=b=>createHash('sha256').update(b).digest('hex')
for(const p of capture.packets){const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(bytes.length,p.bodyBytes);assert.equal(sha(bytes),p.sha256)}
const actualPage=capture.packets.find(p=>p.requestBody.offset===280),pageModel=JSON.parse(Buffer.from(actualPage.bodyBase64,'base64')),stub=pageModel.jobPostings[8]
const query=capture.packets.find(p=>p.requestBody.searchText==='R121350'),queryModel=JSON.parse(Buffer.from(query.bodyBase64,'base64'))
const originalPage=freshResponses.find(p=>p.requestBody?.offset===80&&Object.keys(p.requestBody.appliedFacets).length===0),originalModel=JSON.parse(originalPage.body),index=originalModel.jobPostings.findIndex(r=>r.bulletFields?.[0]==='R121350')
const provider=getScraperCatalog().find(p=>p.source==='samsung')
test('actual global row288 and independent native requisition query retain the exact ID-only shape',()=>{
 assert.deepEqual(stub,{bulletFields:['R121350']});assert.equal(actualPage.requestBody.offset+8,288)
 assert.equal(queryModel.total,1);assert.deepEqual(queryModel.jobPostings,[stub]);assert.equal(Object.keys(stub).length,1)
 assert.ok(!Object.hasOwn(stub,'title')&&!Object.hasOwn(stub,'externalPath')&&!Object.hasOwn(stub,'locationsText'))
})
// Preserve the historical full cohort and place this exact genuine current row
// at the same requisition's historical position (offset80,index15). This is an
// explicit synthetic placement, not a claimed current full-board capture.
async function replay(t,{change=()=>{},normal=false}={}){
 const calls=[],seen=new Map(),fetchImpl=freshFetch(record=>{
  const body=record.requestBody,id=record.url+JSON.stringify(body??null),n=(seen.get(id)||0)+1;seen.set(id,n)
  calls.push({url:record.url,body:structuredClone(body??null),n})
  if(!normal&&body?.offset===80&&Object.keys(body.appliedFacets).length===0){const page=JSON.parse(record.body);page.jobPostings[index]=structuredClone(stub);change(page,n);record.body=JSON.stringify(page)}
  return record
 })
 t.mock.method(globalThis,'fetch',fetchImpl)
 return{calls,run:()=>createCatalogScraper(provider).run({fetchImpl,now:()=>new Date('2026-10-23T17:30:00Z')})}
}
test('registered extraction holds the genuine requisition-only row and keeps full native IDs without requesting an invented URL',async t=>{
 const r=await replay(t),jobs=await r.run(),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,29);assert.equal(audit.globalRows.length,653)
 assert.equal(audit.globalRows.filter(row=>row.bulletFields[0]==='R121350').length,1)
 assert.equal(audit.heldRequisitionOnlyRows.length,1);const h=audit.heldRequisitionOnlyRows[0]
 assert.equal(h.id,'R121350');assert.equal(h.cohort,'global');assert.equal(h.pageOffset,80);assert.equal(h.rowIndex,95);assert.equal(h.pageRowIndex,15)
 assert.deepEqual(h.record,stub);assert.deepEqual(h.openingPage,h.closingPage);assert.equal(h.closingReconciled,true)
 for(const field of ['country','title','detailURL','description','postingDate','closingDate'])assert.equal(h[field],null)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(r.calls.filter(c=>c.body?.offset===80&&Object.keys(c.body.appliedFacets).length===0).length,2)
 assert.ok(r.calls.every(c=>!c.url.includes('undefined')&&c.url!==API+originalModel.jobPostings[index].externalPath))
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.ok(!jobs.some(j=>['R121350','R119924','R114583'].includes(j.jobId)))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('normal historical native pages add no extra closing reads',async t=>{
 const r=await replay(t,{normal:true}),jobs=await r.run();assert.equal(jobs.length,29)
 assert.equal(r.calls.filter(c=>c.body?.offset===80&&Object.keys(c.body.appliedFacets).length===0).length,1)
 assert.deepEqual(jobs.nativeCollectionEvidence.heldRequisitionOnlyRows,[])
})
for(const [name,row]of [
 ['blank title property',{bulletFields:['R121350'],title:''}],['null title property',{bulletFields:['R121350'],title:null}],
 ['path property',{bulletFields:['R121350'],externalPath:'/job/unproven_R121350'}],['country property',{bulletFields:['R121350'],country:'IN'}],
 ['multiple IDs',{bulletFields:['R121350','R1']}],['empty IDs',{bulletFields:[]}],['nonnative ID',{bulletFields:['OTHER']}],['numeric ID',{bulletFields:[121350]}],
 ['extra native error field',{bulletFields:['R121350'],errorCode:500}],
])test('stub resilience does not admit malformed '+name,async t=>{
 const r=await replay(t,{change:page=>{page.jobPostings[index]=row}})
 await assert.rejects(r.run,/invalid listing identity|listing requisition mismatch/)
})
test('the held requisition still participates in native duplicate detection',async t=>{
 const r=await replay(t,{change:page=>{page.jobPostings[index-1]=structuredClone(stub)}})
 await assert.rejects(r.run,/duplicate native page/)
})
for(const [name,change]of [
 ['held ID',page=>{page.jobPostings[index]={bulletFields:['R999999999']}}],
 ['another full row',page=>{page.jobPostings[0].title+=' changed'}],
 ['native page envelope',page=>{page.newNativeRequirement='changed page envelope'}],
 ['restored full record',page=>{page.jobPostings[index]=originalModel.jobPostings[index]}],
])test('whole affected stub page must reconcile at closing: '+name,async t=>{
 const r=await replay(t,{change:(page,n)=>{if(n===2)change(page)}})
 await assert.rejects(r.run,/requisition-only.*page changed|stub.*page changed/i)
 assert.equal(r.calls.filter(c=>c.body?.offset===80&&Object.keys(c.body.appliedFacets).length===0).length,2)
})
