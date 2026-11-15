import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const grouped=new Map(),TARGET=170117,ROOT='https://metayb.ai/',BOARD='https://metayb.keka.com/careers/'
for(const packet of fixture.packets){if(!grouped.has(packet.url))grouped.set(packet.url,[]);grouped.get(packet.url).push(packet)}
const FEED=BOARD+'api/embedjobs/default/active/c7f3951a-6709-4b6b-a5d3-1e58ba9ae906',ACCOUNT=BOARD+'api/organization/default/careerportalinfo',ROLE=BOARD+'jobdetails/'+TARGET
function replay(change=()=>{},options={}){
 const calls=[],counts=new Map()
 const fetchImpl=async(value,init)=>{
  const url=String(value),index=counts.get(url)||0;counts.set(url,index+1)
  const packet=structuredClone(grouped.get(url)?.[index]);assert.ok(packet,'only actual current independently captured packet '+url+' #'+index)
  packet.body=Buffer.from(packet.bodyBase64,'base64').toString('utf8');const original=packet.body;change(packet,url,index);calls.push({url,index,init,phase:packet.phase,mutated:packet.body!==original})
  const response=new Response(packet.body,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 }
 return{calls,result:run({fetchText:async()=>Buffer.from(grouped.get(ROOT)[0].bodyBase64,'base64').toString(),fetchImpl,requestIntervalMs:0,maxDetails:2,now:()=>fixture.capturedAt,...options})}
}
const feed=(packet,url,change)=>{if(url===FEED){const value=JSON.parse(packet.body);change(value);packet.body=JSON.stringify(value)}}
const target=(packet,url,change)=>feed(packet,url,rows=>change(rows.find(row=>row.id===TARGET)))
const noTarget=async reader=>{
 let jobs
 try{jobs=await reader.result}catch(error){assert.equal(error.softFailure,true,String(error));assert.equal(error.lifecycleCleanupAllowed,false);assert.ok(reader.calls.some(row=>row.mutated),'the intended real packet was changed');return}
 assert.ok(reader.calls.some(row=>row.mutated),'the intended real packet was changed')
 assert.equal(jobs.some(job=>job.jobId===String(TARGET)),false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readSourceObservationEvidence(jobs,'metayb').observedRecordCount,45)
}
test('registered current Metayb wrapper preserves real full India models, extra native criteria and all 45 raw observations',async()=>{
 const reader=replay(),jobs=await reader.result
 assert.equal(jobs.length,2,JSON.stringify(jobs.nativeCollectionEvidence?.holds))
 assert.deepEqual(jobs.map(row=>row.jobId),['170117','170083'])
 for(const job of jobs){
  const row=job.nativeSourceRecord.originalNativeRole
  assert.equal(job.company,'Metayb');assert.equal(job.country,'India');assert.equal(job.nativeHiringOrganization.name,'Metayb Private Limited')
  assert.ok(job.jobDescription.startsWith(row.description));assert.deepEqual(job.requiredSkills,row.skillNames)
  assert.equal(job.experienceRequired,row.experience);assert.deepEqual(job.nativeSalaryRange,row.salaryRange)
  assert.deepEqual(job.nativeSourceRecord.originalNativeRole.jobLocations,row.jobLocations)
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceNativeClosingReconciled,true)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceRenderedApplicationQualified,false)
  assert.equal(job.corporateUIQualified,false);assert.equal(job.applicationVisited,false)
 }
 assert.ok(jobs[1].jobDescription.includes('2-year service bond'),'full original application condition retained')
 assert.equal(readSourceObservationEvidence(jobs,'metayb').observedRecordCount,45)
 assert.equal(jobs.nativeCollectionEvidence.nativeRows.length,45);assert.equal(jobs.nativeCollectionEvidence.nativeIndiaCandidateCount,43)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.ok(jobs.nativeCollectionEvidence.holds.some(row=>row.id==='154174'))
 assert.ok(jobs.nativeCollectionEvidence.holds.some(row=>row.id==='97514'))
 assert.ok(reader.calls.every(({init})=>init.method==='GET'&&init.credentials==='omit'&&init.redirect==='manual'))
 const lastOpening=Math.max(...reader.calls.map((row,index)=>row.phase==='opening'?index:-1)),firstClosing=reader.calls.findIndex(row=>row.phase==='closing')
 assert.ok(firstClosing>lastOpening)
})
test('all actual independently typed India alternatives survive a native ordering change',async()=>{
 const jobs=await replay((packet,url)=>feed(packet,url,rows=>{const at=rows.findIndex(row=>row.id===130336);rows.splice(1,0,...rows.splice(at,1))})).result
 const role=jobs.find(row=>row.jobId==='130336');assert.ok(role)
 assert.equal(role.nativeSourceRecord.originalNativeRole.jobLocations.length,2);assert.equal(role.locations.length,2)
 assert.deepEqual(role.nativeSourceRecord.originalNativeRole.jobLocations.map(row=>[row.countryCode,row.countryName]),[['IN','India'],['IN','India']])
})

