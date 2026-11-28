import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {runNativeVidyalai,inspectNativeBoard,inspectNativeDetail} from './nativeData20261121.js'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-authority-20261128.json.gz',import.meta.url))))
const historical=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261121.json.gz',import.meta.url))))
const HOME='https://www.vidyalai.com/',BOARD='https://erp.vidyalai.com/jobs'
const priorHome=Buffer.from(historical.packets[0].bodyBase64,'base64').toString(),currentHome=fixture.currentCorporate.body,currentBoard=fixture.currentBoard.body
const sha=value=>createHash('sha256').update(value).digest('hex')
const provider=getScraperCatalog().find(row=>row.source==='vidyalai')
const replay=(change=()=>{})=>{
 const calls=[],occurrences=new Map()
 return{calls,requestIntervalMs:0,fetchPage:async(url,init)=>{
  const occurrence=(occurrences.get(url)??0)+1;occurrences.set(url,occurrence);calls.push({url,init})
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const old=historical.packets.find(row=>row.url===url);assert.ok(old,'Only previously reviewed public native routes are replayed')
  const actual=url===HOME?fixture.currentCorporate:url===BOARD?fixture.currentBoard:null
  const response={status:actual?.status??old.status,url,headers:new Headers(actual?.headers??old.headers),body:actual?.body??Buffer.from(old.bodyBase64,'base64').toString()}
  return change({url,init,occurrence,response,calls})??response
 }}
}
const scripts=html=>readNativeDocument(html,{sourceRanges:true}).nodes(node=>node.tag==='script').map(node=>({start:node.sourceStart,end:node.sourceEnd,body:html.slice(node.sourceStart,node.sourceEnd),attrs:node.attrs}))

test('the genuine current corporate and native board fixtures preserve whole bodies and explicit provenance',()=>{
 assert.equal(fixture.validCurrentCheck,false)
 assert.equal(fixture.currentCorporate.requestedUrl,HOME);assert.equal(fixture.currentBoard.requestedUrl,BOARD)
 for(const packet of[fixture.currentCorporate,fixture.currentBoard]){assert.equal(sha(packet.body),packet.sha256);assert.equal(packet.status,200);assert.equal(packet.method,'GET');assert.equal(packet.requestBody,null)}
 assert.equal(sha(currentHome),'b566acdb5fbcd7c14f5ac751123f0c956bbe7281fdda200ea65dd49a9aa390d3')
 assert.equal(sha(currentBoard),'b99244875545ae4c19bb710753db19fbaa4ab3e8dd6e89859a5f8b4b88436fd5')
 assert.equal(sha(priorHome),fixture.priorCorporateSHA256)
})

test('every corporate byte outside the seventeen exact changed script owners is unchanged',()=>{
 const older=scripts(priorHome),newer=scripts(currentHome)
 assert.equal(older.length,35);assert.equal(newer.length,35)
 assert.deepEqual(fixture.corporateScriptChanges.map(row=>row.index),[3,4,6,10,11,12,14,15,16,17,18,19,20,31,32,33,34])
 for(const row of fixture.corporateScriptChanges){assert.equal(sha(older[row.index].body),row.priorSHA256);assert.equal(sha(newer[row.index].body),row.currentSHA256);assert.deepEqual(older[row.index].attrs,row.priorAttrs);assert.deepEqual(newer[row.index].attrs,row.currentAttrs)}
 const project=(html,nodes)=>{let offset=0,value='';for(const {index}of fixture.corporateScriptChanges){value+=html.slice(offset,nodes[index].start)+'<EXACT-REVIEWED-CORPORATE-SCRIPT-'+index+'>';offset=nodes[index].end}return value+html.slice(offset)}
 assert.equal(project(priorHome,older),project(currentHome,newer));assert.equal(sha(project(currentHome,newer)),fixture.outsideChangedScriptsSHA256)
 assert.deepEqual(activeHead(currentHome).titles,['Vidyalai: One-to-One Online Lessons for IB, IGCSE, A Levels and AP'])
 const doc=readNativeDocument(currentHome),handoffs=doc.nodes(node=>node.tag==='a'&&node.attrs.href==='http://erp.vidyalai.com/jobs')
 assert.equal(handoffs.length,2);assert.ok(handoffs.every(node=>doc.text(node)==='Careers'))
})

