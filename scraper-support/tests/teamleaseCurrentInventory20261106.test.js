import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as teamlease from '../../scraper/teamlease/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
import {createTeamleaseReader} from '../../scraper/teamlease/boundedRead.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/teamlease20261106/capture.json.gz',import.meta.url))))
const expected=JSON.parse(fs.readFileSync(new URL('./fixtures/teamlease20261106/description-expectations.json',import.meta.url),'utf8')).documents
const feedURL=teamlease.buildSearchUrl(1),records=JSON.parse(fixture.documents[feedURL].body)
const compact=value=>value.replace(/\s/g,'').replace(/[–—]/g,'-')
const read=url=>{assert.ok(fixture.documents[url],'Only captured URLs may be read: '+url);return fixture.documents[url].body}
const listing=()=>teamlease.extractSearchResults(records)[0]
const original=read(records[0].link)
const options=()=>({now:()=> '2026-11-06T09:30:00.000Z',
 fetchJson:async url=>JSON.parse(read(url)),fetchText:async url=>read(url),
 fetchPage:async url=>({status:fixture.documents[url].status,url,headers:fixture.documents[url].headers,body:read(url)})})

test('TeamLease keeps all16 current published native records when the obsolete location classes are absent',()=>{
 const rows=teamlease.extractSearchResults(records)
 assert.equal(rows.length,16)
 assert.equal(new Set(rows.map(row=>row.jobId)).size,16)
 for(const row of rows){assert.equal(row.country,null);assert.equal(row.location,null);assert.equal(row.requisitionId,null)}
})
test('TeamLease preserves every full current native description and the actual role-scoped application handoff',()=>{
 for(const row of teamlease.extractSearchResults(records)){
  const detail=teamlease.extractJobDetail(read(row.sourceUrl),row,{now:'2026-11-06T09:30:00.000Z'})
  assert.equal(compact(detail.jobDescription),compact(expected[row.sourceUrl].completeDescriptionWithoutWhitespace))
  assert.equal(detail.applyUrl,row.sourceUrl+'#awsm-application-form')
  assert.equal(detail.country,null)
  assert.equal(detail.sourceCountryScopeUnresolved,true)
  assert.equal(detail.requisitionId,null)
  assert.equal(detail.sourceNativeJobPosting.hiringOrganization.name,'TeamLease Services Limited')
  assert.equal(detail.sourceNativeJobPosting.datePosted,expected[row.sourceUrl].datePosted)
 }
 assert.equal(teamlease.extractSearchResults(records).length,16,'A zero-row loop cannot satisfy the detail assertions')
})
test('TeamLease full configured source retains native observations, reconciles closing records and keeps scope incomplete',async()=>{
 const settings=options(),requested=[]
 settings.fetchPage=async url=>{requested.push(url);return {status:fixture.documents[url].status,url,headers:fixture.documents[url].headers,body:read(url)}}
 const jobs=await teamlease.run(settings)
 assert.equal(jobs.length,16)
 assert.deepEqual(requested,[teamlease.CAREERS_URL,feedURL,...records.map(row=>row.link),feedURL,teamlease.CAREERS_URL])
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 const observed=readSourceObservationEvidence(jobs,'teamlease')
 assert.equal(observed.observedRecordCount,16)
 assert.equal(observed.companyGlobalTotal,null)
 assert.equal(observed.companyIndiaTotal,null)
 for(const job of jobs){assert.equal(job.country,null);assert.equal(job.lifecycleCleanupAllowed,false)}
})
test('TeamLease rejects a canonical URL for a different native post',()=>{
 const changed=original.replace('<link rel="canonical" href="'+records[0].link+'"','<link rel="canonical" href="'+records[1].link+'"')
 assert.throws(()=>teamlease.extractJobDetail(changed,listing()),/TeamLease.*(?:identity|canonical|detail)/i)
})
test('TeamLease retained hidden canonical metadata cannot be bypassed by the visible canonical',()=>{
 const changed=original.replace('<link rel="canonical"','<link hidden rel="canonical" href="'+records[1].link+'"/><link rel="canonical"')
 assert.throws(()=>teamlease.extractJobDetail(changed,listing()),/TeamLease.*(?:identity|canonical|detail)/i)
})
test('TeamLease binds the AWSM application form native post ID to the feed row',()=>{
 const changed=original.replace(/(name="awsm_job_id"[^>]*value=")[^"]+/,'$1'+records[1].id)
 assert.notEqual(changed,original)
 assert.throws(()=>teamlease.extractJobDetail(changed,listing()),/TeamLease.*(?:identity|form|detail)/i)
})
test('TeamLease site-wide contact forms do not qualify when the role application form is hidden',()=>{
 const changed=original.replace('<form id="awsm-application-form"','<form hidden id="awsm-application-form"')
 assert.throws(()=>teamlease.extractJobDetail(changed,listing()),/TeamLease.*(?:application|form|detail)/i)
})
test('TeamLease does not substitute the feed excerpt when the actual visible role description is hidden',()=>{
 const changed=original.replace('class="awsm-job-entry-content entry-content"','hidden class="awsm-job-entry-content entry-content"')
 assert.notEqual(changed,original)
 assert.throws(()=>teamlease.extractJobDetail(changed,listing()),/TeamLease.*(?:description|content|detail)/i)
})
test('TeamLease rejects a changed native hiring organization',()=>{
 const changed=original.replace('"hiringOrganization":{"@type":"Organization","name":"TeamLease Services Limited"','"hiringOrganization":{"@type":"Organization","name":"Unrelated Company"')
 assert.notEqual(changed,original)
 assert.throws(()=>teamlease.extractJobDetail(changed,listing()),/TeamLease.*(?:employer|organization|detail)/i)
})
test('TeamLease validates published type, protected content and exact role origin before any native detail request',()=>{
 for(const row of [{...records[0],link:'https://unrelated.invalid/jobs/example/'},
  {...records[0],class_list:records[0].class_list.filter(name=>name!=='status-publish')},
  {...records[0],content:{...records[0].content,protected:true}}]){
  assert.throws(()=>teamlease.extractSearchResults([row]),/TeamLease.*(?:published|native|record|inventory)/i)
 }
})
test('TeamLease preserves an opaque caller cancellation without starting public reads',async()=>{
 const controller=new AbortController();controller.abort(0)
 let calls=0
 await assert.rejects(teamlease.run({...options(),signal:controller.signal,fetchPage:async()=>{calls++;throw Error('Must not read')}}),error=>error===0)
 assert.equal(calls,0)
})

