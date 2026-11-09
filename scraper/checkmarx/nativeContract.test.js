import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readNativeData} from './nativeData.js'
import {parseCheckmarxBoard,parseCheckmarxRole} from './nativeContract.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/runtime-native-20261021.json.gz',import.meta.url))))
const [board,pune,value]=fixture.packets,now='2026-10-21T04:00:00.000Z'
const state=()=>parseCheckmarxBoard(board.body,{now})
function mutate(html,key,change){
 const old=readNativeData(html,key),next=change(structuredClone(old))??old
 const re=new RegExp('(\\b'+key+'\\s*=\\s*)([^\\r\\n]+)')
 assert.match(html,re)
 return html.replace(re,(_match,prefix,line)=>prefix+JSON.stringify(next).replaceAll('<','\\u003C').replaceAll('>','\\u003E')+(line.match(/[,;]\s*$/)?.[0]||''))
}
const role=(packet=pune,html=packet.body)=>parseCheckmarxRole(html,state().rows.find(r=>r.url_comeet_hosted_page===packet.url),{now})

test('actual public native array contains all30 exact UIDs including location variants and typed US Indiana',()=>{
 const s=state();assert.equal(s.rows.length,30)
 assert.equal(new Set(s.rows.map(r=>r.uid)).size,30)
 assert.ok(s.rows.some(r=>r.uid==='C4.07A-FD.10D'))
 assert.ok(s.rows.some(r=>r.uid==='C4.07A-48.502'))
 assert.equal(s.rows.filter(r=>r.location.country==='IN').length,2)
 const indiana=s.rows.find(r=>r.uid==='FC.27B')
 assert.equal(indiana.location.country,'US');assert.equal(indiana.location.state,'IN')
 assert.ok(s.rows.find(r=>r.uid==='04.274').url_active_page.includes('?ref='))
 assert.equal(new URL(s.rows.find(r=>r.uid==='C4.07A-FD.10D').url_active_page).pathname,'/job-openings/position/C4.07A/')
 assert.equal(s.companyGlobalTotal,null);assert.equal(s.companyIndiaTotal,null)
})

test('actual native full descriptions, native employer, two requisitions and original update clocks remain distinct from publication',()=>{
 for(const [packet,id,req,updated] of [[pune,'78.66E','P2165','2026-10-19T15:51:40.000Z'],[value,'DA.278','P2196','2026-10-18T19:23:00.000Z']]){
   const j=role(packet);assert.equal(j.jobId,id);assert.equal(j.requisitionId,req)
   assert.equal(j.nativeEmployer,'Checkmarx');assert.equal(j.nativeLegalEmployer,null)
   assert.equal(j.nativeIsInternal,false);assert.equal(j.nativeUpdatedAt,updated)
   assert.equal(j.postedAt,null);assert.equal(j.closingDate,null)
   assert.equal(j.sourceDetailComplete,true);assert.ok(j.jobDescription.length>2500)
   assert.equal(j.country,'India');assert.equal(j.city,'Pune')
   assert.equal(j.sourceListingComplete,false);assert.equal(j.applicationSubmitted,false)
   assert.equal(j.applyUrl,j.sourceUrl)
 }
})

for(const [name,change] of [
 ['company UID',j=>{j.company_uid='OTHER'}],
 ['company name',j=>{j.name='Other employer'}],
 ['official website',j=>{j.website='https://example.com'}],
 ['company domain set',j=>{j.company_domain_set=['example.com']}],
 ['HTTP200 error',j=>{j.ERROR='upstream failed'}]
])test('native board rejects wrong '+name,()=>assert.throws(()=>parseCheckmarxBoard(mutate(board.body,'COMPANY_DATA',j=>(change(j),j)),{now})))

for(const [name,change] of [
 ['array UID',j=>{j[0].uid=['78.66E']}],
 ['duplicate UID',j=>{j[1].uid=j[0].uid}],
 ['unknown country ZZ',j=>{j[0].location.country='ZZ'}],
 ['region EU',j=>{j[0].location.country='EU'}],
 ['region UN',j=>{j[0].location.country='UN'}],
 ['string internal flag',j=>{j[0].is_internal='false'}],
 ['foreign country label under India',j=>{j[0].location.name='New York, US, India'}],
 ['foreign city under India',j=>{j[0].location.city='Paris'}],
 ['unadvertised secondary locations',j=>{j[0].secondary_locations=[{country:'US'}]}]
 ,['unadvertised redirect query',j=>{j[0].url_active_page+='?redirect=https://example.com';j[0].url_detected_page=j[0].url_active_page}]
])test('native board rejects '+name,()=>assert.throws(()=>parseCheckmarxBoard(mutate(board.body,'COMPANY_POSITIONS_DATA',j=>(change(j),j)),{now})))

