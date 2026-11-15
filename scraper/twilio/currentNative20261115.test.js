import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {encodeHTML,decodeHTML} from 'entities'
import {run} from './script.js'
import {eightfoldDocument} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const grouped=new Map()
for(const packet of fixture.packets){if(!grouped.has(packet.url))grouped.set(packet.url,[]);grouped.get(packet.url).push(packet)}
const TARGET='1099556450818'
function replay(change=()=>{},options={}){
 const counts=new Map(),calls=[]
 const fetchImpl=async(value,init)=>{
  const url=String(value),index=counts.get(url)||0;counts.set(url,index+1)
  const packet=structuredClone(grouped.get(url)?.[index])
  assert.ok(packet,'only actual independently captured native packet '+url+' #'+index)
  packet.body=Buffer.from(packet.bodyBase64,'base64').toString('utf8');change(packet,url,index)
  calls.push({url,index,phase:packet.phase,init})
  const response=new Response(packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.url});return response
 }
 return{calls,result:run({fetchImpl,now:()=>fixture.capturedAt,maxRequests:24,maxPages:2,maxDetails:2,requestIntervalMs:0,...options})}
}
const carrier=(body,id,change)=>{
 const original=body.match(new RegExp('<code\\b[^>]*\\bid="'+id+'"[^>]*>[\\s\\S]*?<\\/code>'))?.[0]
 assert.ok(original,'actual native '+id+' carrier')
 const raw=original.match(/>([\s\S]*)<\/code>/)[1],model=JSON.parse(decodeHTML(raw));change(model)
 return body.replace(original,original.replace(raw,encodeHTML(JSON.stringify(model))))
}
const post=(body,change)=>{
 const node=eightfoldDocument(body).entries.map(({node})=>node).find(node=>node.tag==='script'&&node.attrs.type==='application/ld+json'&&JSON.parse(node.raw)['@type']==='JobPosting')
 assert.ok(node,'actual own published JobPosting')
 const value=JSON.parse(node.raw);change(value);return body.replace(node.raw,JSON.stringify(value))
}
const nativeTarget=(packet,url,change)=>{if(url.includes('position_id='+TARGET)){const value=JSON.parse(packet.body);change(value.data);packet.body=JSON.stringify(value)}}
const noTarget=async reader=>{
 let jobs
 try{jobs=await reader.result}catch(error){assert.equal(error.softFailure,true,String(error));assert.equal(error.lifecycleCleanupAllowed,false);return null}
 assert.equal(jobs.some(job=>job.jobId===TARGET),false);assert.equal(readInventoryEvidence(jobs).listingComplete,false);return jobs
}

test('current registered Twilio wrapper preserves two real full India roles and all eleven raw native observations',async()=>{
 const reader=replay(),jobs=await reader.result
 assert.equal(jobs.length,2,JSON.stringify(jobs.nativeCollectionEvidence?.holds||jobs.nativeCollectionEvidence))
 assert.deepEqual(jobs.map(job=>job.jobId),fixture.selectedRoleIDs.map(String))
 for(const job of jobs){
  assert.equal(job.company,'Twilio');assert.equal(job.country,'India');assert.equal(job.nativeHiringOrganization.name,'Twilio')
  const raw=job.nativeSourceRecord.originalNativeRole
  assert.deepEqual(raw.locations,['Remote - India']);assert.deepEqual(raw.standardizedLocations,['IN'])
  assert.ok(job.jobDescription.startsWith(raw.jobDescription+'\n'))
  for(const perk of raw.positionExtraDetails.perks)assert.ok(decodeHTML(job.jobDescription).includes(perk.description))
  assert.equal(job.sourceNativeClosingReconciled,true);assert.equal(job.sourceDetailComplete,true)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.sourceRenderedApplicationQualified,false);assert.equal(job.applicationVisited,false)
  assert.equal(job.postingDate,null);assert.equal(job.closingDate,null)
  assert.equal(job.nativeSourceRecord.nativeClosingContext.everySelectedRoleRechecked,true)
 }
 assert.equal(readSourceObservationEvidence(jobs,'twilio').observedRecordCount,11)
 assert.equal(jobs.nativeCollectionEvidence.nativeRows.length,11)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(reader.calls.length,20)
 assert.ok(reader.calls.every(({init})=>init.method==='GET'&&init.redirect==='manual'&&init.credentials==='omit'))
 const lastOpening=Math.max(...reader.calls.map((call,index)=>call.phase==='opening'?index:-1))
 const firstClosing=reader.calls.findIndex(call=>call.phase==='closing')
 assert.ok(firstClosing>lastOpening,'all selected native openings precede independent closing reads')
})

