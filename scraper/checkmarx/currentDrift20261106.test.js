import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativeData} from './nativeData.js'
import {BOARD,parseCheckmarxBoard} from './nativeContract.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,isFreshCompleteInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/current-clock-only-board-20261106.json.gz',import.meta.url))))
const sha=b=>createHash('sha256').update(b).digest('hex'),boardPacket=fixture.packet,rolePacket=fixture.rolePacket
for(const p of [boardPacket,rolePacket]){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(b.length,p.bodyBytes);assert.equal(sha(b),p.bodySHA256)}
const html=Buffer.from(boardPacket.bodyBase64,'base64').toString('utf8'),rows=readNativeData(html,'COMPANY_POSITIONS_DATA'),now=rolePacket.sourceCompletedAt
const held=rows.find(r=>r.uid==='5C.271'),clock=rows.find(r=>r.uid==='52.E6E')
function withRows(next){return html.replace(/(\bCOMPANY_POSITIONS_DATA\s*=\s*)([^\r\n]+)/,(_all,prefix,line)=>prefix+JSON.stringify(next).replaceAll('<','\\u003C').replaceAll('>','\\u003E')+(line.match(/[,;]\s*$/)?.[0]||''))}
const single=row=>parseCheckmarxBoard(withRows([row]),{now})
test('genuine timestamp-only official URL remains raw data with a query-free native role identity',()=>{
 assert.equal(clock.url_active_page,'https://checkmarx.com/job-openings/position/52.E6E?t=1793201435705')
 const parsed=single(clock);assert.deepEqual(parsed.rows,[clock]);assert.equal(parsed.rows[0].location.country,'IL')
 assert.equal(new URL(parsed.rows[0].url_comeet_hosted_page).search,'')
 assert.equal(parsed.rows[0].url_active_page,clock.url_active_page)
})
test('the full genuine current board retains40 rows, one typed India role and the unchanged missing-country hold',()=>{
 const parsed=parseCheckmarxBoard(html,{now});assert.deepEqual(parsed.rows,rows);assert.equal(parsed.rows.length,40)
 assert.deepEqual(parsed.rows.filter(r=>r.location.country==='IN').map(r=>r.uid),['5D.474'])
 assert.equal(parsed.heldNativeRows.length,1);assert.equal(parsed.heldNativeRows[0].uid,'5C.271')
 assert.equal(parsed.heldNativeRows[0].reason,'native-country-missing');assert.deepEqual(parsed.heldNativeRows[0].nativeRecord,held)
 assert.equal(held.location.country,'');assert.equal(held.location.name,'Uruguay')
 assert.equal(held.custom_fields.categories.find(f=>f.name==='CX Work Location').value,'Mexico - Remote')
 assert.equal(parsed.companyGlobalTotal,null);assert.equal(parsed.companyIndiaTotal,null)
})
for(const [name,query]of [
 ['timestamp too short','t=179320143570'],['timestamp too long','t=17932014357050'],['timestamp nonnumeric','t=179320143570x'],
 ['timestamp signed','t=-1793201435705'],['timestamp decimal','t=1793201435705.0'],['duplicate timestamp','t=1793201435705&t=1793201435705'],
 ['unknown query','t=1793201435705&redirect=https%3A%2F%2Fforeign.example'],
 ['clock plus unrelated tracker','t=1793201435705&ref=search'],['clock and employee without Share','employee&t=1793201435705'],
 ['clock and Share without employee','Share&t=1793201435705'],['valued employee','Share&employee=true&t=1793201435705'],
 ['valued Share','Share=true&employee&t=1793201435705'],
])test('timestamp-only compatibility rejects unsupported '+name,()=>{
 const row=structuredClone(clock);row.url_active_page='https://checkmarx.com/job-openings/position/'+row.uid+'?'+query;row.url_detected_page=row.url_active_page
 assert.throws(()=>single(row),/tracking/)
})
for(const [name,change,pattern]of [
 ['employer',r=>{r.company_name='Other employer'},/employer/],['UID',r=>{r.uid='bad'},/ID/],
 ['native role identity',r=>{r.url_comeet_hosted_page=r.url_comeet_hosted_page.replace('5C.271','00.000')},/identity/],
 ['official role origin',r=>{r.url_active_page='https://foreign.example/job/5C.271';r.url_detected_page=r.url_active_page},/identity/],
 ['internal flag',r=>{r.is_internal='false'},/status/],['update calendar',r=>{r.time_updated='2026-02-30T00:00:00Z'},/calendar/],
 ['extra location',r=>{r.additional_locations=[{country:'IN'}]},/location/],['publication field',r=>{r.datePosted='2026-11-06'},/publication/],
 ['unknown nonempty country',r=>{r.location.country='ZZ'},/country/],['null country',r=>{r.location.country=null},/country/],
 ['missing country field',r=>{delete r.location.country},/country/],['whitespace country',r=>{r.location.country=' '},/country/],
 ['typed-country conflict',r=>{r.location.country='IL';r.location.name='India - Pune';r.location.city='Pune'},/India/],
])test('a missing-country hold cannot hide malformed '+name,()=>{const row=structuredClone(held);change(row);assert.throws(()=>single(row),pattern)})
async function replay(t,change=(_p,_n,bytes)=>bytes){
 const calls=[],seen=new Map(),fetchImpl=async(input,init={})=>{
  const url=String(input),p=[boardPacket,rolePacket].find(p=>p.requestedURL===url);assert.ok(p,'Only declared native public board/role GETs: '+url)
  assert.ok(init.method==null||init.method==='GET');assert.equal(init.body,undefined)
  const n=(seen.get(url)||0)+1;seen.set(url,n);calls.push(url);const original=Buffer.from(p.bodyBase64,'base64');assert.equal(sha(original),p.bodySHA256)
  const response=new Response(change(p,n,original),{status:p.status,headers:{'content-type':p.contentType}});Object.defineProperty(response,'url',{value:p.finalURL});return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 return{calls,run:()=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='checkmarx')).run({now,fetchImpl})}
}
test('registered current replay recovers full Legal Associate and preserves all40 raw opening/closing observations plus the hold',async t=>{
 const r=await replay(t),jobs=await r.run();assert.deepEqual(r.calls,[BOARD,rolePacket.requestedURL,BOARD]);assert.equal(jobs.length,1)
 const job=jobs[0];assert.equal(job.jobId,'5D.474');assert.equal(job.requisitionId,'C169');assert.equal(job.country,'India');assert.equal(job.nativeEmployer,'Checkmarx')
 assert.equal(job.title,'Legal Associate');assert.equal(job.postingDate,null);assert.equal(job.closingDate,null);assert.equal(job.sourceDetailComplete,true)
 assert.ok(job.jobDescription.includes('Contracts Administration'));assert.ok(job.jobDescription.includes('Required Skills & Qualifications'));assert.ok(job.jobDescription.includes('Mumbai or Pune'))
 assert.equal(job.nativeContentSections.length,3);assert.equal(job.applicationVisited,false);assert.equal(job.lifecycleCleanupAllowed,false)
 const audit=jobs.nativeCollectionEvidence;assert.equal(audit.observations.length,40);assert.deepEqual(audit.openingNativeRows,rows);assert.deepEqual(audit.closingNativeRows,rows)
 assert.equal(audit.heldNativeRows.length,1);assert.deepEqual(audit.heldNativeRows[0].nativeRecord,held);assert.deepEqual(audit.heldNativeRows[0].closingNativeRecord,held)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.wholeNativeBoardClosingReconciled,true)
 assert.equal(audit.observedNativeIndiaRows,1);assert.equal(audit.observedPublicIndiaRows,1)
 assert.equal(audit.observations.find(r=>r.uid===held.uid).nativeCountryCode,null)
 assert.deepEqual(audit.originalResponses.map(p=>p.bodySHA256),[boardPacket.bodySHA256,rolePacket.bodySHA256,boardPacket.bodySHA256])
 for(const p of audit.originalResponses){assert.equal(p.bodyReadKind,'original-bytes');assert.equal(sha(Buffer.from(p.bodyBase64,'base64')),p.bodySHA256)}
 assert.equal(readSourceObservationEvidence(jobs,'checkmarx').observedVacancyCount,40)
 const e=readInventoryEvidence(jobs);assert.equal(e.status,'coverage-gap');assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(isFreshCompleteInventoryEvidence(e,{now}),false)
})
test('closing drift in a held country-unknown row remains fatal to the registered run',async t=>{
 const next=structuredClone(rows);next.find(r=>r.uid===held.uid).name+=' changed'
 const r=await replay(t,(p,n,b)=>p.requestedURL===BOARD&&n===2?Buffer.from(withRows(next)):b)
 await assert.rejects(r.run,/changed during extraction/);assert.equal(r.calls.length,3)
})

