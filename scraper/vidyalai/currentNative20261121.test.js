import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {setTimeout as wait} from 'node:timers/promises'
import {hasOfficialHomepageSignal,extractOpenJobs,hasVerifiedDetailPage} from './script.js'
import {inspectNativeBoard,inspectNativeDetail,runNativeVidyalai} from './nativeData20261121.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261121.json.gz',import.meta.url))))
const originalHome=Buffer.from(fixture.packets[0].bodyBase64,'base64').toString('utf8')
const boardURL='https://erp.vidyalai.com/jobs',boardHTML=Buffer.from(fixture.packets[1].bodyBase64,'base64').toString('utf8'),listing=()=>inspectNativeBoard(boardHTML)
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
test('original byte bound never awaits stalled stream cancellation beyond the collection deadline',{timeout:2000},async()=>{
 const homePacket=fixture.packets[0],caller=new AbortController(),prefix=Buffer.from(homePacket.bodyBase64,'base64'),bytes=Buffer.concat([prefix,Buffer.alloc(2*1024*1024+1-prefix.length)])
 let releaseCancel,cancelCalls=0,reads=0,settled=false
 const stream=new ReadableStream({start(control){control.enqueue(new Uint8Array(bytes))},cancel(){cancelCalls++;return new Promise(resolve=>{releaseCancel=resolve})}})
 const pending=runNativeVidyalai({signal:caller.signal,collectionBudgetMs:15,requestIntervalMs:0,fetchPage:async(url)=>{reads++;assert.equal(url,homePacket.url);return{status:200,url,headers:new Headers(homePacket.headers),body:stream}}}).then(()=>{settled=true},()=>{settled=true})
 await wait(70);const settledBeforeCancelRelease=settled;releaseCancel?.();await pending;caller.abort()
 assert.equal(settledBeforeCancelRelease,true);assert.equal(cancelCalls,1);assert.equal(reads,1)
})
test('terminal public denial closes the source-owned request signal while preserving the caller signal',async()=>{
 const homePacket=fixture.packets[0],caller=new AbortController(),calls=[]
 await assert.rejects(runNativeVidyalai({signal:caller.signal,requestIntervalMs:0,fetchPage:async(url,init)=>{calls.push({url,init});return{status:403,url,headers:new Headers(homePacket.headers),body:'Denied'}}}),/HTTP/)
 const ownedAborted=calls[0].init.signal.aborted,callerAborted=caller.signal.aborted;caller.abort()
 assert.equal(calls.length,1);assert.equal(callerAborted,false);assert.equal(ownedAborted,true)
})
const replay=(transform=()=>{})=>{
 const calls=[],occurrences=new Map()
 const fetchPage=async(url,init)=>{
  const packet=fixture.packets.find(row=>row.url===url);assert.ok(packet,'Only exact retained public routes may be requested')
  const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(sha(bytes),packet.sha256)
  const occurrence=(occurrences.get(url)??0)+1;occurrences.set(url,occurrence);calls.push(url)
  const response={status:packet.status,url:packet.url,headers:new Headers(packet.headers),body:bytes.toString('utf8')}
  return await transform({url,init,occurrence,response,calls})??response
 }
 return{calls,fetchPage,requestIntervalMs:0}
}

test('actual current exact Vidyalai title and six published career handoffs retain native employer identity',()=>{
 assert.equal(hasOfficialHomepageSignal(originalHome),true)
})

test('an unqualified city field is not a native country or permission for shared city inference',()=>{
 const jobs=extractOpenJobs({data:[{name:'original-route-model',job_title:'Senior Software Engineer',company:'Vidyalai',status:'Open',route:'jobs/vidyalai/senior-software-engineer',department:'Development - V',employment_type:'Full-time',location:'Kochi'}]})
 assert.equal(jobs[0].location,'Kochi');assert.equal(jobs[0].country,null)
 assert.equal(jobs[0].sourceCountryScopeUnresolved,true)
})

test('the real native detail requires its full criteria owner even if title and application label remain',()=>{
 const packet=fixture.packets[2],html=Buffer.from(packet.bodyBase64,'base64').toString('utf8')
 const record={job_title:'Senior Software Engineer',route:'jobs/vidyalai/senior-software-engineer'}
 assert.equal(hasVerifiedDetailPage({status:packet.status,url:packet.url,html},record),true)
 const withoutCriteria=html.replace(/<div class="ql-editor read-mode">[\s\S]*?<\/div>/,'<div class="ql-editor read-mode"></div>')
 assert.notEqual(withoutCriteria,html)
 assert.equal(hasVerifiedDetailPage({status:packet.status,url:packet.url,html:withoutCriteria},record),false)
})