test('the default four-role bounded batch independently closes every emitted full native model',async()=>{
 const reader=replay(undefined,{maxDetails:4}),jobs=await reader.result
 assert.deepEqual(jobs.map(row=>row.jobId),['170117','170083','169495','169256'])
 assert.equal(reader.calls.length,53);assert.equal(jobs.nativeCollectionEvidence.holds.length,41)
 assert.equal(jobs.nativeCollectionEvidence.nativeIndiaCandidateCount,43)
 assert.equal(jobs.nativeCollectionEvidence.closingNativeSnapshots.length,2)
 assert.ok(jobs.nativeCollectionEvidence.closingNativeSnapshots.every(snapshot=>snapshot.fullModels.length===45))
})

test('a body-only callback cannot replace raw native HTTP status and account metadata',async()=>{
 let reads=0
 await assert.rejects(run({fetchText:async()=>{reads++;return 'Unverified HTML'}}),error=>error.softFailure===true&&/raw native HTTP/.test(error.message))
 assert.equal(reads,0)
})

test('an additional full native and own public criterion is preserved with all independent closing models',async()=>{
 const addition='<p>An additional mandatory current professional licence is required.</p>',notice='An additional mandatory current professional licence is required.'
 const boundary='</div>\r\n                    <div class="mt-3">'
 const reader=replay((packet,url)=>{
  target(packet,url,row=>{row.description+=addition;row.excerpt+=notice})
  if(url===ROLE){assert.ok(packet.body.includes(boundary));packet.body=packet.body.replace(boundary,addition+boundary)}
 }),jobs=await reader.result,job=jobs.find(row=>row.jobId===String(TARGET))
 assert.ok(job);assert.ok(job.jobDescription.includes(addition));assert.ok(job.nativeSourceRecord.originalNativeRole.excerpt.includes(notice))
 assert.ok(jobs.nativeCollectionEvidence.closingNativeSnapshots.every(snapshot=>snapshot.fullModels.find(row=>row.id===TARGET).description.includes(addition)))
})
for(const [name,mutate]of[
 ['contradictory native country code',row=>{row.jobLocations[0].countryCode='US'}],
 ['a foreign native alternative',row=>{row.jobLocations.push({id:999,name:'London',city:'London',state:'',countryCode:'GB',countryName:'United Kingdom'})}],
 ['an unknown native country alternative',row=>{row.jobLocations.push({id:999,name:'Chennai',city:'Chennai'})}],
 ['an unreviewed extra original qualification',row=>{row.additionalQualifications='An additional mandatory licence.'}],
 ['an omitted required native criterion field',row=>{delete row.experience}],
 ['an extra native skill missing from its own public page',row=>{row.skillNames.push('A mandatory extra skill')}],
 ['an omitted native skill still published on its own page',row=>{row.skillNames.pop()}],
 ['an unknown original benefits field',row=>{row.benefits=['A mandatory original benefit condition']}],
 ['an unknown original application condition',row=>{row.applicationConditions=['A mandatory condition']}],
 ['an excerpt containing an additional original criterion',row=>{row.excerpt+=' A mandatory extra licence.'}],
 ['hidden original native criteria',row=>{row.description+='<p hidden>A mandatory extra licence.</p>'}],
 ['an impossible native publication calendar day',row=>{row.publishedOn='2026-09-31T10:10:10Z'}],
 ['an unreviewed original criteria inline program',row=>{row.description='<p onclick="return false"></p>'+row.description}],
])test(name+' withholds the target while retaining raw native evidence',async()=>{await noTarget(replay((packet,url)=>target(packet,url,mutate)))})
for(const [name,mutate]of[
 ['own page role identity',body=>body.replaceAll('selectedJobId="170117"','selectedJobId="170083"')],
 ['own page title',body=>body.replaceAll('QA Automation Engineer- 1','Another role')],
 ['own page omitted original qualification',body=>body.replace('6 + &nbsp;years','1 year')],
 ['own page hidden full criteria',body=>body.replace('class="job-description-container "','hidden class="job-description-container "')],
 ['own page additional external criterion',body=>body.replace('id="apply-job"','id="apply-job" disabled')],
 ['own page unavailable apply control',body=>body.replace('id="apply-job"','id="apply-job" hidden')],
 ['own page required skill omitted',body=>body.replace('>Selinium</span>','></span>')],
 ['own page additional condition outside description',body=>body.replace('View all job openings','A mandatory extra licence. View all job openings')],
 ['own page unread embedded conditions',body=>body.replace('</body>','<iframe src="https://metayb.keka.com/careers/conditions"></iframe></body>')],
 ['own page unreviewed inline application handler',body=>body.replace('id="apply-job"','id="apply-job" onclick="return false"')],
])test(name+' cannot qualify a native model',async()=>{await noTarget(replay((packet,url)=>{if(url===ROLE)packet.body=mutate(packet.body)}))})
for(const notice of['This job is not available.','Applications are closed.','Recruitment is closed.','Applications are no longer accepted.','We are no longer accepting applications for this role.'])test('matching opening and closing explicit unavailability is rejected: '+notice,async()=>{
 await noTarget(replay((packet,url)=>{
  target(packet,url,row=>{row.description+='<p>'+notice+'</p>';row.excerpt+=notice})
  if(url===ROLE)packet.body=packet.body.replace('</div>\r\n                    <div class="mt-3">','<p>'+notice+'</p></div>\r\n                    <div class="mt-3">')
 }))
})
for(const [name,url,mutate]of[
 ['publisher name',ACCOUNT,body=>{const value=JSON.parse(body);value.name='Another Company';return JSON.stringify(value)}],
 ['publisher account',ACCOUNT,body=>body.replaceAll('metayb.keka.com','another.keka.com')],
 ['publisher declared LinkedIn identity',ACCOUNT,body=>body.replace('/company/metayb/','/company/another/')],
 ['corporate whole client', 'https://metayb.ai/assets/index-_o8rh6rv.js',body=>body+'\nwindow.currentProgramChanged=true;'],
 ['native whole embed client',BOARD+'api/embedjobs/js/c7f3951a-6709-4b6b-a5d3-1e58ba9ae906',body=>body+'\nwindow.currentProgramChanged=true;'],
 ['own role whole application client','https://cdn.keka.com/careers/v/2026/scripts/app/app.min.js',body=>body+'\nwindow.currentProgramChanged=true;'],
 ['own role declared stylesheet','https://cdn.keka.com/careers/v/2026/css/bootstrap.css',body=>body+'\n.job-description-container{display:none}'],
])test(name+' drift withholds the current batch',async()=>{await noTarget(replay((packet,value)=>{if(value===url)packet.body=mutate(packet.body)}))})
for(const [name,mutate]of[
 ['full native original criteria',row=>{row.description+='<p>A closing-only original condition.</p>'}],
 ['full native country alternatives',row=>{row.jobLocations.push({id:999,name:'Unknown worksite'})}],
 ['full native required skills',row=>{row.skillNames.push('Closing-only requirement')}],
])test('independent closing '+name+' drift cannot be reconciled',async()=>{await noTarget(replay((packet,url,index)=>{if(index>0)target(packet,url,mutate)}))})
test('closing-only own published criteria drift is not opening proof',async()=>{await noTarget(replay((packet,url,index)=>{if(url===ROLE&&index===1)packet.body=packet.body.replace('View all job openings','A closing-only condition. View all job openings')}))})
test('decoded duplicate native criterion keys are rejected before JSON.parse collapses them',async()=>{await noTarget(replay((packet,url)=>{if(url===FEED)packet.body=packet.body.replace('"description":','"\\u0064escription":"Another mandatory original criterion","description":')}))})
test('closing-only decoded duplicate native identity keys cannot be reconciled',async()=>{await noTarget(replay((packet,url,index)=>{if(url===FEED&&index>0)packet.body=packet.body.replace('"id":170117','"\\u0069d":170083,"id":170117')}))})
test('a native empty active array never becomes verified company zero',async()=>{
 const jobs=await replay((packet,url)=>{if(url===FEED)packet.body='[]'}).result
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.notEqual(readInventoryEvidence(jobs).status,'verified-empty')
})
for(const reason of['owner-stop',Object.freeze(Error('frozen owner-stop'))])test('opaque caller abort identity is preserved',async()=>{
 const controller=new AbortController();controller.abort(reason)
 await assert.rejects(replay(undefined,{signal:controller.signal}).result,error=>error===reason)
})
test('an in-flight transport ignoring cancellation is bounded by the original caller signal',async()=>{
 const controller=new AbortController(),reason=Object.freeze({reason:'opaque-stop'}),reader=replay(undefined,{signal:controller.signal,fetchImpl:()=>new Promise(()=>{})})
 setTimeout(()=>controller.abort(reason),10);await assert.rejects(reader.result,error=>error===reason)
})
test('the bounded current source deadline cancels an uncooperative read',async()=>{
 await assert.rejects(replay(undefined,{sourceTimeoutMs:25,fetchImpl:()=>new Promise(()=>{})}).result,error=>error.softFailure===true&&/deadline/.test(error.message))
})