// These are synthetic review controls applied to genuine unchanged native rows.
// No alias is interpreted as a country or used to qualify a missing country.
for(const id of ['5C.271','5D.474'])for(const [name,extra]of [
 ['countryCode',{countryCode:id==='5C.271'?'IN':'US'}],
 ['addressCountry',{addressCountry:id==='5C.271'?'IN':'US'}],
 ['country_code',{country_code:'US'}],
 ['nested address country',{address:{country:'US'}}],
 ['nested addressCountry object',{address:{addressCountry:{name:'United States'}}}],
 ['nested postal address wrapper',{alternate:{postalAddress:{addressCountry:'US'}}}],
 ['numeric country carrier',{countryCode:0}],
 ['boolean country carrier',{addressCountry:false}],
])test('unreviewed country/address carrier '+name+' rejects '+(id==='5C.271'?'held unknown-country':'known typed-IN')+' record',()=>{
 const row=structuredClone(rows.find(r=>r.uid===id));Object.assign(row.location,extra)
 assert.throws(()=>single(row),/unreviewed.*country.*address.*carrier/i)
})
for(const id of ['5C.271','5D.474'])test('empty optional country/address aliases preserve raw metadata for '+id,()=>{
 const row=structuredClone(rows.find(r=>r.uid===id));Object.assign(row.location,{countryCode:null,addressCountry:'',address:{country:null,addressCountry:''},countries:[],postalAddress:{}})
 const parsed=single(row);assert.deepEqual(parsed.rows,[row]);assert.deepEqual(parsed.rows[0].location,row.location)
 assert.equal(parsed.heldNativeRows.length,id==='5C.271'?1:0)
})
test('registered extraction cannot publish matching board/detail aliases that conflict with typed India',async t=>{
 const changed=structuredClone(rows);changed.find(r=>r.uid==='5D.474').location.addressCountry='US'
 const r=await replay(t,(p,_n,b)=>{
  if(p.requestedURL===BOARD)return Buffer.from(withRows(changed))
  const html=b.toString('utf8'),value=readNativeData(html,'POSITION_DATA');value.location.addressCountry='US'
  return Buffer.from(html.replace(/(\bPOSITION_DATA\s*=\s*)([^\r\n]+)/,(_all,prefix,line)=>prefix+JSON.stringify(value).replaceAll('<','\\u003C').replaceAll('>','\\u003E')+(line.match(/[,;]\s*$/)?.[0]||'')))
 })
 await assert.rejects(r.run,/unreviewed.*country.*address.*carrier/i);assert.equal(r.calls.length,1)
})
