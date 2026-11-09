import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createBirlaNuScraper} from './script.js'
import {createBukuwarungScraper} from '../bukuwarung/script.js'

const description='<h2>Responsibilities</h2><p>Build reliable services and review production changes with the team.</p><h2>Qualifications</h2><p>Three years of JavaScript experience and a relevant degree or equivalent experience.</p>'
const row=(id='one',country='India')=>({id,title:'Platform Engineer '+id,locations:'Bengaluru, '+country,country,jd:description,posted_on:1793577600,experience:'3 years',department_name:'Engineering',emp_type_name:'Full time'})
const detail=r=>({status:'success',message:{job:[{...r,officelocation_show_arr:r.locations,job_posting:{careers:{from:r.posted_on}}}]}})
const configurations=[['birlanu',createBirlaNuScraper,'https://birlanu.com/people','https://iconnect-hil.darwinbox.in'],['bukuwarung',createBukuwarungScraper,'https://www.bukuwarung.com/career/','https://bukuwarung.darwinbox.com']]
function fixture(source,factory,official,origin,{rows=[row()],status=200,mutate,finalRows=rows}={}){
 const records=JSON.parse(gunzipSync(readFileSync(new URL('../'+source+'/test-data/current-public-20261103.json.gz',import.meta.url)))).responses
 const corporate=records[official];assert.equal(createHash('sha256').update(corporate.body).digest('hex'),corporate.sha256)
 const calls=[],listingReads=[],detailReads=[];let listingRound=0
 const fetchImpl=async(url,options={})=>{
  calls.push({url,method:options.method??'GET'})
  let body,type='application/json',code=200
  if(url===official){body=corporate.body;type='text/html'}
  else if(url===origin+'/ms/candidatev2/main/careers/allJobs'){body=records[url].body;type='text/html';assert.equal(createHash('sha256').update(body).digest('hex'),records[url].sha256)}
  else if(url===origin+'/ms/candidateapi/job/alljobs?companyId=main'){
   assert.equal(options.method,'POST');const q=JSON.parse(options.body);assert.deepEqual(Object.keys(q).sort(),['companyId','limit','page','sort_option']);assert.equal(q.companyId,'main')
   if(q.page===1)listingRound++;const current=listingRound>=3?finalRows:rows;listingReads.push(listingRound);code=status;body=status===200?JSON.stringify({status:'success',data:current.slice((q.page-1)*q.limit,q.page*q.limit),job_counts:current.length}):status===403?records[url].body:'rate limited'
  }else if(url.startsWith(origin+'/ms/candidateapi/job/')){assert.equal(options.method,'GET');const id=new URL(url).pathname.split('/').at(-1);detailReads.push(id);body=JSON.stringify(detail(rows.find(r=>r.id===id)))}
  else throw Error('Unexpected public request')
  body=mutate?.(url,body,{listingRound,detailReads})??body
  const response=new Response(body,{status:code,headers:{'content-type':type}});Object.defineProperty(response,'url',{value:url});return response
 }
 return{scraper:factory(),fetchImpl,calls,listingReads,detailReads}
}
for(const c of configurations){const[source,factory,official,origin]=c
 test(source+' reads the full bound native board, all public detail criteria, publisher date and final listing after details',async()=>{
  const t=fixture(...c,{rows:[row(),row('two','Indonesia')]});const result=await t.scraper.collect({fetchImpl:t.fetchImpl,requestIntervalMs:0})
  assert.equal(result.nativeRoles.length,2);assert.equal(result.jobs.length,1);assert.equal(result.jobs[0].country,'India');assert.match(result.jobs[0].jobDescription,/relevant degree/);assert.equal(result.jobs[0].postingDate,'2026-11-02T00:00:00.000Z');assert.equal(result.jobs[0].sourceNativeDetail.posted_on,1793577600)
  assert.equal(t.detailReads.length,4);assert.equal(t.listingReads.length,3);assert.match(t.calls.at(-1).url,/alljobs\?/);assert.equal(result.inventoryEvidence.listingComplete,true)
 })
 test(source+' never turns public denial into empty and makes only one denied network request',async()=>{
  for(const status of[403,429]){const t=fixture(...c,{status});await assert.rejects(t.scraper.run({fetchImpl:t.fetchImpl}),e=>e.status===status&&e.abortRetries===true);assert.equal(t.calls.filter(c=>c.url.includes('/alljobs?')).length,1)}
 })
 test(source+' fails closed on inactive/changed current corporate handoff before native requests',async()=>{
  const t=fixture(...c,{mutate:(url,body)=>url===official?body.replaceAll(origin,'https://unrelated.darwinbox.com'):body});await assert.rejects(t.scraper.run({fetchImpl:t.fetchImpl}),/handoff|binding/i);assert.equal(t.calls.length,1)
 })
 test(source+' retains raw unknown countries and real missing descriptions without a publishable placeholder',async()=>{
  const unknown={...row('unknown'),locations:'Bengaluru',country:null},placeholder={...row('prompt'),jd:'<p>Please enter job description</p>'}
  const t=fixture(...c,{rows:[row(),unknown,placeholder]});const result=await t.scraper.collect({fetchImpl:t.fetchImpl});assert.equal(result.nativeRoles.length,3);assert.equal(result.jobs.length,1);assert.equal(result.inventoryEvidence.listingComplete,false);assert.equal(result.inventoryEvidence.indiaFacetCount,null);assert.equal(result.unknownCountries.length,1);assert.equal(result.heldRoles.length,1);assert.match(result.heldRoles[0].nativeDetail.jd,/Please enter job description/)
 })
 test(source+' quarantines country conflicts and roles removed during last detail hydration',async()=>{
  const rows=[row(),row('two')],t=fixture(...c,{rows,finalRows:[rows[0]]});const result=await t.scraper.collect({fetchImpl:t.fetchImpl});assert.deepEqual(result.jobs.map(r=>r.jobId),['one']);assert.equal(result.inventoryEvidence.listingComplete,false);assert.ok(result.heldRoles.some(r=>r.jobId==='two'&&r.reason.includes('closing')))
  const conflict=fixture(...c,{mutate:(url,body)=>url.includes('/job/one?')?body.replace('"country":"India"','"country":"Indonesia"'):body});const held=await conflict.scraper.collect({fetchImpl:conflict.fetchImpl});assert.equal(held.jobs.length,0);assert.equal(held.inventoryEvidence.indiaFacetCount,null)
 })
 test(source+' bounds fetch/body collaborators that ignore abort and preserves caller cancellation',async()=>{
  const scraper=factory();await assert.rejects(scraper.run({timeoutMs:30,fetchImpl:()=>new Promise(()=>{})}),/deadline|budget|time/i)
  await assert.rejects(scraper.run({timeoutMs:30,fetchImpl:async()=>({status:200,url:official,headers:{get:()=>null},text:()=>new Promise(()=>{})})}),/deadline|budget|time/i)
  const controller=new AbortController(),reason=Error('caller cancelled');controller.abort(reason);await assert.rejects(scraper.run({signal:controller.signal,fetchImpl:()=>assert.fail('no request')}),e=>e===reason)
 })
 test(source+' permits verified empty only after three observed native inventories and corporate closing',async()=>{
  const t=fixture(...c,{rows:[]});const jobs=await t.scraper.run({fetchImpl:t.fetchImpl});assert.equal(readInventoryEvidence(jobs).status,'verified-empty');assert.equal(t.listingReads.length,3);assert.equal(t.calls.filter(r=>r.url===official).length,2)
 })
 test(source+' fully paginates foreign inventory before caller caps and retains every public criteria field',async()=>{
  const rows=Array.from({length:12},(_,i)=>row(String(i+1),i===0?'India':'Indonesia')),t=fixture(...c,{rows,mutate:(url,body)=>url.includes('/job/1?')?body.replace('"message":','"message":').replace('"jd":','"minimum_qualification":"Bachelor degree","public_screening_questions":[{"label":"Which certification do you hold?","required":true}],"jd":'):body})
  const result=await t.scraper.collect({fetchImpl:t.fetchImpl,maxJobs:1});assert.equal(result.nativeRoles.length,12);assert.equal(result.jobs.length,1);assert.equal(t.listingReads.length,6);assert.equal(t.detailReads.length,24);assert.equal(result.jobs[0].sourceNativeDetail.minimum_qualification,'Bachelor degree');assert.equal(result.jobs[0].sourceNativeDetail.public_screening_questions[0].required,true)
 })
 test(source+' holds foreign detail country conflicts, invalid native regions and changed publisher epochs',async()=>{
  for(const opts of[
   {rows:[row('one','Indonesia')],mutate:(url,body)=>url.includes('/job/one?')?body.replace('"country":"Indonesia"','"country":"India"'):body},
   {rows:[row('one','Indonesia')],mutate:(url,body)=>url.includes('/job/one?')?body.replace('"jd":','"tool_tip_locations":["Bengaluru, India"],"jd":'):body},
   {mutate:(url,body)=>url.includes('/job/one?')?body.replace('"jd":','"company_name":"Unrelated Employer","jd":'):body},
   {rows:[{...row(),locations:'Unspecified',country:'ZZ'}]},
   {mutate:(url,body)=>url.includes('/job/one?')?body.replace('"from":1793577600','"from":1793491200'):body}
  ]){const t=fixture(...c,opts),result=await t.scraper.collect({fetchImpl:t.fetchImpl});assert.equal(result.jobs.length,0);assert.equal(result.inventoryEvidence.listingComplete,false);assert.equal(result.inventoryEvidence.indiaFacetCount,null)}
 })
 test(source+' rejects duplicate IDs and contradictory totals instead of certifying zero',async()=>{
  for(const opts of[
   {rows:[row(),row()]},
   {mutate:(url,body)=>url.includes('/alljobs?')?body.replace('"job_counts":1','"job_counts":0'):body}
  ]){const t=fixture(...c,opts);await assert.rejects(t.scraper.collect({fetchImpl:t.fetchImpl}),/inventory|identity|incomplete|inconsistent/i)}
 })
 test(source+' never waits for a denied response cancellation collaborator',async()=>{
  const start=Date.now();await assert.rejects(factory().run({timeoutMs:100,fetchImpl:async url=>({status:403,url,body:{cancel:()=>new Promise(()=>{})}})}),e=>e.status===403);assert.ok(Date.now()-start<90)
 })
 test(source+' retains healthy peers when one native public detail is missing or mismatched',async()=>{
  for(const mutate of[(url,body)=>url.includes('/job/one?')?body.replace('"id":"one"','"id":"another"'):body,(url,body)=>url.includes('/job/one?')?JSON.stringify({status:'success',message:{job:[]}}):body]){
   const t=fixture(...c,{rows:[row(),row('two')],mutate}),result=await t.scraper.collect({fetchImpl:t.fetchImpl});assert.deepEqual(result.jobs.map(r=>r.jobId),['two']);assert.equal(result.nativeRoles.length,2);assert.equal(result.heldRoles.length,1);assert.equal(result.inventoryEvidence.listingComplete,false);assert.equal(result.inventoryEvidence.indiaFacetCount,null)
  }
 })
 test(source+' awaits rejecting and abort-ignoring async audit observers within the collection deadline',async()=>{
  const reason=Error('observer failed'),rejected=Promise.reject(reason);rejected.catch(()=>{});const t=fixture(...c,{rows:[]});await assert.rejects(t.scraper.run({fetchImpl:t.fetchImpl,onAudit:()=>rejected}),e=>e===reason)
  const hanging=fixture(...c,{rows:[]});await assert.rejects(hanging.scraper.run({fetchImpl:hanging.fetchImpl,timeoutMs:100,onAudit:()=>new Promise(()=>{})}),/deadline|budget|time/i)
 })
 test(source+' accepts maxJobs zero as unbounded while still closing native inventory',async()=>{
  const t=fixture(...c,{rows:[row(),row('two')]});const result=await t.scraper.collect({fetchImpl:t.fetchImpl,maxJobs:0});assert.equal(result.jobs.length,2);assert.equal(t.listingReads.length,3)
 })
 test(source+' accepts grouped native India worksites only when every concrete address proves India',async()=>{
  for(const country of['India','Indonesia']){const t=fixture(...c,{mutate:(url,body)=>url.includes('/job/one?')?body.replace('"country":"India",','').replace('"officelocation_show_arr":"Bengaluru, India"','"officelocation_show_arr":"Multiple locations","officelocation_show_arr_list":["Multiple locations"],"tool_tip_locations":["Bengaluru, India","Mumbai, '+country+'"]'):body}),result=await t.scraper.collect({fetchImpl:t.fetchImpl});assert.equal(result.jobs.length,country==='India'?1:0);assert.equal(result.inventoryEvidence.listingComplete,country==='India')}
 })
}