const changePosting=(body,change)=>{
 let changed=0
 const result=body.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(whole,start,raw,end)=>{
  const value=JSON.parse(raw)
  if(value['@type']!=='JobPosting')return whole
  changed++;change(value);return start+JSON.stringify(value)+end
 })
 assert.equal(changed,1,'The synthetic control must change the actual native JobPosting')
 return result
}
test('TeamLease uses only typed native workplace country and preserves city-only uncertainty',()=>{
 for(const [address,country] of [[{addressLocality:'Bengaluru'},null],[{addressLocality:'Bengaluru',addressCountry:'GB'},'United Kingdom'],[{addressLocality:'Bengaluru',addressCountry:{'@type':'Country',name:'India'}},'India']]){
  const changed=changePosting(original,value=>{value.jobLocation={'@type':'Place',address}})
  const job=teamlease.extractJobDetail(changed,listing(),{now:'2026-11-06T09:30:00Z'})
  assert.equal(job.country,country)
  assert.equal(job.city,'Bengaluru')
  assert.equal(job.sourceCountryScopeUnresolved,country===null)
 }
})
test('TeamLease excludes expired native posts but retains missing closing dates as unknown',async()=>{
 const jobs=await teamlease.run({...options(),now:()=> '2026-11-21T09:30:00.000Z'})
 assert.equal(jobs.length,2)
 assert.deepEqual(jobs.map(job=>job.jobId),['39868','39099'])
 assert.ok(jobs.every(job=>job.closingDate===null&&job.sourceClosingStatusVerified===false))
 assert.equal(jobs.nativeCollectionEvidence.excludedPosts.length,14)
 assert.ok(jobs.nativeCollectionEvidence.excludedPosts.every(row=>row.reason==='native-expired-post'))
})
test('TeamLease an explicit output limit preserves full feed observations and closing reconciliation',async()=>{
 const jobs=await teamlease.run({...options(),maxJobs:1})
 assert.equal(jobs.length,1)
 assert.equal(jobs.nativeCollectionEvidence.observedPublishedPostCount,16)
 assert.equal(jobs.nativeCollectionEvidence.fullDescriptionCount,1)
 assert.equal(jobs.nativeCollectionEvidence.sourceExplicitLimit,1)
 assert.equal(jobs.nativeCollectionEvidence.openingClosingNativeRecordsMatch,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('TeamLease rejects native records changing during the collection',async()=>{
 let feedReads=0
 await assert.rejects(teamlease.run({...options(),maxJobs:1,fetchPage:async url=>{
  const page={status:fixture.documents[url].status,url,headers:fixture.documents[url].headers,body:read(url)}
  if(url===feedURL&&++feedReads===2){const changed=structuredClone(records);changed.at(-1).title.rendered+=' changed';page.body=JSON.stringify(changed)}
  return page
 }}),/Closing native inventory changed/)
 assert.equal(feedReads,2)
})
test('TeamLease stops duplicate native pagination before requesting role details',async()=>{
 const requested=[]
 await assert.rejects(teamlease.run({...options(),pageSize:16,fetchPage:async url=>{
  requested.push(url)
  if(url===teamlease.CAREERS_URL)return {status:200,url,headers:fixture.documents[url].headers,body:read(url)}
  return {status:200,url,headers:{'content-type':'application/json','x-wp-total':'32','x-wp-totalpages':'2'},body:JSON.stringify(records)}
 }}),/Repeated\/cyclic native/)
 assert.deepEqual(requested,[teamlease.CAREERS_URL,teamlease.buildSearchUrl(1,16),teamlease.buildSearchUrl(2,16)])
})
test('TeamLease rejects a visible archive card whose native ID changed',async()=>{
 const changed=read(teamlease.CAREERS_URL).replace('id="awsm-grid-item-39873"','id="awsm-grid-item-1"')
 assert.notEqual(changed,read(teamlease.CAREERS_URL))
 await assert.rejects(teamlease.run({...options(),fetchPage:async url=>({status:200,url,headers:fixture.documents[url].headers,body:url===teamlease.CAREERS_URL?changed:read(url)})}),/archive post identity/)
})
test('TeamLease public reader preserves mid-request opaque cancellation from an uncooperative callback',async()=>{
 const controller=new AbortController()
 let calls=0
 const reader=createTeamleaseReader({signal:controller.signal,fetchPage:async()=>{calls++;controller.abort(0);return new Promise(()=>{})}})
 try{await assert.rejects(reader.read(teamlease.CAREERS_URL),error=>error===0);assert.equal(calls,1)}finally{reader.close()}
})
test('TeamLease public reader bounds an uncooperative callback by its request deadline',async()=>{
 const reader=createTeamleaseReader({requestTimeoutMs:20,sourceTimeoutMs:1000,fetchPage:async()=>new Promise(()=>{})})
 try{await assert.rejects(reader.read(teamlease.CAREERS_URL),error=>error?.name==='TimeoutError')}finally{reader.close()}
})