test('the current native board still passes the entire existing sixteen-role schema without a profile change',()=>{
 const board=inspectNativeBoard(currentBoard);assert.equal(board.records.length,16);assert.equal(board.shellSHA256,'ccc3bcd17ad132bdcdd1c9c5272186f8fddb42cff8a3851184cba274e2fe51f9')
 assert.ok(board.records.some(row=>row.title==='Senior Software Engineer'&&row.location==='Kochi'))
})

test('current Next bootstrap state changes only its literal build ID and is never executed',()=>{
 const data=html=>{const node=scripts(html).find(row=>row.attrs.id==='__NEXT_DATA__');return JSON.parse(node.body.slice(node.body.indexOf('>')+1,node.body.lastIndexOf('</script>')))}
 const prior=data(priorHome),current=data(currentHome)
 assert.equal(prior.buildId,'C_oiVkzePrFu3hQX9nvaj');assert.equal(current.buildId,'tAn75yNetMHPZY2AZ3HPa')
 assert.deepEqual({...prior,buildId:null},{...current,buildId:null})
})

test('the exact current whole corporate original reaches only the already-reviewed native board',async()=>{
 const source=replay(({url})=>{if(url===BOARD)throw Error('Reached exact reviewed native board')})
 await assert.rejects(runNativeVidyalai(source),/Reached exact reviewed native board/)
 assert.equal(source.calls.length,2);assert.equal(source.calls[1].url,BOARD)
})

test('controlled current-corporate/current-board plus historical-full-detail replay preserves sixteen unknown-country raw models at the assessment boundary',async()=>{
 let audit
 const source=replay(),jobs=await runNativeVidyalai({...source,onAudit:value=>{audit=value}}),assessment=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(source.calls.length,36);assert.equal(jobs.length,16);assert.equal(audit.fullRawCriteriaRecords,16);assert.equal(audit.closingReconciled,true)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.renderedUIQualified,false);assert.equal(audit.applicationVerified,false)
 for(const job of jobs){assert.equal(job.country,null);assert.equal(job.countryCode,null);assert.equal(job.sourceCountryScopeUnresolved,true);assert.equal(job.sourceDetailComplete,false);assert.equal(job.criteriaComplete,true);assert.equal(job.applyUrl,null);assert.equal(job.link,null);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.ok(job.jobDescription);assert.ok(job.nativeRawModel.nativeDetailHTML.includes(job.jobDescription))}
 assert.equal(assessment.indiaJobs,0);assert.equal(assessment.eligibleJobs,0);assert.equal(assessment.zeroJobEvidence,'coverage-gap');assert.equal(assessment.runnerOutcome.success,false);assert.equal(assessment.runnerOutcome.partial,true);assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
})

test('zero cap still completes every paired raw model and cannot create a verified company zero',async()=>{
 const source=replay(),jobs=await runNativeVidyalai({...source,maxJobs:0}),assessment=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(source.calls.length,36);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.nativePayload.length,16)
 assert.equal(assessment.zeroJobEvidence,'coverage-gap');assert.equal(assessment.runnerOutcome.success,false);assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
})

for(const[name,change]of[
 ['title',html=>html.replace('Vidyalai: One-to-One Online Lessons','Other Employer: One-to-One Online Lessons')],
 ['both employer handoffs',html=>html.replaceAll('http://erp.vidyalai.com/jobs','https://other.example/jobs')],
 ['one native employer handoff',html=>html.replace('http://erp.vidyalai.com/jobs','https://other.example/jobs')],
 ['inline bootstrap',html=>html.replace('"runtimeModuleIds":[724296,29143]','"runtimeModuleIds":[724296,29144]')],
 ['unknown build',html=>html.replaceAll('tAn75yNetMHPZY2AZ3HPa','unreviewed-corporate-build')],
 ['additional raw byte',html=>html+'<!-- unknown corporate authority -->'],
])test('current whole corporate '+name+' drift stops before any board/details or fallback',async()=>{
 const changed=change(currentHome);assert.notEqual(changed,currentHome)
 const source=replay(({url,response})=>url===HOME?{...response,body:changed}:undefined)
 await assert.rejects(runNativeVidyalai({...source,currentNativeProfile:{allowChangedHTML:true}}),/corporate native authority/);assert.equal(source.calls.length,1)
})