test('an additional full native qualification cannot be silently discarded',async()=>{
 await noTarget(replay((packet,url)=>nativeTarget(packet,url,row=>{row.additionalQualifications='A mandatory original professional licence'})))
})
test('a hidden original native qualification cannot disappear during description comparison',async()=>{
 await noTarget(replay((packet,url)=>nativeTarget(packet,url,row=>{row.jobDescription+='<p hidden>A mandatory original professional licence</p>'})))
})
test('the reviewed company introduction cannot hide an added original qualification',async()=>{
 await noTarget(replay((packet,url)=>{
  nativeTarget(packet,url,row=>{row.jobDescription=row.jobDescription.replace('At Twilio,','At Twilio, An original mandatory licence. ' )})
  if(url.endsWith('/careers/job/'+TARGET))packet.body=post(packet.body,row=>{row.description=row.description.replace('At Twilio,','At Twilio, An original mandatory licence. ' )})
 }))
})
test('arbitrary role criteria punctuation is never folded into the known company introduction pair',async()=>{
 await noTarget(replay((packet,url)=>{
  nativeTarget(packet,url,row=>{row.jobDescription+='<p>Maintain O'+String.fromCharCode(8217)+'Neill validation.</p>'})
  if(url.endsWith('/careers/job/'+TARGET))packet.body=post(packet.body,row=>{row.description+=" Maintain O'Neill validation."})
 }))
})
test('independent native country representations must continue agreeing',async()=>{
 await noTarget(replay((packet,url)=>nativeTarget(packet,url,row=>{row.standardizedLocations=['US']})))
})
test('another native authored worksite cannot be dropped from the selected role',async()=>{
 await noTarget(replay((packet,url)=>nativeTarget(packet,url,row=>{row.locations.push('Remote - United States');row.standardizedLocations.push('US')})))
})
for(const [name,change]of[
 ['foreign employer',value=>{value.hiringOrganization.name='Another Company'}],
 ['different authored role identity',value=>{value.url='https://jobs.twilio.com/careers/job/1099556746356'}],
 ['foreign published worksite',value=>{value.jobLocation.address.addressCountry.name='US'}],
 ['foreign applicant country',value=>{value.applicantLocationRequirements[0].name='US'}],
 ['unknown schema context',value=>{value['@context']='https://another-company.invalid/context'}],
])test(name+' cannot qualify the current own native role',async()=>{
 await noTarget(replay((packet,url)=>{if(url.endsWith('/careers/job/'+TARGET))packet.body=post(packet.body,change)}))
})
for(const notice of['This job is not available.','This position is currently unavailable.','Applications are closed.','Recruitment is closed.']){
 test('explicit current native unavailability is held: '+notice,async()=>{
  await noTarget(replay((packet,url)=>{
   nativeTarget(packet,url,row=>{row.jobDescription+='<p>'+notice+'</p>'})
   if(url.endsWith('/careers/job/'+TARGET))packet.body=post(packet.body,row=>{row.description+=' '+notice})
  }))
 })
}
test('closing-only unavailability cannot receive native reconciliation',async()=>{
 await noTarget(replay((packet,url,index)=>{
  if(index!==1)return
  nativeTarget(packet,url,row=>{row.jobDescription+='<p>This role is closed.</p>'})
  if(url.endsWith('/careers/job/'+TARGET))packet.body=post(packet.body,row=>{row.description+=' This role is closed.'})
 }))
})
test('closing-only original criteria drift cannot be certified by opening models',async()=>{
 await noTarget(replay((packet,url,index)=>{
  if(index!==1)return
  nativeTarget(packet,url,row=>{row.jobDescription+='<p>A new mandatory licence.</p>'})
  if(url.endsWith('/careers/job/'+TARGET))packet.body=post(packet.body,row=>{row.description+=' A new mandatory licence.'})
 }))
})
test('decoded duplicate native identity keys fail before JSON.parse can collapse them',async()=>{
 await noTarget(replay((packet,url)=>{if(url.includes('position_id='+TARGET))packet.body=packet.body.replace(/("name"\s*:)/,'"\\u006eame":"A foreign original role",$1')}))
})
test('closing-only duplicate original criteria cannot be lost from comparison',async()=>{
 await noTarget(replay((packet,url,index)=>{if(index===1&&url.includes('position_id='+TARGET))packet.body=packet.body.replace(/("jobDescription"\s*:)/,'"jobDescription":"<p>Another original mandatory licence</p>",$1')}))
})
test('current account override branches require explicit review',async()=>{
 await noTarget(replay((packet,url)=>{if(url.startsWith('https://jobs.twilio.com/careers'))packet.body=carrier(packet.body,'pcsx-data',value=>{value.configs.pcsxConfig.overrides.push({source:'another-company'})})}))
})
test('current entry and historical configuration cannot be combined into a reviewed profile',async()=>{
 await noTarget(replay((packet,url)=>{if(url.startsWith('https://jobs.twilio.com/careers'))packet.body=carrier(packet.body,'pcsx-data',value=>{delete value.configs.pcsxConfig.fileUploadConfig.resume.overwriteProfile})}))
})
test('historical entry and current configuration cannot be combined into a reviewed profile',async()=>{
 await noTarget(replay((packet,url)=>{if(url.startsWith('https://jobs.twilio.com/careers'))packet.body=packet.body.replaceAll('pcsxPwa.ceaedf5d9f9dac50.js','pcsxPwa.6c903be3a68c07ae.js')}))
})
test('ambiguous active entries cannot be pruned into either coherent profile',async()=>{
 await noTarget(replay((packet,url)=>{if(url.startsWith('https://jobs.twilio.com/careers'))packet.body=packet.body.replace('</body>','<script defer src="/gen/js/pcsxPwa.6c903be3a68c07ae.js"></script></body>')}))
})
test('a closing transition to another reviewed profile cannot certify opening role models',async()=>{
 await noTarget(replay((packet,url,index)=>{if(index===1&&url==='https://jobs.twilio.com/careers'){
  packet.body=packet.body.replaceAll('pcsxPwa.ceaedf5d9f9dac50.js','pcsxPwa.6c903be3a68c07ae.js')
  packet.body=carrier(packet.body,'pcsx-data',value=>{delete value.configs.pcsxConfig.fileUploadConfig.resume.overwriteProfile})
 }}))
})
test('a hidden native model ancestor cannot qualify the current role context',async()=>{
 await noTarget(replay((packet,url)=>{if(url.startsWith('https://jobs.twilio.com/careers'))packet.body=packet.body.replace(/(<code\b[^>]*\bid="pcsx-data"[^>]*>[\s\S]*?<\/code>)/,'<section hidden>$1</section>')}))
})
test('current declared whole entry bytes cannot drift unnoticed',async()=>{
 await noTarget(replay((packet,url)=>{if(url.includes('/gen/js/pcsxPwa.'))packet.body+='\nwindow.nativeContextChanged=true;'}))
})
test('current declared whole role renderer bytes cannot drift unnoticed',async()=>{
 await noTarget(replay((packet,url)=>{if(url.includes('/gen/js/12480.'))packet.body+='\nwindow.nativeCriteriaChanged=true;'}))
})
test('an empty geographic native query remains an unverified company inventory',async()=>{
 const jobs=await replay((packet,url)=>{if(url.includes('/api/pcsx/search?')){const value=JSON.parse(packet.body);value.data.count=0;value.data.positions=[];packet.body=JSON.stringify(value)}}).result
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.notEqual(readInventoryEvidence(jobs).status,'verified-empty')
})
for(const reason of['owner-stop',Object.freeze(Error('frozen owner-stop'))])test('opaque or frozen caller abort reasons preserve exact identity',async()=>{
 const controller=new AbortController();controller.abort(reason)
 await assert.rejects(replay(undefined,{signal:controller.signal}).result,error=>error===reason)
})
test('caller cancellation during an uncooperative current read preserves its opaque reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze(Error('in-flight owner-stop'))
 const reader=replay(undefined,{signal:controller.signal,fetchImpl:()=>new Promise(()=>{})})
 setTimeout(()=>controller.abort(reason),10)
 await assert.rejects(reader.result,error=>error===reason)
})
test('the first native access denial remains a failure and stops further public reads',async()=>{
 let reads=0
 await assert.rejects(replay(undefined,{fetchImpl:async url=>{reads++;const response=new Response('Access denied',{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:String(url)});return response}}).result,error=>error.failureKind==='blocked_or_access_denied'&&error.abortRetries===true)
 assert.equal(reads,1)
})
test('the source deadline bounds a transport that ignores cancellation',async()=>{
 await assert.rejects(replay(undefined,{sourceTimeoutMs:25,fetchImpl:()=>new Promise(()=>{})}).result,/deadline|timeout|aborted/i)
})
test('oversized input cancels the actual native reader before acceptance',async()=>{
 let cancelled=false
 await assert.rejects(replay(undefined,{fetchImpl:async url=>{
  const response=new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(4000001))},cancel(){cancelled=true}}),{status:200,headers:{'content-type':'text/html'}})
  Object.defineProperty(response,'url',{value:String(url)});return response
 }}).result,/byte|oversized|limit/i)
 assert.equal(cancelled,true)
})
