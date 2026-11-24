import assert from 'node:assert/strict'
import test from 'node:test'
// Explicit historical compatibility only. Current stable factory is covered by currentPublished20261121.test.js.
import {run} from './nativeCareers20261114.js'
import {genuineVerintFixture,laterVerintFixture,correctedVerintFixture,replayVerint,fullVerintResponse} from './currentFixture20261114.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'


const originalFeed=JSON.parse(Buffer.from(genuineVerintFixture.responses[2].bodyBase64,'base64'))
const originalRole=originalFeed.jobs.find(row=>row.id==='698d571e-d45c-4624-8a01-7d36224a6673')
const bodyChange=(entity,change)=>({...entity,body:Buffer.from(change(entity.body.toString('utf8')),'utf8')})

for(const [entry,runEntry]of [
 ['historical module only',run],
])test('reviewed corrected18 native title and full edited criteria survive through '+entry,async()=>{
 const feed=JSON.parse(Buffer.from(correctedVerintFixture.responses[2].bodyBase64,'base64'))
 const role=feed.jobs.find(row=>row.id===originalRole.id)
 const {jobs,requests}=await replayVerint(runEntry,{fixture:correctedVerintFixture})
 assert.equal(jobs.length,1);assert.equal(requests.length,8)
 assert.equal(jobs[0].title,'ServiceNow Administrator')
 assert.equal(jobs[0].jobDescription,role.descriptionHtml);assert.equal(role.descriptionHtml.length,6216)
 assert.equal(jobs[0].sourceDescriptionText,role.descriptionPlain);assert.equal(role.descriptionPlain.length,4919)
 assert.deepEqual(jobs[0].sourceNativeListingRecord,role)
 assert.equal(jobs[0].postingDate,originalRole.publishedAt)
 assert.equal(jobs[0].nativeWorkplaceCarriers.feedIsRemote,true)
 assert.equal(jobs[0].nativeWorkplaceCarriers.feedWorkplaceType,'Hybrid')
 assert.equal(jobs[0].nativeWorkplaceCarriers.schemaJobLocationType,'TELECOMMUTE')
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,18)
 assert.equal(jobs.nativeCollectionEvidence.holds.length,17)
 assert.deepEqual(jobs.nativeCollectionEvidence.originalOpeningFeed,feed)
 assert.deepEqual(jobs.nativeCollectionEvidence.originalClosingFeed,feed)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})

test('corrected18 cannot combine edited opening criteria with the prior18 closing feed',async()=>{
 await assert.rejects(replayVerint(run,{fixture:correctedVerintFixture,fetchOverride:(_url,_options,index)=>
  fullVerintResponse(index,undefined,index===5?laterVerintFixture:correctedVerintFixture)}),/Current native text contract/)
})

