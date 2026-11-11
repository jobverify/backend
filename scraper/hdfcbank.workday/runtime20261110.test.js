import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {PROFILE,roleModel,sha} from './profile20261110.js'
import {createHdfcTransport} from './transport20261110.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/runtime20261110.json.gz',import.meta.url))))
const replay=(change=packet=>packet)=>{
 const positions=new Map()
 return{now:()=>capture.captureCompletedAt,requestIntervalMs:0,fetchImpl:async(url,init)=>{
  const key=JSON.stringify([url,init.method||'GET',init.body||null]),position=positions.get(key)||0
  positions.set(key,position+1)
  const records=capture.captures.filter(p=>p.requestedURL===url&&(p.method||'GET')===(init.method||'GET')&&(p.requestBody||null)===(init.body||null))
  const original=records[position]
  assert.ok(original,'Authentic captured occurrence required for '+new URL(url).pathname+' #'+position)
  assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
  const packet=change(structuredClone(original),{url,position}),response=new Response(packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalURL})
  return response
 }}
}

test('HDFC fixture preserves all61 original source-export packets and distinct opening/closing receipts',()=>{
 assert.equal(capture.captureKind,'actual-source-export-opening-and-closing-original-native-responses')
 assert.equal(capture.captures.length,61)
 for(const packet of capture.captures){
  const bytes=Buffer.from(packet.rawBodyBase64,'base64')
  assert.equal(sha(bytes),packet.bodySHA256);assert.equal(bytes.length,packet.bodyBytes)
  assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(bytes),packet.body)
  assert.ok(Date.parse(packet.requestedAt)<=Date.parse(packet.completedAt))
 }
 const corporate=capture.captures.filter(p=>p.requestedURL===PROFILE.corporate)
 assert.deepEqual(corporate.map(p=>p.phase),['opening','closing'])
 assert.ok(Date.parse(corporate[0].completedAt)<Date.parse(corporate[1].requestedAt))
})

for(const[label,html]of [
 ['inline override','<script>requirejs.config({baseUrl:"https://other.example/"})</script>'],
 ['external override','<script src="https://other.example/override.js"></script>'],
 ['hidden executable override','<div hidden><script>requirejs.config({baseUrl:"https://other.example/"})</script></div>'],
 ['event override','<img src="broken" onerror="requirejs.config({baseUrl:\'https://other.example/\'})">'],
 ['script URL','<a href="javascript:requirejs.config({baseUrl:\'https://other.example/\'})">open</a>'],
 ['executable frame','<iframe srcdoc="override"></iframe>'],
 ['refresh handoff','<meta http-equiv="refresh" content="0;url=https://other.example/">'],
])test('HDFC holds an unreviewed native shell '+label,async()=>{
 await assert.rejects(run(replay(packet=>{if(new URL(packet.requestedURL).pathname==='/candidate/'){assert.ok(packet.body.includes('</html>'));packet.body=packet.body.replace('</html>',html+'</html>')}return packet})))
})

test('HDFC ignores commented and template-only shell program decoys',async()=>{
 const jobs=await run(replay(packet=>{if(new URL(packet.requestedURL).pathname==='/candidate/')packet.body=packet.body.replace('</html>','<!-- <script>override()</script> --><template><script>override()</script></template></html>');return packet}))
 assert.deepEqual(jobs.map(j=>j.jobId),['93137','92855'])
})

for(const field of ['jobDesc','otherDetails','jobSkills','supplementaryDetails'])for(const text of [
 'You will be employed by Other Corporation.','Your employer is Other Corporation.','Other Corporation is your employer.',
])test('HDFC rejects affirmative foreign own employer '+field+' '+text,()=>{
 const result=proof(native=>{native.jobVO[field]=(native.jobVO[field]||'')+'\n'+text})
 assert.ok(result.issues.includes('native-employer-contradiction'))
})