for(const [name,change] of [
 ['UID',j=>{j.uid='DA.278'}],
 ['employer',j=>{j.company_name='Other employer'}],
 ['title',j=>{j.name='Other role'}],
 ['requisition',j=>{j.internal_use_custom_id='WRONG'}],
 ['internal role',j=>{j.is_internal=true}],
 ['HTTP200 status string',j=>{j.status='200'}],
 ['invalid calendar',j=>{j.time_updated='2026-02-30T12:00:00Z'}],
 ['future clock',j=>{j.time_updated='2099-01-01T00:00:00Z'}],
 ['new unverified publication field',j=>{j.datePosted='2026-10-21'}]
])test('native detail rejects wrong '+name,()=>assert.throws(()=>role(pune,mutate(pune.body,'POSITION_DATA',j=>(change(j),j)))))

for(const text of ['<div hidden>Develop and support application security engineering systems and lead technical teams at scale.</div>','<div inert>Develop and support application security engineering systems and lead technical teams at scale.</div>','<script>Build secure systems with talented engineers and help customers improve their software products.</script>','The full job description is currently unavailable. Please check back later for details about this position.','Please click Apply now to learn more about this opportunity and submit your application for this position.']){
 test('inactive or placeholder native description remains missing: '+text.slice(0,24),()=>{
   const j=role(pune,mutate(pune.body,'POSITION_DATA',p=>{p.custom_fields.details.find(f=>f.name==='Description').value=text;return p}))
   assert.equal(j.jobDescription,null);assert.equal(j.sourceDescription,null);assert.equal(j.sourceDetailComplete,false)
 })
}

test('active preload cannot come from template, hidden, inert, comments or quoted source text',()=>{
 for(const html of ['<template>'+board.body+'</template>','<div hidden>'+board.body+'</div>','<div inert>'+board.body+'</div>','<script>/* COMPANY_DATA = {"name":"Checkmarx"}; */</script>',"<script>const text='COMPANY_DATA = {\"name\":\"Checkmarx\"};';</script>"])assert.throws(()=>parseCheckmarxBoard(html,{now}))
})

test('genuinely empty required native section stays missing while a real full JD plus an apply footer remains intact',()=>{
 const empty=role(pune,mutate(pune.body,'POSITION_DATA',p=>{p.custom_fields.details.find(f=>f.name==='Requirements').value=null;return p}))
 assert.equal(empty.jobDescription,null);assert.equal(empty.sourceDetailComplete,false)
 const full=role(pune,mutate(pune.body,'POSITION_DATA',p=>{p.custom_fields.details.find(f=>f.name==='Description').value+='<p>Please click Apply now to learn more about this opportunity and submit your application for this position.</p>';return p}))
 assert.equal(full.sourceDetailComplete,true);assert.match(full.jobDescription,/Please click Apply now/)
})

test('duplicate fields and duplicate active native preloads cannot qualify',()=>{
 assert.throws(()=>parseCheckmarxBoard(board.body.replace('"company_uid": "C0.008"','"company_uid": "OTHER", "company_uid": "C0.008"'),{now}))
 assert.throws(()=>parseCheckmarxBoard(board.body+board.body,{now}))
})

test('an object property is not the active global native company preload',()=>{
 assert.throws(()=>parseCheckmarxBoard(board.body.replace('COMPANY_DATA =','notTheGlobal.COMPANY_DATA ='),{now}))
})

test('empty, capped and challenge inventories cannot become verified zero',()=>{
 assert.throws(()=>parseCheckmarxBoard(mutate(board.body,'COMPANY_POSITIONS_DATA',()=>[]),{now}))
 assert.throws(()=>parseCheckmarxBoard(board.body,{now,maxNativeRecords:29}))
 assert.throws(()=>parseCheckmarxBoard('<title>Just a moment...</title>',{now}))
})