for(const [entry,runEntry]of [
 ['historical module only',run],
])test('reviewed coherent18 inventory preserves the unchanged original India criteria through '+entry,async()=>{
 const feed=JSON.parse(Buffer.from(laterVerintFixture.responses[2].bodyBase64,'base64'))
 const {jobs,requests}=await replayVerint(runEntry,{fixture:laterVerintFixture})
 assert.equal(jobs.length,1);assert.equal(requests.length,8)
 assert.deepEqual(jobs[0].sourceNativeListingRecord,originalRole)
 assert.equal(jobs[0].jobDescription,originalRole.descriptionHtml)
 assert.equal(jobs[0].postingDate,originalRole.publishedAt)
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.observedRecordCount,18);assert.equal(audit.holds.length,17)
 assert.deepEqual(audit.originalOpeningFeed,feed);assert.deepEqual(audit.originalClosingFeed,feed)
 const added=feed.jobs.find(row=>row.id==='7d804e8b-5dd8-4e15-af17-1801f378f60f')
 assert.equal(added.title,'Account Executive, Federal')
 assert.equal(added.address.postalAddress.addressCountry,'United States')
 assert.deepEqual(audit.holds.find(row=>row.id===added.id).nativeCountries,['United States'])
 assert.equal(jobs[0].sourceListingComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const index of [2,5,6])test('coherent18 cannot mix original17 feed or closing board at read '+index,async()=>{
 await assert.rejects(replayVerint(run,{fixture:laterVerintFixture,fetchOverride:(_url,_options,at)=>
  fullVerintResponse(at,undefined,at===index?genuineVerintFixture:laterVerintFixture)}),/Current native text contract/)
})

test('finite18 cannot silently admit a changed original foreign-country record',async()=>{
 await assert.rejects(replayVerint(run,{fixture:laterVerintFixture,mutate:(entity,index)=>index===2?
  bodyChange(entity,text=>text.replace('Account Executive, Federal','Account Executive, Changed')):entity}),/Current native text contract/)
})

test('current genuine corporate handoff yields the complete original India Ashby role',async()=>{
 const {jobs,requests}=await replayVerint(run)
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobId,'698d571e-d45c-4624-8a01-7d36224a6673')
 assert.equal(jobs[0].title,'ServiceNow Adminstrator')
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].jobDescription,originalRole.descriptionHtml)
 assert.equal(jobs[0].sourceDescriptionText,originalRole.descriptionPlain)
 assert.equal(requests.length,8)
})
test('native data, original dates, conflicting workplace carriers and coverage holds survive output',async()=>{
 const {jobs,requests}=await replayVerint(run)
 const job=jobs[0],audit=jobs.nativeCollectionEvidence
 assert.deepEqual(job.sourceNativeListingRecord,originalRole)
 assert.equal(job.nativeWorkplaceCarriers.feedIsRemote,true)
 assert.equal(job.nativeWorkplaceCarriers.feedWorkplaceType,'Hybrid')
 assert.equal(job.nativeWorkplaceCarriers.schemaJobLocationType,'TELECOMMUTE')
 assert.equal(job.nativeApplyHandoff.directApply,false)
 assert.equal(job.nativeApplyHandoff.applicationActionVerified,false)
 assert.equal(job.closingDate,null)
 assert.equal(job.sourceDetailComplete,true)
 assert.equal(job.nativeCriteriaTextComplete,true)
 for(const field of ['sourceListingComplete','sourceScopeComplete','sourceCompanyCoverageComplete','lifecycleCleanupAllowed','currentCSSCoverage','activationVerified'])assert.equal(job[field],false)
 assert.equal(audit.observedRecordCount,17)
 assert.deepEqual(audit.originalOpeningFeed,originalFeed)
 assert.deepEqual(audit.originalClosingFeed,originalFeed)
 assert.equal(audit.holds.length,16)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 for(const {options}of requests){assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');assert.equal(options.credentials,'omit');assert(options.signal instanceof AbortSignal)}
})
test('historical direct-module import preserves its original full response and denial contract',async()=>{
 const scraper={run}
 const {jobs,requests}=await replayVerint(options=>scraper.run(options))
 assert.equal(jobs.length,1);assert.equal(requests.length,8)
 await assert.rejects(replayVerint(options=>scraper.run(options),{mutate:(entity,index)=>index===0?{...entity,status:403}:entity}),error=>error.status===403&&error.failureKind==='blocked_or_access_denied')
})
for(let index=0;index<8;index++)test('HTTP denial on original response '+index+' cannot become native success',async()=>{
 await assert.rejects(replayVerint(run,{mutate:(entity,at)=>at===index?{...entity,status:403}:entity}),error=>error.status===403&&error.failureKind==='blocked_or_access_denied')
})
for(const [label,at,change]of [
 ['current corporate employer text',0,text=>text.replace('Verint','NotOwn')],
 ['current corporate handoff target',0,text=>text.replace('27cfd344-670f-4dcd-8b13-0e18005b0d65','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')],
 ['native board organization',1,text=>text.replace('"name":"Verint"','"name":"OtherX"')],
 ['native board duplicate owner',1,text=>text.replace('</body>','<script>window.__appData={}</script></body>')],
 ['native feed complete original countries',2,text=>text.replace('"addressCountry":"India"','"addressCountry":"Japan"')],
 ['native feed original criteria',2,text=>text.replace('REQUIREMENTS YOU WILL NEED TO BE SUCCESSFUL','REQUIREMENTS REMOVED FROM ORIGINAL SOURCE')],
 ['native full detail original title',3,text=>text.replace('ServiceNow Adminstrator','ServiceNow OtherTitleX')],
 ['native full detail hidden criteria',3,text=>text.replace('min-height:1.5em','display:none;xxx')],
 ['native full detail closure',3,text=>text.replace('About the Role:','This role is closed')],
 ['native full detail public date',3,text=>text.replace('2026-11-12','2026-11-13')],
 ['native full detail extra criterion carrier',3,text=>text.replace('</body>','<iframe src="/requirements"></iframe></body>')],
 ['native full detail executable suffix',3,text=>text.replace('document.head.appendChild','document.body.appendChild')],
 ['closing full native detail',4,text=>text.replace('ServiceNow Adminstrator','ServiceNow ChangedRole')],
 ['closing complete feed foreign row',5,text=>text.replace('Account Executive (Canada)','Account Executive (Xanadu)')],
 ['closing native board employer',6,text=>text.replace('"name":"Verint"','"name":"OtherX"')],
 ['closing corporate declaration',7,text=>text.replace('Join Our Global Team','Changed Global Team')],
 ['native all-unlisted false zero',2,text=>text.replaceAll('"isListed":true','"isListed":false')],
 ['native CSP owner relocation',1,text=>text.replace('name="csp-nonce"','name="csp-XXXXX"')],
])test('unreviewed '+label+' is held with original data',async()=>{
 const original=Buffer.from(genuineVerintFixture.responses[at].bodyBase64,'base64').toString('utf8')
 assert.notEqual(change(original),original,'Meaningful actual-response mutation')
 await assert.rejects(replayVerint(run,{mutate:(entity,index)=>index===at?bodyChange(entity,change):entity}),/Current native text contract/)
})
test('only the two identical typed original CSP value slots may vary',async()=>{
 const {jobs}=await replayVerint(run,{mutate:(entity,index)=>{
  if(![1,3,4,6].includes(index))return entity
  const text=entity.body.toString('utf8'),value=text.match(/<meta name="csp-nonce" id="csp-nonce" content="([A-Za-z0-9_-]{43})">/)[1]
  return bodyChange(entity,html=>html.replaceAll(value,'a'.repeat(43)))
 }})
 assert.equal(jobs.length,1)
})
test('disagreeing public CSP nonce owners cannot enter the original native data envelope',async()=>{
 await assert.rejects(replayVerint(run,{mutate:(entity,index)=>index===1?bodyChange(entity,html=>html.replace(/(<script nonce=")[A-Za-z0-9_-]{43}/,'$1'+'a'.repeat(43))):entity}),/nonce owners disagree/)
})
test('valid UTF8 nonASCII bytes cannot masquerade as an ASCII base64url CSP nonce',async()=>{
 const profile=JSON.parse((await import('node:fs')).readFileSync(new URL('./currentProfile20261114.json',import.meta.url),'utf8'))
 const replacement=Buffer.concat([Buffer.from([0xc2,0xb1]),Buffer.from('A'.repeat(41))])
 assert.equal(replacement.length,43)
 assert.match(replacement.toString('ascii'),/^[A-Za-z0-9_-]{43}$/)
 assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(replacement),'\u00b1'+'A'.repeat(41))
 const mutate=entity=>{
  const raw=Buffer.from(entity.body)
  for(const slot of profile.documents[entity.url].slots)replacement.copy(raw,slot.start)
  return {...entity,body:raw}
 }
 for(const entry of [run])await assert.rejects(replayVerint(entry,{mutate}),/Public CSP nonce type changed/)
})
for(const [label,change]of [
 ['BOM',body=>Buffer.concat([Buffer.from([239,187,191]),body])],
 ['invalid UTF8',body=>Buffer.concat([body.subarray(0,10),Buffer.from([255]),body.subarray(11)])],
 ['truncation',body=>body.subarray(0,-1)],
])test('original '+label+' never receives a normalized hash waiver',async()=>{
 await assert.rejects(replayVerint(run,{mutate:(entity,index)=>index===3?{...entity,body:change(entity.body)}:entity}),/Current native text contract/)
})
test('exact native final URL and MIME are required',async()=>{
 await assert.rejects(replayVerint(run,{mutate:(entity,index)=>index===3?{...entity,url:entity.url+'?changed'}:entity}),/HTTP status or exact final URL/)
 await assert.rejects(replayVerint(run,{mutate:(entity,index)=>index===2?{...entity,headers:{...entity.headers,'content-type':'text/plain'}}:entity}),/MIME/)
})
test('an unsupported declared charset cannot qualify identical UTF8 native criteria',async()=>{
 await assert.rejects(replayVerint(run,{mutate:(entity,index)=>index===3?{...entity,headers:{...entity.headers,'content-type':'text/html; charset=iso-8859-1'}}:entity}),/MIME/)
})
test('a pre-followed native redirect cannot qualify an identical final URL and body',async()=>{
 await assert.rejects(replayVerint(run,{fetchOverride:(_url,_options,index)=>{
  const response=fullVerintResponse(index)
  if(index===3)Object.defineProperty(response,'redirected',{value:true})
  return response
 }}),/followed redirect/)
})
for(const runOptions of [{maxRequests:7},{maxPages:5},{maxDetails:1}])test('caller reductions cannot omit mandatory closing reads '+JSON.stringify(runOptions),async()=>{
 let reads=0
 await assert.rejects(run({...runOptions,fetchImpl:async()=>{reads++;throw Error('Should not read')}}),/Caller budget/)
 assert.equal(reads,0)
})
test('byte limits are enforced while reading and before a document can be parsed',async()=>{
 await assert.rejects(replayVerint(run,{runOptions:{maxEntityBytes:1000}}),/Entity byte budget/)
 await assert.rejects(replayVerint(run,{runOptions:{maxAggregateBytes:300000}}),/Aggregate byte budget/)
 await assert.rejects(replayVerint(run,{runOptions:{maxOutputBytes:1000}}),/Output byte budget/)
})
test('shadowed Uint8Array byteLength cannot bypass original entity or aggregate byte bounds',async()=>{
 const fetchOverride=(_url,_options,index)=>{
  const original=genuineVerintFixture.responses[index],chunk=new Uint8Array(Buffer.from(original.bodyBase64,'base64'))
  Object.defineProperty(chunk,'byteLength',{value:0})
  const response=new Response(new ReadableStream({start(sink){sink.enqueue(chunk);sink.close()}}),{status:original.status,headers:original.headers})
  Object.defineProperty(response,'url',{value:original.url});return response
 }
 for(const entry of [run]){
  await assert.rejects(replayVerint(entry,{runOptions:{maxEntityBytes:100000},fetchOverride}),/Entity byte budget/)
  await assert.rejects(replayVerint(entry,{runOptions:{maxAggregateBytes:300000},fetchOverride}),/Aggregate byte budget/)
 }
})
test('byte accounting uses original intrinsic lengths without invoking a chunk getter',async()=>{
 const {jobs}=await replayVerint(run,{fetchOverride:(_url,_options,index)=>{
  const original=genuineVerintFixture.responses[index],chunk=new Uint8Array(Buffer.from(original.bodyBase64,'base64'))
  Object.defineProperty(chunk,'byteLength',{get(){throw Error('Shadowed byteLength getter must not execute')}})
  const response=new Response(new ReadableStream({start(sink){sink.enqueue(chunk);sink.close()}}),{status:original.status,headers:original.headers})
  Object.defineProperty(response,'url',{value:original.url});return response
 }})
 assert.equal(jobs.length,1)
 assert.equal(jobs.nativeCollectionEvidence.reader.aggregateBytes,937344)
})
test('caller maximums cannot expand original source ceilings',async()=>{
 const {jobs}=await replayVerint(run,{runOptions:{maxRequests:999,maxPages:999,maxDetails:999,maxEntityBytes:99999999,maxAggregateBytes:99999999,sourceTimeoutMs:999999,requestTimeoutMs:999999}})
 assert.deepEqual(jobs.nativeCollectionEvidence.reader.limits,{sourceTimeoutMs:45000,requestTimeoutMs:15000,maxRequests:16,maxPages:6,maxDetails:8,maxEntityBytes:4000000,maxAggregateBytes:24000000,maxOutputBytes:4000000})
})
test('pre-aborted opaque caller reason propagates unchanged with no read',async()=>{
 const controller=new AbortController(),reason={opaque:'caller cancellation'};controller.abort(reason)
 let reads=0
 await assert.rejects(run({signal:controller.signal,fetchImpl:async()=>{reads++}}),value=>value===reason)
 assert.equal(reads,0)
})
test('late opaque cancellation interrupts a transport that ignores its signal',async()=>{
 const controller=new AbortController(),reason={opaque:'late caller cancellation'}
 const timer=setTimeout(()=>controller.abort(reason),15)
 try{await assert.rejects(replayVerint(run,{runOptions:{signal:controller.signal},fetchOverride:()=>new Promise(()=>{})}),value=>value===reason)}finally{clearTimeout(timer)}
})
test('request and source deadlines interrupt an uncooperative transport',async()=>{
 for(const runOptions of [{requestTimeoutMs:15},{sourceTimeoutMs:15}])await assert.rejects(replayVerint(run,{runOptions,fetchOverride:()=>new Promise(()=>{})}),error=>error?.name==='TimeoutError')
})
test('a pending response body is bounded by the request deadline',async()=>{
 await assert.rejects(replayVerint(run,{runOptions:{requestTimeoutMs:15},fetchOverride:async()=>{
  const response=new Response(new ReadableStream({pull(){return new Promise(()=>{})}}),{headers:{'content-type':'text/html'}})
  Object.defineProperty(response,'url',{value:genuineVerintFixture.responses[0].url});return response
 }}),error=>error?.name==='TimeoutError')
})
test('body-only injected transports and invalid clocks fail before any network read',async()=>{
 await assert.rejects(run({fetchText:async()=>''}),/full Response fetchImpl/)
 let reads=0
 await assert.rejects(run({now:()=>null,fetchImpl:async()=>{reads++}}),/observation clock/)
 assert.equal(reads,0)
 await assert.rejects(replayVerint(run,{runOptions:{now:()=> '2026-11-11T00:00:00.000Z'}}),/publication\/date/)
})
test('historical direct-module import retains the original offset date verbatim',async()=>{
 const {jobs}=await replayVerint(run)
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].postingDate,'2026-11-12T13:47:09.067+00:00')
})