for(const field of ['jobLocation','locations'])for(const value of ['Toronto (Canada)','Toronto, Canada','Toronto - Canada','Toronto (Canada), India','New York (United States)','Singapore'])test('HDFC holds explicit foreign own workplace '+field+' '+value,()=>{
 const result=proof(native=>{native.jobVO[field]=value})
 assert.equal(result.country,null);assert.ok(result.issues.includes('native-country-contradiction'))
})

for(const field of ['jobDesc','otherDetails','jobSkills','supplementaryDetails'])for(const text of ['Location: United States','Location: Toronto - Canada','Location: Toronto (Canada), India','Our overview<aside>Location: Toronto (Canada)</aside>'])test('HDFC holds explicit foreign own public workplace '+field+' '+text,()=>{
 const result=proof(native=>{native.jobVO[field]=(native.jobVO[field]||'')+'\n'+text})
 assert.equal(result.country,null);assert.ok(result.issues.includes('native-country-contradiction'))
})

for(const label of ['request','source'])test('HDFC monotonic '+label+' deadline rejects a synchronously stalled producer',async()=>{
 const packet=capture.captures[0]
 const transport=createHdfcTransport({requestIntervalMs:0,requestTimeoutMs:label==='request'?10:100,sourceTimeoutMs:label==='source'?20:100,
  fetchImpl:async url=>{const began=performance.now();while(performance.now()-began<40){/* emulate blocked event loop */}const response=new Response(packet.body,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:url});return response}},()=>true)
 try{await assert.rejects(transport.read(packet.requestedURL),error=>label==='request'?error.name==='TimeoutError':error.code==='HDFC_SOURCE_TIMEOUT')
  assert.equal(transport.receipts[0].bodyComplete,false)
 }finally{transport.stop()}
})

for(const[label,purpose,responsibilities,tail]of [
 ['headings only','','',''],
 ['placeholder sections','<p>TBD</p>','<p>To be updated</p>',''],
 ['hidden sections','<p hidden>Represent the Bank and present eligible products to customers.</p>','<p hidden>Achieve monthly targets across all product lines.</p>',''],
 ['quoted sections','<blockquote><p>Represent the Bank and present eligible products to customers.</p></blockquote>','<pre><p>Achieve monthly targets across all product lines.</p></pre>',''],
 ['later metadata cannot supply empty responsibilities','<p>Represent the Bank and present eligible products to customers.</p>','','<p>Educational Qualifications:</p><p>Graduation from an accredited university with relevant banking experience.</p>'],
])test('HDFC requires actual own purpose and responsibility criteria '+label,()=>{
 const result=proof(native=>{native.jobVO.jobDesc='<p>Job Title</p><p>VST-Sales Officer</p><p>Job Details</p><p>Location: Pan India</p><p>Department: Retail Banking</p><p>Division: Sales</p><p>Job Purpose</p>'+purpose+'<p>Job Responsibilities</p>'+responsibilities+tail})
 assert.equal(result.fullCriteriaComplete,false);assert.ok(result.issues.includes('native-full-criteria-unavailable'))
})

for(const limits of [{maxResponseBytes:1},{maxTotalBytes:100}])test('HDFC bounds actual raw response bytes '+JSON.stringify(limits),async()=>{
 await assert.rejects(run({...replay(),...limits}),error=>{assert.equal(error.sourceAudit.originalPages[0].bodyComplete,false);return true})
})

test('HDFC rejects invalid native UTF8 without inventing decoded original bytes',async()=>{
 await assert.rejects(run({fetchImpl:async url=>{const response=new Response(Uint8Array.from([0xc3,0x28]),{headers:{'Content-Type':'text/html'}});Object.defineProperty(response,'url',{value:url});return response}}),error=>{
  assert.equal(error.sourceAudit.originalPages[0].bodyComplete,false);assert.equal(error.sourceAudit.originalPages[0].rawBodyBase64,'wyg=');return true
 })
})