for(const[name,closing]of[['unknown current original',currentHome+'<!-- closing changed -->'],['different separately reviewed historical original',priorHome]])test('opening current corporate cannot close against '+name,async()=>{
 const source=replay(({url,occurrence,response})=>url===HOME&&occurrence===2?{...response,body:closing}:undefined)
 await assert.rejects(runNativeVidyalai(source),/corporate closing snapshot/);assert.equal(source.calls.length,19)
})

test('the current corporate profile cannot promote a changed native card country or employer',async()=>{
 for(const[name,change]of[['country',html=>html.replace('Remote','India')],['employer',html=>html.replace('<span class="font-weight-bold">Vidyalai</span>','<span class="font-weight-bold">Other Employer</span>')]]){
  const changed=change(currentBoard);assert.notEqual(changed,currentBoard,name)
  const source=replay(({url,response})=>url===BOARD?{...response,body:changed}:undefined)
  await assert.rejects(runNativeVidyalai(source),/native/);assert.equal(source.calls.length,2)
 }
})

const currentDetail=(url)=>fixture.currentDetails.find(packet=>packet.requestedUrl===url)
const boardRecords=()=>inspectNativeBoard(currentBoard).records
const allCurrentReplay=(change=()=>{})=>replay(input=>{
 const packet=currentDetail(input.url),response=packet?{...input.response,status:packet.status,headers:new Headers(packet.headers),body:packet.body}:input.response
 return change({...input,response})??response
})

for(const suffix of['part-time-teacher---ib-diploma-programme-(ib-dp)---geography','part-time-teacher---advanced-placement-(ap)---psychology'])test('the exact current logged-out public variant retains all native data for '+suffix,()=>{
 const record=boardRecords().find(row=>row.route.endsWith('/'+suffix)),packet=currentDetail(record.url)
 assert.equal(sha(packet.body),packet.sha256);assert.match(packet.body,/<body frappe-session-status="logged-out"/)
 const detail=inspectNativeDetail(packet.body,record)
 assert.equal(detail.nativeDetailHTML,packet.body);assert.ok(packet.body.includes(detail.jobDescription));assert.equal(detail.fields.Location,'Remote');assert.equal(detail.fields.Department,record.department);assert.equal(detail.fields['Employment Type'],record.nativeEmploymentType)
})

test('all sixteen current public role originals preserve the same full criteria, metadata and application declarations',()=>{
 assert.equal(fixture.currentDetails.length,16);assert.equal(fixture.currentDetailReview.length,16)
 for(const record of boardRecords()){
  const packet=currentDetail(record.url),review=fixture.currentDetailReview.find(row=>row.route===record.route),detail=inspectNativeDetail(packet.body,record)
  assert.equal(sha(packet.body),packet.sha256);assert.equal(sha(detail.jobDescription),review.criteriaSHA256);assert.equal(sha(JSON.stringify(detail.nativeMetadata)),review.metadataSHA256);assert.equal(detail.applyUrl,review.applicationDeclaration);assert.equal(detail.nativeDetailHTML,packet.body)
 }
})

test('a controlled paired replay of all genuine current observations retains sixteen criteria models without native country or application authority',async()=>{
 const source=allCurrentReplay(),jobs=await runNativeVidyalai(source),assessment=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(source.calls.length,36);assert.equal(jobs.length,16);assert.equal(jobs.nativeCollectionEvidence.closingReconciled,true)
 for(const job of jobs){assert.equal(job.nativeRawModel.nativeDetailHTML,currentDetail(job.sourceUrl).body);assert.equal(job.country,null);assert.equal(job.sourceCountryScopeUnresolved,true);assert.equal(job.applyUrl,null);assert.equal(job.link,null);assert.equal(job.sourceDetailComplete,false);assert.equal(job.criteriaComplete,true);assert.equal(job.lifecycleCleanupAllowed,false)}
 assert.equal(assessment.indiaJobs,0);assert.equal(assessment.eligibleJobs,0);assert.equal(assessment.zeroJobEvidence,'coverage-gap');assert.equal(assessment.runnerOutcome.success,false);assert.equal(assessment.runnerOutcome.partial,true);assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
})

