import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run as runFinolex} from '../../scraper/finolexindustrieslimited/script.js'
import {run as runGoodnotes} from '../../scraper/goodnotes/script.js'
import {readCurrentGoodnotesBoard,readCurrentGoodnotesDetail} from '../../scraper/goodnotes/currentNative.js'
import {readNativeDocument} from '../utils/activeNativeHtml.js'
import {createCurrentNativeReader} from '../native-sources/boundedCurrentNativeRead20261106.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/currentNative20261106C27/capture.json.gz',import.meta.url))))
const listing='https://www.finolexpipes.com/apis/joblist/',client='https://www.finolexpipes.com/site/templates/assets/js/career-new.js',board='https://job-boards.greenhouse.io/goodnotes',corporate='https://www.goodnotes.com/careers'
const original=url=>fixture.responses.find(row=>row.requestedUrl===url)
function fixtureTransport(mutate=(_,row)=>row,seen=[]){
 const counts=new Map()
 return async(url,init)=>{
  assert.ok(original(url),'Unexpected native URL '+url)
  assert.equal(init.method,url===listing?'POST':'GET');if(url===listing)assert.equal(init.body,'Activity=joblist')
  const count=(counts.get(url)??0)+1;counts.set(url,count);seen.push({url,method:init.method,body:init.body??null})
  const row=mutate(url,structuredClone(original(url)),count)
  return {status:row.status,finalUrl:row.finalUrl,headers:row.headers,body:row.body}
 }
}
function alterState(html,mutate){
 const script=readNativeDocument(html).nodes(node=>node.tag==='script'&&node.raw?.startsWith('window.__remixContext = '))[0]
 const prefix='window.__remixContext = ',state=JSON.parse(script.raw.slice(prefix.length).trim().replace(/;$/,''))
 mutate(state);return html.replace(script.raw,prefix+JSON.stringify(state)+';')
}
test('a known removed Finolex record stays withheld after later client HTTP 503',async()=>{
 const jobs=await runFinolex({fetchPage:fixtureTransport((url,row,count)=>{
  if(url===listing&&count===2)row.body=JSON.stringify(JSON.parse(row.body).filter(job=>job.id!==43))
  if(url===client&&count===2)row.status=503
  return row
 })})
 assert.equal(jobs.length,13);assert.equal(jobs.some(row=>row.jobId==='43'),false)
 assert.equal(jobs.nativeCollectionEvidence.closingReconciled,false);assert.equal(jobs.nativeCollectionEvidence.closingFailure.status,503)
 assert.ok(jobs.nativeCollectionEvidence.holds.some(row=>row.nativeId==='43'&&row.reason==='native-record-missing-unpublished-or-changed-at-closing'))
})
test('changed Finolex criteria are withheld without coalescing distinct unchanged native IDs',async()=>{
 const jobs=await runFinolex({fetchPage:fixtureTransport((url,row,count)=>{
  if(url===listing&&count===2){const records=JSON.parse(row.body);records[0].summary=records[0].summary.replace('3-5 years','6-8 years');row.body=JSON.stringify(records)}
  return row
 })})
 assert.equal(jobs.length,13);assert.equal(jobs.some(row=>row.jobId==='43'),false)
 assert.ok(jobs.some(row=>row.jobId==='55'));assert.ok(jobs.some(row=>row.jobId==='56'))
 assert.equal(jobs.nativeCollectionEvidence.closingReconciled,true)
})
test('an output cap cannot hide a malformed record at the end of Finolex inventory',async()=>{
 await assert.rejects(runFinolex({maxJobs:1,fetchPage:fixtureTransport((url,row)=>{
  if(url===listing){const records=JSON.parse(row.body);records[13].id=43;row.body=JSON.stringify(records)}return row
 })}),/duplicate|record/i)
})
test('caller options cannot turn the Finolex inventory query into an application operation',async()=>{
 const seen=[],jobs=await runFinolex({maxJobs:1,method:'POST',body:'Activity=sendmail',requests:[[listing,{method:'POST',body:'Activity=sendmail'}]],fetchPage:fixtureTransport(undefined,seen)})
 assert.equal(jobs.length,1);assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,14)
 assert.deepEqual(seen.filter(row=>row.method==='POST').map(row=>row.body),['Activity=joblist','Activity=joblist'])
})
test('a known removed Goodnotes role stays withheld after later corporate HTTP 503',async()=>{
 const jobs=await runGoodnotes({fetchPage:fixtureTransport((url,row,count)=>{
  if(url===board&&count===2)row.body=alterState(row.body,state=>{const posts=state.state.loaderData['routes/$url_token'].jobPosts;posts.data=posts.data.filter(job=>job.id!==6216615004);posts.count=4;posts.total=4})
  if(url===corporate&&count===2)row.status=503
  return row
 })})
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.closingReconciled,false)
 assert.equal(jobs.nativeCollectionEvidence.closingFailure.status,503)
 assert.ok(jobs.nativeCollectionEvidence.holds.some(row=>row.nativeId==='6216615004'&&row.reason==='native-record-missing-unpublished-or-changed-at-closing'))
})
test('Goodnotes rejects native filters, duplicate carrier authority and new delegated programs',()=>{
 const html=original(board).body
 assert.throws(()=>readCurrentGoodnotesBoard(alterState(html,state=>state.state.loaderData['routes/$url_token'].officeIds=[4112158004])),/filter/i)
 const carrier=readNativeDocument(html).nodes(node=>node.tag==='script'&&node.raw?.startsWith('window.__remixContext = '))[0].raw
 assert.throws(()=>readCurrentGoodnotesBoard(html.replace('</body>','<script>'+carrier+'</script></body>')),/ambiguous/i)
 assert.throws(()=>readCurrentGoodnotesBoard(html.replace('</body>','<iframe srcdoc="replacement"></iframe></body>')),/program|delegated/i)
 assert.throws(()=>readCurrentGoodnotesBoard(html.replace('</body>','<script>replaceRoles()</script></body>')),/program|renderer/i)
})
test('Goodnotes rejects another native employer even if the visible header stays unchanged',()=>{
 assert.throws(()=>readCurrentGoodnotesBoard(alterState(original(board).body,state=>state.state.loaderData['routes/$url_token'].board.name='Another employer')),/employer/i)
})
test('Goodnotes criteria must match the visible role body and its exact native board identity',()=>{
 const records=readCurrentGoodnotesBoard(original(board).body).records,row=records.find(row=>row.id===6216615004),html=original(row.absolute_url).body
 assert.throws(()=>readCurrentGoodnotesDetail(html.replace('Our Values','Replacement visible section'),row),/criteria|data/i)
 assert.throws(()=>readCurrentGoodnotesDetail(alterState(html,state=>state.state.loaderData['routes/$url_token_.jobs_.$job_post_id'].jobPost.public_url='https://job-boards.greenhouse.io/other/jobs/6216615004'),row),/canonical|identity|disagree/i)
})
test('a pending native POST stream preserves the exact caller abort and releases the reader',async()=>{
 let started,resolveRead,canceled=0,released=0,cancelReason
 const bodyStarted=new Promise(resolve=>{started=resolve}),controller=new AbortController(),reason=Error('cancel pending POST body')
 const reader=createCurrentNativeReader({signal:controller.signal,fetchImpl:async url=>({status:200,url,headers:new Headers({'content-type':'application/json'}),body:{getReader(){return {read(){started();return new Promise(resolve=>{resolveRead=resolve})},cancel(value){canceled++;cancelReason=value},releaseLock(){released++}}}}})},
  {source:'finolexindustrieslimited',admitted:[[listing,'json']],requests:[[listing,{method:'POST',body:'Activity=joblist'}]]})
 const pending=reader.read(listing)
 try{await bodyStarted;controller.abort(reason);await assert.rejects(pending,error=>error===reason);resolveRead({done:true});await new Promise(resolve=>setImmediate(resolve))
  assert.equal(canceled,1);assert.equal(cancelReason,reason);assert.equal(released,1);assert.equal(reader.stats().receipts[0].method,'POST')
 }finally{reader.close()}
})
test('a source query cannot be admitted as HTML or to an undeclared URL',()=>{
 for(const profile of [
  {source:'test',admitted:[[listing,'html']],requests:[[listing,{method:'POST',body:'Activity=joblist'}]]},
  {source:'test',admitted:[[listing,'json']],requests:[['https://www.finolexpipes.com/apis/form_api/',{method:'POST',body:'Activity=joblist'}]]},
 ])assert.throws(()=>createCurrentNativeReader({},profile),/query/i)
})