test('registered HDFC source recovers two own explicitly India workplace roles from the current public RippleHire contract',async()=>{
 const jobs=await run(replay())
 assert.deepEqual(jobs.map(job=>job.jobId),['93137','92855'])
 for(const job of jobs){
  assert.equal(job.source,'hdfcbank');assert.equal(job.company,'HDFC Bank');assert.equal(job.country,'India')
  assert.equal(job.nativeLegalEmployer,null);assert.equal(job.rawNativeCountryId,1)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.sourceDetailComplete,true)
  assert.equal(job.sourceDescription,job.nativeSourceRecord.jobVO.jobDesc)
 }
 assert.equal(readSourceObservationEvidence(jobs,'hdfcbank').observedVacancyCount,20)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.sourceAudit.reportedNativeQueryTotal,502)
 assert.equal(jobs.sourceAudit.companyGlobalTotal,null)
 assert.equal(jobs.sourceAudit.companyIndiaTotal,null)
 assert.equal(jobs.sourceAudit.unknownCountryCount,18)
 assert.equal(jobs.sourceAudit.originalPages.length,61)
 assert.equal(jobs.sourceAudit.selectedSliceReconciled,true)
 assert.equal(jobs.sourceAudit.queryEnumerationComplete,false)
 assert.equal(jobs[0].nativeCountryIdMapping,null)
})

test('actual HDFC registered adapter preserves the two India roles and20 native observations',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='hdfcbank');assert.ok(provider)
 const jobs=await createCatalogScraper(provider).run(replay())
 assert.equal(jobs.length,2);assert.equal(readSourceObservationEvidence(jobs,'hdfcbank').observedVacancyCount,20)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,20)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
const listing=JSON.parse(capture.captures.find(p=>p.method==='POST').body).jobVoList.find(r=>r.jobSeq==='93137')
const original=JSON.parse(capture.captures.find(p=>new URL(p.requestedURL).pathname==='/candidate/candidatejobdetail'&&new URL(p.requestedURL).searchParams.get('jobSeq')==='93137').body)
const proof=change=>{const native=structuredClone(original),row=structuredClone(listing);change(native,row);return roleModel(native,row,capture.captureCompletedAt)}
const replaceLocation=(native,html)=>{native.jobVO.jobDesc=native.jobVO.jobDesc.replace(/<p[^>]*><b>Location:<\/b> Pan India<\/p>/,html)}