for(const packet of fixture.packets.filter(row=>row.url!==fixture.packets[0].url&&row.url!==boardURL))test('full original criteria and native unknown country schema: '+packet.url.split('/').at(-1),()=>{
 const record=listing().records.find(row=>row.url===packet.url);assert.ok(record)
 const html=Buffer.from(packet.bodyBase64,'base64').toString('utf8'),detail=inspectNativeDetail(html,record)
 assert.equal(detail.nativeDetailHTML,html);assert.ok(detail.jobDescription);assert.ok(html.includes(detail.jobDescription))
 assert.equal(detail.fields.Location,record.location);assert.equal(detail.fields.Department,record.department);assert.equal(detail.fields['Employment Type'],record.nativeEmploymentType)
})

test('actual original native model reconciles all16full details and preserves unknown-country and lifecycle holds',async()=>{
 const source=replay(),jobs=await runNativeVidyalai(source)
 assert.equal(source.calls.length,36);assert.equal(jobs.length,16);assert.equal(jobs.nativeCollectionEvidence.fullRawCriteriaRecords,16)
 assert.equal(jobs.nativeCollectionEvidence.closingReconciled,true);assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)
 for(const job of jobs){assert.equal(job.country,null);assert.equal(job.countryCode,null);assert.equal(job.sourceCountryScopeUnresolved,true);assert.equal(job.postingDate,null);assert.equal(job.closingDate,null);assert.equal(job.link,null);assert.equal(job.applyUrl,null);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceDetailComplete,false);assert.equal(job.criteriaComplete,true)}
 assert.equal(analyzePublishableJobs(jobs).indiaJobs.length,0);assert.equal(analyzePublishableJobs(jobs).eligibleJobs.length,0)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 const sse=jobs.find(job=>job.title==='Senior Software Engineer');assert.match(sse.jobDescription,/Who Can Apply/);assert.match(sse.jobDescription,/Please do not apply if you do not meet the above criteria/)
})

for(const[label,change]of[
 ['corporate owner',html=>html.replace('Vidyalai: One-to-One Online Lessons','Other Employer: One-to-One Online Lessons')],
 ['legacy title routing escape',html=>html.replace('Vidyalai: One-to-One Online Lessons for IB, IGCSE, A Levels and AP','Vidyalai')],
 ['unreviewed complete corporate bytes',html=>html+'<!-- unreviewed authority -->']
])test(label+' rejects before jobs/API or any fallback surface',async()=>{
 const source=replay(({url,response})=>url===fixture.packets[0].url?{...response,body:change(response.body)}:undefined)
 await assert.rejects(runNativeVidyalai({...source,currentNativeProfile:{allowChangedHTML:true}}),/authority/);assert.equal(source.calls.length,1)
})

for(const[label,change]of[
 ['country',html=>html.replace('Remote','India')],
 ['employer',html=>html.replace('<span class="font-weight-bold">Vidyalai</span>','<span class="font-weight-bold">Other Employer</span>')],
 ['native click programme',html=>html.replace('window.location.href = this.id;','window.location.href = "/login";')],
 ['pagination',html=>html.replace('data-no-of-pages="1"','data-no-of-pages="2"')],
 ['native visibility markup',html=>html.replace('name="card"','hidden name="card"')]
])test('current board '+label+' change rejects before role or undeclared API acquisition',async()=>{
 const source=replay(({url,response})=>url===boardURL?{...response,body:change(response.body)}:undefined)
 await assert.rejects(runNativeVidyalai(source),/native/);assert.equal(source.calls.length,2)
})

for(const[label,change]of[
 ['full criteria tail',html=>html.replace('Please do not apply if you do not meet the above criteria.','Changed mandatory original criteria.')],
 ['application identity',html=>html.replaceAll('/senior-software-engineer-job-application-form/new?','/login?')],
 ['explicit country field',html=>html.replace('>Kochi</div>','>India</div>')],
 ['programme',html=>html.replace('frappe.ready_events = [];','frappe.ready_events = ["unreviewed"];')]
])test('actual SSE '+label+' drift cannot qualify through original title/application labels',()=>{
 const packet=fixture.packets[2],original=Buffer.from(packet.bodyBase64,'base64').toString('utf8'),changed=change(original);assert.notEqual(changed,original)
 const record=listing().records.find(row=>row.url===packet.url)
 assert.throws(()=>inspectNativeDetail(changed,record),/native/)
})