test('an uncooperative audit callback is interrupted by the exact caller abort reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({reason:'audit-stop'})
 let callbackReached=false,guard
 const reader=replay(undefined,{signal:controller.signal,sourceTimeoutMs:1500,onAudit(){
  callbackReached=true;queueMicrotask(()=>controller.abort(reason));return new Promise(()=>{})
 }})
 try{await Promise.race([assert.rejects(reader.result,error=>error===reason),new Promise((_,reject)=>{guard=setTimeout(()=>reject(Error('current reader did not interrupt the audit callback')),1000)})])}
 finally{clearTimeout(guard)}
 assert.equal(callbackReached,true)
})
test('the first public denial stops acquisition without retries or an empty claim',async()=>{
 let reads=0
 await assert.rejects(replay(undefined,{fetchImpl:async value=>{reads++;const response=new Response('Denied',{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:String(value)});return response}}).result,error=>error.softFailure===true&&error.lifecycleCleanupAllowed===false)
 assert.equal(reads,1)
})
test('an oversized streamed current body is canceled before acceptance',async()=>{
 let cancelled=false
 await assert.rejects(replay(undefined,{fetchImpl:async value=>{const response=new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(4000001))},cancel(){cancelled=true}}),{status:200,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:String(value)});return response}}).result,error=>error.softFailure===true)
 assert.equal(cancelled,true)
})