test('numeric native country1 and city alone never establish India for neighboring roles',()=>{
 const native=JSON.parse(capture.captures.find(p=>new URL(p.requestedURL).pathname==='/candidate/candidatejobdetail'&&new URL(p.requestedURL).searchParams.get('jobSeq')==='93077').body)
 const row=JSON.parse(capture.captures.find(p=>p.method==='POST').body).jobVoList.find(r=>r.jobSeq==='93077')
 const result=roleModel(native,row,capture.captureCompletedAt)
 assert.equal(native.jobVO.countryMstNewSeq,1);assert.equal(result.country,null)
 assert.ok(result.issues.includes('native-country-unresolved'))
})
for(const[label,html]of [
 ['city only','<p><b>Location:</b> Mumbai</p>'],
 ['sales market','<p><b>Sales Market:</b> Pan India</p>'],
 ['client scope','<p><b>Client Coverage:</b> Pan India</p>'],
 ['substring country','<p><b>Location:</b> Pan India clients from United States</p>'],
 ['duplicate worksite','<p><b>Location:</b> Pan India</p><p>Location: United States</p>'],
 ...['template','blockquote','q','code','pre','script','aside'].map(tag=>[tag,'<'+tag+'><p><b>Location:</b> Pan India</p></'+tag+'>']),
 ['nested code','<p><b>Location:</b> <code>Pan India</code></p>'],
 ['nested quote','<p><b>Location:</b> <q>Pan India</q></p>'],
 ['hidden','<p hidden><b>Location:</b> Pan India</p>'],
 ['aria hidden','<p aria-hidden="true"><b>Location:</b> Pan India</p>'],
 ['style hidden','<p style="display:none"><b>Location:</b> Pan India</p>'],
])test('HDFC does not turn '+label+' into own workplace India proof',()=>{
 const result=proof(native=>replaceLocation(native,html));assert.equal(result.country,null)
})
test('HDFC does not borrow a Location label from later responsibilities',()=>{
 const result=proof(native=>{replaceLocation(native,'');native.jobVO.jobDesc=native.jobVO.jobDesc.replace('Job Responsibilities:','Job Responsibilities:</b></p><p>Location: Pan India</p><p><b>')})
 assert.equal(result.country,null)
})
test('HDFC requires the own body title to match its native title for contextual workplace proof',()=>{
 const result=proof(native=>{native.jobVO.jobDesc=native.jobVO.jobDesc.replace('VST-Sales Officer</p>','Other Role</p>')})
 assert.equal(result.country,null)
})
for(const[field,value]of [['country','US'],['countryCode','GB'],['countryName','Singapore'],['jobCountry','United States']])test('HDFC rejects contradictory typed country '+field,()=>{
 const result=proof(native=>{native.jobVO[field]=value});assert.equal(result.country,null);assert.ok(result.issues.includes('native-country-contradiction'))
})
test('HDFC preserves an unmapped numeric country ID without inventing a dictionary relation',()=>{
 const result=proof(native=>{native.jobVO.countryMstNewSeq=999})
 assert.equal(result.country,'India');assert.equal(result.workplaceProof.method,'own-role-active-JobDetails-worksite-label')
})
for(const field of ['jobDesc','otherDetails','jobSkills','supplementaryDetails'])for(const text of [
 'Employer: Other Corporation','HDFC Bank is not your employer.','You will not be employed by HDFC Bank.',
 'Our overview<aside>Employer: Other Corporation</aside>',
])test('HDFC rejects active own employer contradiction '+field+' '+text,()=>{
 const result=proof(native=>{native.jobVO[field]=(native.jobVO[field]||'')+'\n'+text})
 assert.ok(result.issues.includes('native-employer-contradiction'))
})
for(const tag of ['template','blockquote','q','pre','code','script'])test('HDFC ignores '+tag+' employer samples',()=>{
 const result=proof(native=>{native.jobVO.otherDetails='<'+tag+'>Employer: Other Corporation. HDFC Bank is not your employer.</'+tag+'>'})
 assert.ok(!result.issues.includes('native-employer-contradiction'))
})
for(const field of ['legalEmployer','Employer','employerName'])test('HDFC holds an unreviewed native legal/employer field '+field,()=>{
 assert.ok(proof(native=>{native.jobVO[field]='Other Corporation'}).issues.includes('unreviewed-native-employer-field'))
})
for(const[field,value]of [['jobStatus','CLOSED'],['allowCareerSite','N'],['numOfOpening','0'],['jobPositionsClosed','30'],['hiringDeadline','2026-10-01'],['jobDesc','<p>Job description unavailable</p>']])test('HDFC holds invalid publication/criteria '+field,()=>{
 const result=proof(native=>{native.jobVO[field]=value});assert.ok(result.issues.length>0)
})
const packetJSON=(packet,change)=>{const native=JSON.parse(packet.body);change(native);packet.body=JSON.stringify(native);return packet}
const nativeRoleChange=(change,{closingOnly=false}={})=>(packet,{position})=>{
 if(new URL(packet.requestedURL).pathname==='/candidate/candidatejobdetail'&&new URL(packet.requestedURL).searchParams.get('jobSeq')==='93137'&&(!closingOnly||position===1))packetJSON(packet,change)
 return packet
}
test('HDFC source excludes a contradicted country role while retaining native observations and proven neighbor',async()=>{
 const jobs=await run(replay(nativeRoleChange(native=>{native.jobVO.countryCode='US'})))
 assert.deepEqual(jobs.map(j=>j.jobId),['92855']);assert.equal(readSourceObservationEvidence(jobs,'hdfcbank').observedVacancyCount,20)
})
test('HDFC source excludes active employer denial while retaining proven neighbor',async()=>{
 const jobs=await run(replay(nativeRoleChange(native=>{native.jobVO.otherDetails='Employer: Other Corporation'})))
 assert.deepEqual(jobs.map(j=>j.jobId),['92855'])
})

