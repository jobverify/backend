import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
const source='myoperator',expected=16
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261114.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const provider=getScraperCatalog().find(row=>row.source===source)
const scraper=()=>createCatalogScraper(provider)
function replay(change=(_url,row)=>row){
 const requests=[],counts=new Map()
 const read=async(url,init={})=>{
  url=String(url);init.signal?.throwIfAborted();const count=(counts.get(url)||0)+1;counts.set(url,count)
  const matches=fixture.responses.filter(row=>row.url===url),original=matches[Math.min(count-1,matches.length-1)]
  assert.ok(original,'Undeclared public read '+url);assert.equal(init.method||'GET','GET')
  requests.push(url);const row=await change(url,structuredClone(original),count,init)
  const response=new Response(row.body,{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalUrl??row.url});return response
 }
 return {read,requests}
}

test('myoperator current registered native collector recovers full original explicit India roles with scope held',async t=>{
 for(const row of fixture.responses)assert.equal(sha(row.body),row.sha256)
 const transport=replay();t.mock.method(globalThis,'fetch',transport.read)
 const jobs=await scraper().run({fetchImpl:transport.read,now:()=>fixture.capturedAt})
 assert.equal(jobs.length,expected)
 assert.ok(jobs.every(job=>job.sourceDescriptionHTML===job.sourceNativeDetailRecord.Job_Description))
 assert.equal(jobs.find(job=>job.jobId==='163599000032779618').postingDate,'2026-11-03')
 assert.equal(analyzePublishableJobs(jobs,{now:fixture.capturedAt}).eligibleJobs.length,2)
 assert.ok(jobs.every(job=>job.country==='India'&&job.source===source&&job.sourceDetailComplete===true&&job.sourceClosingReconciled===true&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(job=>job.sourceDescription.length>300&&job.sourceDescriptionHTML.length>300))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(assessSoftFailureAcquisition(provider,jobs).runnerOutcome.success,true)
})

const {readMyOperatorPortal,readMyOperatorList,readMyOperatorDetail,BOARD,API}=await import('./currentNative.js')
const saved=url=>fixture.responses.find(row=>row.url===url).body
const portal=()=>readMyOperatorPortal(saved(BOARD))
const listed=()=>readMyOperatorList(saved(API),portal().rows)
const detailURL=id=>'https://careers.myoperator.com/recruit/v2/public/Job_Openings/'+id+'?source=CareerSite&pagename=Careers'
function carrier(html,id,edit){
 const {readNativeDocument}=nativeHTML
 const doc=readNativeDocument(html),node=doc.nodes(n=>n.tag==='input'&&n.attrs.id===id)[0],value=JSON.parse(node.attrs.value)
 edit(value)
 const encoded=JSON.stringify(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')
 const tag=new RegExp('<input\\b[^>]*\\bid="'+id+'"[^>]*>')
 return html.replace(tag,part=>part.replace(/value="[^"]*"/,()=> 'value="'+encoded+'"'))
}
const nativeHTML=await import('../../scraper-support/utils/activeNativeHtml.js')
for(const [name,edit]of [
 ['wrong employer',m=>{m.org_info.company_name='Other'}],['wrong employer website',m=>{m.org_info.website='https://other.example/'}],
 ['another organization',m=>{m.org_info.id='163599000000320472'}],['wrong native page',m=>{m.page_id='other'}],
 ['staffing account',m=>{m.org_info.type='staffing'}],['employee portal',m=>{m.employee_portal=true}],
 ['logged in carrier',m=>{m.portal_user.is_loggedin=true}],
])test('MyOperator rejects '+name,()=>assert.throws(()=>readMyOperatorPortal(carrier(saved(BOARD),'meta',edit)),/native/i))
test('MyOperator rejects changed published field/layout declarations',()=>assert.throws(()=>readMyOperatorPortal(carrier(saved(BOARD),'moduleMeta',m=>{m[0].layouts[0].sections[2].fields.push({api_name:'Extra_Requirements'})})),/declarations/))
for(const [name,edit]of [
 ['native continuation',v=>{v.info.more_records=true}],['duplicate native IDs',v=>{v.data[1].id=v.data[0].id}],
 ['added native criterion',v=>{v.data[0].Requirements='Unreviewed requirement'}],['foreign native role URL',v=>{v.data[0].$url='https://other.example/job'}],
 ['missing current row',v=>{v.data.pop()}],['impossible Date_Opened',v=>{v.data[0].Date_Opened='31/02/2026'}],
])test('MyOperator rejects '+name,()=>{const v=JSON.parse(saved(API));edit(v);assert.throws(()=>readMyOperatorList(JSON.stringify(v),portal().rows),/native/i)})
for(const [name,edit]of [
 ['changed native ID',r=>{r.id='163599000032779619'}],['country conflict',r=>{r.Country='India, Singapore'}],
 ['native active state conflict',r=>{r.Publish=false}],['locked detail',r=>{r.Is_Locked=true}],
 ['foreign application',r=>{r.$appy_url='https://other.example/apply'}],['changed original public date',r=>{r.Date_Opened='2026-11-04'}],
 ['added full criterion',r=>{r.Requirements='Unreviewed requirement'}],['missing full original criteria',r=>{r.Job_Description=''}],
 ['hidden original criteria',r=>{r.Job_Description+='<p hidden>Additional mandatory license</p>'}],
 ['executable original criteria',r=>{r.Job_Description+='<img src="x" onerror="window.criteria=true">'}],
 ['generic CV intake',r=>{r.Job_Description='<p>Send your CV to join our talent community and hear from us.</p>'.repeat(20)}],
])test('MyOperator rejects '+name,()=>{const row=listed().find(r=>r.id==='163599000032779618'),value=JSON.parse(saved(detailURL(row.id)));edit(value.data[0]);assert.throws(()=>readMyOperatorDetail(JSON.stringify(value),row),/native|criteria/i)})

test('MyOperator full native detail criteria change at closing quarantines only that exact role',async()=>{
 const id='163599000032779618',transport=replay((url,row,count)=>{if(url===detailURL(id)&&count===2){const v=JSON.parse(row.body);v.data[0].Job_Description+='<p>Additional mandatory qualification.</p>';row.body=JSON.stringify(v)}return row})
 const jobs=await scraper().run({fetchImpl:transport.read,now:()=>fixture.capturedAt})
 assert.equal(jobs.length,15);assert.equal(jobs.some(j=>j.jobId===id),false)
 assert.ok(jobs.nativeCollectionEvidence.holds.some(h=>h.id===id&&h.reason==='native-full-detail-changed-at-closing'))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('MyOperator never certifies source absence for inactive, unknown or foreign native inventory',async()=>{
 const change=rows=>{for(let i=0;i<rows.length;i++){if(i%3===0)rows[i].Country='';else if(i%3===1)rows[i].Country='United States';else rows[i].Publish=false}}
 const transport=replay((url,row)=>{if(url===BOARD)row.body=carrier(row.body,'jobs',change);if(url===API){const v=JSON.parse(row.body);change(v.data);row.body=JSON.stringify(v)}return row})
 const jobs=await scraper().run({fetchImpl:transport.read,now:()=>fixture.capturedAt})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(assessSoftFailureAcquisition(provider,jobs).runnerOutcome.success,false)
 assert.equal(transport.requests.some(url=>url.includes('/Job_Openings/')),false)
})

for(const options of [{maxJobs:0},{fetchText:async()=>'<p>Body only</p>'},{fetchJson:async()=>({})}])test('myoperator rejects unsupported extraction override '+Object.keys(options)[0]+' before I/O',async()=>{
 let calls=0
 await assert.rejects(scraper().run({...options,fetchImpl:async()=>{calls++;throw Error('Unexpected I/O')}}))
 assert.equal(calls,0)
})
test('myoperator preserves the opaque caller abort before acquisition',async()=>{
 const reason={caller:'stop'},controller=new AbortController();controller.abort(reason);let calls=0
 await assert.rejects(scraper().run({signal:controller.signal,fetchImpl:async()=>{calls++;throw Error('Unexpected I/O')}}),error=>error===reason)
 assert.equal(calls,0)
})
test('myoperator propagates cancellation and cancels a late original response',async()=>{
 const reason={caller:'pending-stop'},controller=new AbortController();let release,cancels=0,calls=0
 const pending=scraper().run({signal:controller.signal,fetchImpl:async()=>{calls++;return new Promise(resolve=>{release=resolve})}})
 await new Promise(resolve=>setImmediate(resolve));controller.abort(reason);await assert.rejects(pending,error=>error===reason)
 const response=new Response(new ReadableStream({cancel(){cancels++}}),{headers:{'content-type':'text/html'}})
 Object.defineProperty(response,'url',{value:fixture.responses[0].url});release(response)
 await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve))
 assert.equal(calls,1);assert.equal(cancels,1)
})
test('myoperator retains existing bounded request deadline',async()=>{
 await assert.rejects(scraper().run({requestTimeoutMs:10,fetchImpl:()=>new Promise(()=>{})}),error=>error.name==='TimeoutError')
})
for(const status of [403,404])test('myoperator preserves public HTTP '+status+' and exact original URL',async()=>{
 const transport=replay((_url,row)=>({...row,status}));await assert.rejects(scraper().run({fetchImpl:transport.read,now:()=>fixture.capturedAt}),error=>error.status===status&&error.abortRetries===true)
 assert.equal(transport.requests.length,1)
})

test('MyOperator rejects listing plain-text criteria missing from its rich full detail',()=>{
 const row=listed().find(r=>r.id==='163599000032779618');row.Job_Description+=' Mandatory additional professional registration.'
 assert.throws(()=>readMyOperatorDetail(saved(detailURL(row.id)),row),/original criteria.*disagree/i)
})

for(const notice of ['This position is closed. We are no longer accepting applications.','This job has been filled.','Applications are closed.'])test('MyOperator rejects consistent active-state contradiction: '+notice,()=>{
 const row=listed().find(r=>r.id==='163599000032779618'),value=JSON.parse(saved(detailURL(row.id)))
 row.Job_Description=notice+'\n'+row.Job_Description;value.data[0].Job_Description='<p>'+notice+'</p>'+value.data[0].Job_Description
 assert.equal(row.Publish,true);assert.equal(value.data[0].Publish,true)
 assert.throws(()=>readMyOperatorDetail(JSON.stringify(value),row),/native.*(?:closed|inactive)|closed.*native/i)
})
test('MyOperator registered acquisition rejects closed criteria consistently repeated by every original carrier',async()=>{
 const id='163599000032779618',notice='This position is closed. We are no longer accepting applications.',prepend=rows=>{const role=rows.find(r=>r.id===id);role.Job_Description=notice+'\n'+role.Job_Description}
 const transport=replay((url,row)=>{
  if(url===BOARD)row.body=carrier(row.body,'jobs',prepend)
  if(url===API){const value=JSON.parse(row.body);prepend(value.data);row.body=JSON.stringify(value)}
  if(url===detailURL(id)){const value=JSON.parse(row.body);value.data[0].Job_Description='<p>'+notice+'</p>'+value.data[0].Job_Description;row.body=JSON.stringify(value)}
  return row
 })
 await assert.rejects(scraper().run({fetchImpl:transport.read,now:()=>fixture.capturedAt}),/native.*(?:closed|inactive)|closed.*native/i)
 assert.equal(transport.requests.at(-1),detailURL(id))
 assert.equal(transport.requests.length,4+listed().findIndex(row=>row.id===id))
})