for(const[name,change]of[
 ['unreviewed session state',html=>html.replace('frappe-session-status="logged-out"','frappe-session-status="unknown"')],
 ['changed inline programme',html=>html.replace('frappe.ready_events = [];','frappe.ready_events = ["changed"];')],
 ['changed full criteria',html=>html.replace('ql-editor read-mode">','ql-editor read-mode"><p>New mandatory country or qualification</p>')],
 ['foreign native application',html=>html.replaceAll('/part-time-teacher-application/new?','https://other.example/application?')],
])test('the exact current public detail variant rejects '+name+' without data or programme normalization',()=>{
 const record=boardRecords()[0],packet=currentDetail(record.url),changed=change(packet.body);assert.notEqual(changed,packet.body)
 assert.throws(()=>inspectNativeDetail(changed,record),/native/)
})

test('current public detail closing relative-publication drift still rejects after all sixteen opening models',async()=>{
 const first=boardRecords()[0]
 const source=allCurrentReplay(({url,occurrence,response})=>{
  if(url===first.url&&occurrence===2){const changed=response.body.replace('1 week ago','2 weeks ago');assert.notEqual(changed,response.body);return{...response,body:changed}}
 })
 await assert.rejects(runNativeVidyalai(source),/full criteria\/identity\/fields closing snapshot changed/)
 assert.equal(source.calls.length,21)
})

test('the genuine fully drained registered36response capture reproduces every saved native model and all qualification holds',async()=>{
 const actual=fixture.finalRegistered,packets=actual.packets;let offset=0
 assert.equal(packets.length,36);assert.equal(actual.outcome.captureBytes,1235132);assert.equal(actual.outcome.captureFinalization.drained,true);assert.equal(actual.outcome.captureFinalization.pendingAtFreeze,0)
 for(const[file,hash]of Object.entries(actual.outcome.sourceCodeHashes))assert.equal(sha(readFileSync(new URL('./'+file,import.meta.url))),hash)
 for(const[index,packet]of packets.entries()){
  assert.equal(sha(packet.body),packet.sha256);assert.equal(packet.status,200);assert.equal(packet.method,'GET');assert.equal(packet.requestBody,null)
  if(index<18){assert.equal(packet.requestedUrl,packets[index+18].requestedUrl);assert.equal(packet.body,packets[index+18].body)}
 }
 const jobs=await runNativeVidyalai({requestIntervalMs:0,fetchPage:async(url,init)=>{
  const packet=packets[offset++];assert.ok(packet);assert.equal(url,packet.requestedUrl);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  return{status:packet.status,url:packet.url,headers:new Headers(packet.headers),body:packet.body}
 }})
 assert.equal(offset,36);assert.equal(jobs.length,16);assert.equal(jobs.nativeCollectionEvidence.unknownWorkCountryRecords,16);assert.equal(jobs.nativeCollectionEvidence.closingReconciled,true)
 for(const job of jobs){
  const saved=actual.summaries.find(row=>row.jobId===job.jobId);assert.ok(saved)
  for(const field of['title','location','country','sourceCountryScopeUnresolved','sourceDetailComplete','criteriaComplete'])assert.equal(job[field],saved[field],field)
  assert.equal(sha(job.jobDescription),saved.criteriaSHA256);assert.equal(sha(JSON.stringify(job.nativeRawModel)),saved.nativeRawModelSHA256);assert.equal(sha(job.nativeRawModel.nativeDetailHTML),saved.nativeDetailHTMLSHA256)
  assert.equal(job.applyUrl,null);assert.equal(job.link,null);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 }
 const assessment=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(assessment.indiaJobs,0);assert.equal(assessment.eligibleJobs,0);assert.equal(assessment.zeroJobEvidence,'coverage-gap');assert.equal(assessment.runnerOutcome.success,false);assert.equal(assessment.runnerOutcome.partial,true);assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
})