for(const[label,change]of [
 ['affirmative foreign employer',native=>{native.jobVO.otherDetails='You will be employed by Other Corporation.'}],
 ['foreign published worksite',native=>{native.jobVO.jobLocation='Toronto (Canada)'}],
 ['foreign other-field worksite',native=>{native.jobVO.otherDetails='Location: United States'}],
 ['empty criteria sections',native=>{native.jobVO.jobDesc='<p>Job Title</p><p>VST-Sales Officer</p><p>Job Details</p><p>Location: Pan India</p><p>Department: Retail Banking</p><p>Division: Sales</p><p>Job Purpose</p><p>Job Responsibilities</p>'}],
])test('HDFC end-to-end holds '+label+' and retains20 native originals',async()=>{
 const jobs=await run(replay(nativeRoleChange(change)))
 assert.deepEqual(jobs.map(j=>j.jobId),['92855'])
 assert.equal(jobs.sourceAudit.observations.length,20);assert.equal(jobs.sourceAudit.originalPages.length,61)
 assert.equal(readSourceObservationEvidence(jobs,'hdfcbank').observedVacancyCount,20)
})

test('HDFC workplace country parser does not interpret a state abbreviation as a country',()=>{
 const result=proof(native=>{native.jobVO.jobLocation='CA';native.jobVO.locations='Sacramento, CA'})
 assert.ok(!result.typedCountries.includes('Canada'));assert.equal(result.country,'India')
})
const badNative=[
 ['identity',native=>{native.jobVO.jobSeq='999999'}],['title',native=>{native.jobVO.jobTitle='Other role'}],
 ['company ID',native=>{native.companyVO.companyMstrSeq='999'}],['company name',native=>{native.companyVO.companyName='Other Bank'}],
 ['company domain',native=>{native.companyVO.domainName='other.ripplehire.com'}],['company code',native=>{native.companyVO.companyCd='OTHER'}],
]
for(const[name,change]of badNative)test('HDFC holds own native '+name+' mismatch',async()=>{await assert.rejects(run(replay(nativeRoleChange(change))))})
test('HDFC holds changed complete closing own model and retains native originals',async()=>{
 await assert.rejects(run(replay(nativeRoleChange(native=>{native.jobVO.jobDesc+='<p>Changed native responsibility</p>'},{closingOnly:true}))),error=>{
  assert.equal(error.sourceAudit.observedRecordCount,20);assert.ok(error.sourceAudit.originalPages.some(p=>p.phase==='closing'));return true
 })
})
test('HDFC holds changed closing selected listing',async()=>{
 await assert.rejects(run(replay((packet,{position})=>{if(packet.method==='POST'&&position===1)packetJSON(packet,value=>{value.jobVoList[0].jobTitle+=' changed'});return packet})))
})
for(const[label,change]of [
 ['missing corporate link',packet=>{if(packet.requestedURL===PROFILE.corporate)packet.body=packet.body.replaceAll(PROFILE.entry,'https://other.example/careers')}],
 ['different native title',packet=>{if(new URL(packet.requestedURL).pathname==='/candidate/'&&!packet.method?.includes('POST'))packet.body=packet.body.replace('HDFC Bank Careers | Latest jobs at HDFC Bank - Ripplehire.com','Other Bank Careers')}],
 ['changed AMD program',packet=>{if(new URL(packet.requestedURL).pathname.endsWith('/entities/job.js'))packet.body=packet.body.replace('candidatejobdetail','privatejobdetail')}],
 ['unreviewed AMD site',packet=>{if(packet.headers.location)packet.headers.location=packet.headers.location.replace('hdfcbank.ripplehire.com','other.ripplehire.com')}],
 ['unexpected redirect final authority',packet=>{if(packet.requestedURL===PROFILE.entry)packet.finalURL='https://other.example/'}],
])test('HDFC holds '+label,async()=>{
 await assert.rejects(run(replay(packet=>{change(packet);return packet})))
})
test('HDFC holds closing corporate handoff change',async()=>{
 await assert.rejects(run(replay((packet,{position})=>{if(packet.requestedURL===PROFILE.corporate&&position===1)packet.body=packet.body.replaceAll(PROFILE.entry,'https://other.example/');return packet})))
})
test('HDFC retains actual denied status and stops before native role queries',async()=>{
 await assert.rejects(run(replay(packet=>{if(packet.requestedURL===PROFILE.entry)packet.status=403;return packet})),error=>{
  assert.equal(error.status,403);assert.equal(error.sourceAudit.observations.length,0);return true
 })
})
for(const maxRequests of [2,59])test('HDFC preserves combined opening/closing request budget '+maxRequests,async()=>{
 await assert.rejects(run({...replay(),maxRequests}),error=>{assert.ok(error.sourceAudit.requestMetrics.requests<=maxRequests);return true})
})
test('HDFC explicit detail cap preserves observed rows without inventing complete totals',async()=>{
 const jobs=await run({...replay(),maxDetails:1})
 assert.deepEqual(jobs.map(j=>j.jobId),['93137']);assert.equal(readSourceObservationEvidence(jobs,'hdfcbank').observedVacancyCount,10)
 assert.equal(jobs.sourceAudit.unknownCountryCount,9);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const options of [{maxDetails:21},{maxPages:3},{maxRequests:0},{sourceTimeoutMs:0},{now:()=> 'invalid'}])test('HDFC rejects invalid options before I/O '+JSON.stringify(options),async()=>{
 await assert.rejects(run({...options,fetchImpl:()=>assert.fail('invalid option must not fetch')}))
})
test('HDFC maxJobs0 makes no authoritative zero claim or native requests',async()=>{
 const jobs=await run({maxJobs:0,fetchImpl:()=>assert.fail('zero optional output cap must not fetch')})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(jobs.sourceAudit.reportedNativeQueryTotal,null)
})
test('HDFC respects pre-aborted caller reason without I/O',async()=>{
 const controller=new AbortController(),reason=Error('cancelled HDFC');controller.abort(reason)
 await assert.rejects(run({signal:controller.signal,fetchImpl:()=>assert.fail('cancelled producer')}),error=>error===reason)
})
test('HDFC actively bounds a transport that ignores its signal',async()=>{
 const keepAlive=setInterval(()=>{},100)
 try{await assert.rejects(run({requestTimeoutMs:10,sourceTimeoutMs:100,fetchImpl:()=>new Promise(()=>{})}),error=>error.name==='TimeoutError')}
 finally{clearInterval(keepAlive)}
})
test('HDFC failed native body acquisition cancels and releases once and preserves denied headers',async()=>{
 let cancelled=0,released=0
 const keepAlive=setInterval(()=>{},100)
 try{await assert.rejects(run({requestTimeoutMs:10,sourceTimeoutMs:100,fetchImpl:async url=>({url,status:403,redirected:false,headers:new Headers({'Content-Type':'text/html'}),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:()=>{cancelled++},releaseLock:()=>{released++}})}})}),error=>{
  assert.equal(error.status,403);assert.equal(error.sourceAudit.originalPages[0].bodyComplete,false);return true
 })}finally{clearInterval(keepAlive)}
 assert.equal(cancelled,1);assert.equal(released,1)
})
test('HDFC bounded audit observer cannot mutate retained native facts',async()=>{
 const jobs=await run({...replay(),onAudit:audit=>{audit.observations[0].openingNative.jobVO.jobTitle='Mutated detached audit'}})
 assert.equal(jobs[0].title,'VST-Sales Officer');assert.equal(jobs.sourceAudit.observations[0].openingNative.jobVO.jobTitle,'VST-Sales Officer')
})
test('HDFC actively bounds an audit observer that ignores its signal',async()=>{
 const keepAlive=setInterval(()=>{},100)
 try{await assert.rejects(run({...replay(),auditTimeoutMs:10,onAudit:()=>new Promise(()=>{})}),error=>error.name==='TimeoutError')}
 finally{clearInterval(keepAlive)}
})