test('closing listing relative publication facts are compared in full without fabricating dates',async()=>{
 const source=replay(({url,occurrence,response})=>url===boardURL&&occurrence===2?{...response,body:response.body.replace('3 days ago','4 days ago')}:undefined)
 await assert.rejects(runNativeVidyalai(source),/closing/);assert.equal(source.calls.length,20)
})

test('listing publication meaning must remain relative native data',()=>{
 const changed=boardHTML.replace('3 days ago','Applications closed')
 assert.notEqual(changed,boardHTML);assert.throws(()=>inspectNativeBoard(changed),/publication/)
})

test('detail publication meaning cannot become a closure statement',()=>{
 const record=listing().records[0],packet=fixture.packets.find(row=>row.url===record.url),html=Buffer.from(packet.bodyBase64,'base64').toString('utf8'),detail=inspectNativeDetail(html,record)
 const changed=html.replace(detail.nativeDetailPublicationHTML,detail.nativeDetailPublicationHTML+'Applications closed')
 assert.notEqual(changed,html);assert.throws(()=>inspectNativeDetail(changed,record),/publication/)
})

test('listing literal data slot cannot contain a newly declared programme',()=>{
 const changed=boardHTML.replace('3 days ago','3 days ago<script>unreviewed()</script>')
 assert.notEqual(changed,boardHTML);assert.throws(()=>inspectNativeBoard(changed),/literal|publication/)
})

for(const[label,change]of[
 ['heading',html=>html.replace(/(\s+Senior Software Engineer\s*)(<\/h1>)/,'$1<script>unreviewed()</script>$2')],
 ['location',html=>html.replace('>Kochi</div>','>Kochi<script>unreviewed()</script></div>')],
 ['employer',html=>html.replace('<span class="font-weight-bold">Vidyalai</span>','<span class="font-weight-bold" onclick="unreviewed()">Vidyalai</span>')]
])test('detail literal data slot '+label+' cannot hide programme or attribute drift',()=>{
 const packet=fixture.packets[2],html=Buffer.from(packet.bodyBase64,'base64').toString('utf8'),record=listing().records.find(row=>row.url===packet.url),changed=change(html)
 assert.notEqual(changed,html);assert.throws(()=>inspectNativeDetail(changed,record),/literal|publication/)
})

test('zero caller cap is applied only after all full closing models and retains normalized cleanup hold',async()=>{
 const source=replay(),jobs=await runNativeVidyalai({...source,maxJobs:0})
 assert.equal(source.calls.length,36);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.nativePayload.length,16);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})

for(const reason of[Object.freeze({opaque:'pre-abort'}),null,Error('exact caller cancellation')])test('pre-aborted caller retains exact reason '+String(reason),async()=>{
 const controller=new AbortController();controller.abort(reason);const source=replay()
 await assert.rejects(runNativeVidyalai({...source,signal:controller.signal}),error=>error===reason);assert.equal(source.calls.length,0)
})

test('opaque native transport failure is not relabelled or retried',async()=>{
 const reason=Object.freeze({transport:'opaque'}),source=replay(()=>{throw reason})
 await assert.rejects(runNativeVidyalai(source),error=>error===reason);assert.equal(source.calls.length,1)
})

test('caller abort during final evidence observer cannot become successful completed models',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:'observer-abort'}),source=replay()
 await assert.rejects(runNativeVidyalai({...source,signal:controller.signal,onAudit:()=>{controller.abort(reason);return new Promise(()=>{})}}),error=>error===reason);assert.equal(source.calls.length,36)
})

test('source budget bounds a stalled read and invalid caps do not start network work',async()=>{
 const source=replay(()=>new Promise(()=>{}))
 await assert.rejects(runNativeVidyalai({...source,collectionBudgetMs:10}),/deadline/);assert.equal(source.calls.length,1)
 const invalid=replay();await assert.rejects(runNativeVidyalai({...invalid,maxJobs:-1}),/cap/);assert.equal(invalid.calls.length,0)
})

for(const[label,change]of[
 ['public redirect',response=>({...response,status:302})],
 ['foreign URL',response=>({...response,url:'https://other.example/jobs'})],
 ['non-HTML headers',response=>({...response,headers:new Headers({'content-type':'application/json'})})],
 ['missing actual headers',response=>({...response,headers:new Headers()})]
])test(label+' cannot establish native current authority',async()=>{
 const source=replay(({response})=>change(response));await assert.rejects(runNativeVidyalai(source),/native/);assert.equal(source.calls.length,1)
})
