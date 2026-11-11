import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import * as source from './script.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {readRole} from './native20261111.js'
import {createRupeekTransport} from './transport20261111.js'
import {createHash} from 'node:crypto'
import {enrichJobsWithPublicExperience} from '../../scraper-support/utils/publicExperienceEnrichment.js'
import {withRetry} from '../../scraper-support/utils/retry.js'
import {extractionFailureDetails} from '../../scripts/catalogExtractionFailureEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/discovery20261111.json.gz',import.meta.url))))
const corporate=Buffer.from(fixture.packets[0].rawBodyBase64,'base64').toString('utf8')
const detail=Buffer.from(fixture.packets[1].rawBodyBase64,'base64').toString('utf8')
const url='https://www.linkedin.com/jobs/view/controlled-role-at-rupeek-9000000001'
const card=location=>`<a href="${url}"><p>Controlled Analyst</p><p>Location: ${location}</p><p>1 day ago</p></a>`
const shell=body=>`<html><head><title>Join our team | Rupeek | Careers</title><link rel="canonical" href="https://rupeek.com/careers"></head><body><h2>Why join Us</h2><h2>Engineering at Rupeek</h2><h2>Open Positions</h2>${body}</body></html>`

test('genuine current corporate page preserves fifteen explicit India role IDs',()=>{
 const rows=source.extractJobCardsFromCareersHtml(corporate)
 assert.equal(source.hasOfficialRupeekCareersSignals(corporate),true)
 assert.equal(rows.length,15);assert.equal(new Set(rows.map(j=>j.jobId)).size,15)
 assert.ok(rows.every(j=>j.country==='India'&&j.location==='Bengaluru, Karnataka, India'&&j.requisitionId===null))
})
for(const location of ['Remote','Location undisclosed','Country: US','Country: ZZ','Bengaluru, Country code: CA, India','Bengaluru, Karnataka','Toronto, Canada, India','Toronto (Canada), India','Not India'])test('controlled own location never defaults to India: '+location,()=>{
 const rows=source.extractJobCardsFromCareersHtml(shell(card(location)))
 assert.equal(rows.length,1,'preserve candidate observation')
 assert.notEqual(rows[0].country,'India')
 const normalized=rows.map(j=>normalizeScrapedJob({...j,source:'rupeek',company:'Rupeek'},{countryFilter:'India',country:'India'}))
 assert.equal(analyzePublishableJobs(normalized).indiaJobs.length,0)
})
for(const tag of ['template','blockquote','pre','code','div hidden','div aria-hidden="true"'])test('controlled inactive card excluded: '+tag,()=>{
 assert.equal(source.extractJobCardsFromCareersHtml(shell(`<${tag}>${card('Bengaluru, Karnataka, India')}</${tag.split(' ')[0]}>`)).length,0)
})
for(const tag of ['template','blockquote','pre','code','div hidden'])test('controlled whole inactive publisher excluded: '+tag,()=>{
 assert.equal(source.hasOfficialRupeekCareersSignals(`<${tag}>${shell(card('Bengaluru, Karnataka, India'))}</${tag.split(' ')[0]}>`),false)
})
test('unrelated unverified detail never promoted by generic enrichment',async()=>{
 await assert.rejects(source.createRupeekScraper().run({fetchText:async()=>detail}),/complete native HTTP responses/)
})
const genuineRow={title:'Associate',location:'Bengaluru, Karnataka, India',country:'India',jobId:'4486374940',sourceUrl:fixture.packets[1].requestedUrl}
test('genuine own LinkedIn full criteria match native card identity and employer',()=>{
 const proof=readRole(detail,genuineRow);assert.equal(proof.sourceDetailComplete,true)
 assert.match(proof.jobDescription,/Commerce is mandatory/);assert.equal(proof.nativeLegalEmployer,null)
 assert.equal(proof.skipPublicExperienceEnrichment,true);assert.equal(proof.publicExperienceChecked,true)
})
for(const [label,from,to] of [
 ['reveal routine','$RB=[]','$RB=[1]'],
 ['inert reveal type','<script>$RB=[]','<script type="application/json">$RB=[]'],
 ['module reveal type','<script>$RB=[]','<script type="module">$RB=[]'],
 ['skipped reveal routine','<script>$RB=[]','<script nomodule>$RB=[]'],
 ['unbound reveal','$RC("B:1","S:1")','$RC("B:2","S:1")'],
 ['duplicate native source','</body>','<template><div id="S:1"></div></template></body>'],
 ['unreviewed program','</body>','<script>$RC=function(){}</script></body>'],
 ['quoted routine','<script>$RB=[]','<blockquote><script>$RB=[]'],
 ['foreign executable','</body>','<script src="https://other.example/override.js"></script></body>'],
 ['event override','</body>','<img src="x" onerror="alert(1)"></body>'],
 ['foreign base','</head>','<base href="https://other.example/"></head>'],
 ['duplicate publisher','</head>','<link rel="canonical" href="https://other.example/"></head>'],
])test('genuine stream rejects controlled '+label,()=>{
 const changed=corporate.replace(from,to);assert.notEqual(changed,corporate)
 assert.equal(source.hasOfficialRupeekCareersSignals(changed),false)
})
const appendOwn=(html,content)=>html.replace('Associate - Loan Admin','Associate - Loan Admin'+content)
for(const text of ['<p>Employer: Other Corporation</p>','<p>Employer:</p><p>Other Corporation</p>','<aside>Employer: Other Corporation</aside>','<p>You will be employed by Other Corporation.</p>','<p>Rupeek is not your employer.</p>',"<p>You won't be employed by Rupeek.</p>",'<p>Country: US</p>','<p>Country: ZZ</p>','<p>Work Location:</p><p>Toronto, Canada</p>','<p>The successful candidate will be based in Toronto, Canada.</p>'])test('own genuine detail rejects active contradiction '+text,()=>{
 assert.throws(()=>readRole(appendOwn(detail,text),genuineRow))
})
for(const tag of ['template','blockquote','pre','code','div hidden'])test('inert own contradiction ignored '+tag,()=>{
 assert.equal(readRole(appendOwn(detail,`<${tag}><p>Employer: Other Corporation</p><p>Country: US</p></${tag.split(' ')[0]}>`),genuineRow).sourceDetailComplete,true)
})
const response=(packet,body=Buffer.from(packet.rawBodyBase64,'base64'),status=packet.status)=>{const result=new Response(body,{status,headers:packet.headers});Object.defineProperty(result,'url',{value:packet.requestedUrl??packet.url});return result}
const partial=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/partial20261111.json.gz',import.meta.url))))
test('genuine partial run preserves all exact raw packets and stops at first429',async()=>{
 let ordinal=0
 await assert.rejects(source.run({fetchImpl:async url=>{const packet=partial.nativeEvidence.transportPackets[ordinal++];assert.equal(url,packet.url);return response(packet)}}),error=>{
  assert.equal(error.status,429);assert.equal(error.abortRetries,true)
  assert.equal(error.nativeEvidence.observedCorporateRoleCards,15)
  assert.equal(error.nativeEvidence.observedListingCount,null)
  assert.equal(error.nativeEvidence.corporateRoleCards.length,15)
  assert.equal(ordinal,12)
  for(let i=0;i<12;i++){const observed=error.nativeEvidence.transportPackets[i],original=partial.nativeEvidence.transportPackets[i];assert.equal(observed.rawBodyBase64,original.rawBodyBase64);assert.equal(observed.bodySHA256,original.bodySHA256);assert.equal(observed.status,original.status)}
  return true
 })
})
test('controlled closing replay of first genuine role does not call generic enrichment',async()=>{
 // This replays each discovery packet twice as an explicit closing control;
 // discovery captured one occurrence per URL, not actual closing reads.
 const jobs=await source.run({maxJobs:1,fetchImpl:async url=>response(fixture.packets[url===source.OFFICIAL_CAREERS_URL?0:1])})
 assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].requisitionId,null);assert.equal(jobs[0].nativeLegalEmployer,null)
 assert.equal(jobs.sourceAudit.observedCorporateRoleCards,15);assert.equal(jobs.sourceAudit.originalPages.length,4)
 let calls=0;const unexpected=async()=>{calls++;throw Error('unexpected generic network')}
 const enriched=await enrichJobsWithPublicExperience(jobs,{fetchText:unexpected,fetchJson:unexpected,fetchBrowserText:unexpected})
 assert.equal(calls,0);assert.equal(enriched[0].jobDescription,jobs[0].jobDescription)
})
for(const status of [403,429,200])test('controlled malformed UTF8 preserves original HTTP '+status,async()=>{
 const receipts=[],s=createRupeekTransport({fetchImpl:async()=>response(fixture.packets[0],Buffer.from([255,254,192]),status)},receipts)
 try{await assert.rejects(s.read(source.OFFICIAL_CAREERS_URL,'html'),e=>status===200?e.code==='ERR_ENCODING_INVALID_ENCODED_DATA':e.status===status)}finally{s.close()}
 assert.equal(receipts[0].status,status);assert.equal(receipts[0].rawBodyBase64,'//7A');assert.equal(receipts[0].sha256,createHash('sha256').update(Buffer.from([255,254,192])).digest('hex'))
})
test('ignored fetch callback still expires and late body canceled once',async()=>{
 let resolve,cancels=0;const receipts=[],s=createRupeekTransport({requestTimeoutMs:10,sourceTimeoutMs:80,fetchImpl:()=>new Promise(r=>{resolve=r})},receipts)
 try{await assert.rejects(s.read(source.OFFICIAL_CAREERS_URL,'html'),e=>e.name==='TimeoutError');resolve({body:{cancel(){cancels++}}});await new Promise(r=>setTimeout(r,15));assert.equal(cancels,1)}finally{s.close()}
})
test('exact caller reason preserved for ignored fetch',async()=>{
 const caller=new AbortController(),reason={sentinel:'caller'},s=createRupeekTransport({signal:caller.signal,fetchImpl:()=>new Promise(()=>{})},[])
 try{const p=s.read(source.OFFICIAL_CAREERS_URL,'html');caller.abort(reason);await assert.rejects(p,e=>e===reason)}finally{s.close()}
})
test('monotonic request guard catches synchronous fetch stall',async()=>{
 const s=createRupeekTransport({requestTimeoutMs:5,sourceTimeoutMs:100,fetchImpl:()=>{const until=performance.now()+20;while(performance.now()<until){/* deliberate callback stall */}return response(fixture.packets[0])}},[])
 try{await assert.rejects(s.read(source.OFFICIAL_CAREERS_URL,'html'),e=>e.name==='TimeoutError')}finally{s.close()}
})
for(const [label,status]of[['denied',403],['rate-limited',429]])for(const phase of ['primary','closing'])test('actual outer policy never retries controlled '+phase+' '+label,async()=>{
 let attempts=0,calls=0
 let nativeError
 const target=phase==='primary'?0:2
 await assert.rejects(withRetry(async()=>{attempts++;let ordinal=0;try{return await source.run({maxJobs:1,fetchImpl:async url=>{calls++;return response(fixture.packets[url===source.OFFICIAL_CAREERS_URL?0:1],undefined,ordinal++===target?status:200)}})}catch(error){nativeError=error;throw error}},{attempts:2,baseDelayMs:0,label:'rupeek-'+label}))
 assert.equal(nativeError.status,status);assert.equal(nativeError.abortRetries,true);if(status===403)assert.equal(extractionFailureDetails(nativeError).failureKind,'blocked_or_access_denied')
 assert.equal(attempts,1);assert.equal(calls,target+1)
})
for(const [label,body]of[['login','<html><head><title>Sign In | LinkedIn</title></head></html>'],['foreign role',detail.replaceAll('Associate','Other Job').replaceAll('Rupeek','Other Corporation')]])test('controlled '+label+' is never promoted',async()=>{
 let calls=0
 if(label==='login'){
  await assert.rejects(source.run({maxJobs:1,fetchImpl:async url=>{calls++;return response(fixture.packets[url===source.OFFICIAL_CAREERS_URL?0:1],url===source.OFFICIAL_CAREERS_URL?undefined:body)}}),/login or access wall/);assert.equal(calls,2)
 }else{
  const jobs=await source.run({maxJobs:1,fetchImpl:async url=>response(fixture.packets[url===source.OFFICIAL_CAREERS_URL?0:1],url===source.OFFICIAL_CAREERS_URL?undefined:body)})
  assert.equal(jobs[0].jobDescription,null);assert.equal(jobs[0].publicExperienceChecked,false);assert.equal(jobs[0].skipPublicExperienceEnrichment,true);assert.equal(jobs[0].sourceDetailComplete,false)
 }
})
for(const tag of ['blockquote','pre','code','template','div hidden'])test('own detail publisher/criteria wrapped in '+tag+' never proves current role',()=>{
 assert.throws(()=>readRole(`<${tag}>${detail}</${tag.split(' ')[0]}>`,genuineRow))
})
test('own criteria require substance beyond section labels',()=>{
 const match=/<div class="show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(detail)
 assert.ok(match)
 assert.throws(()=>readRole(detail.replace(match[0],match[0].replace(match[1],'<p>Responsibilities:</p><p>Qualifications:</p><p><strong>Experience</strong></p>')),genuineRow),/criteria sections/)
})
for(const markup of ['<p><strong>Required technical skills and work experience</strong></p>','<h3>Required technical skills and work experience</h3>','<p>Required technical skills and work experience</p>'])test('genuine qualification long label alone remains incomplete: '+markup,()=>{
 const start=detail.indexOf('Eligibility:'),end=detail.indexOf('</div>',start)
 assert.ok(start>0&&end>start)
 const changed=detail.slice(0,start)+'Eligibility:</p>'+markup+detail.slice(end)
 assert.throws(()=>readRole(changed,genuineRow),/criteria sections/)
})
for(const location of['Not in India','Outside India','India / Remote'])test('reviewed own country ambiguity/negation '+location,()=>{
 const rows=source.extractJobCardsFromCareersHtml(shell(card(location)));assert.equal(rows.length,1);assert.notEqual(rows[0].country,'India')
})
test('visible card cannot bypass existing genuine current stream program review',()=>{
 const changed=corporate.replace('</body>',card('Bengaluru, Karnataka, India')+'<script>window.fakeOverride=true</script></body>')
 assert.equal(source.hasOfficialRupeekCareersSignals(changed),false)
})
for(const spelling of["id='S:1'",'id=S:1'])test('parsed stream identity cannot bypass review via '+spelling,()=>{
 const equivalent=corporate.replace('id="S:1"',spelling)
 assert.equal(source.hasOfficialRupeekCareersSignals(equivalent),true)
 const changed=equivalent.replace('</body>',card('Bengaluru, Karnataka, India')+'<script>window.fakeOverride=true</script></body>')
 assert.equal(source.hasOfficialRupeekCareersSignals(changed),false)
})
for(const text of ['Your employer will be Other Corporation.','You are employed by Other Corporation.','This job is based in Toronto, Canada.','The role is based in Toronto, Canada.'])test('reviewed own role declaration contradiction '+text,()=>{
 assert.throws(()=>readRole(appendOwn(detail,'<p>'+text+'</p>'),genuineRow))
})
test('genuine qualification metadata alone never supplies requirements',()=>{
 const start=detail.indexOf('Eligibility:'),end=detail.indexOf('</div>',start)
 const changed=detail.slice(0,start)+'Eligibility:</p><p>Job title: Associate; Employer: Rupeek; Work Location: Bengaluru, Karnataka, India.</p>'+detail.slice(end)
 assert.throws(()=>readRole(changed,genuineRow),/criteria sections/)
})
test('own native criteria metadata cannot contradict publisher employer',()=>{
 const changed=detail.replace('Seniority level','Employer')
 assert.notEqual(changed,detail);assert.throws(()=>readRole(changed,genuineRow),/employer conflict/)
})
for(const phase of ['corporate','detail'])test('closing '+phase+' conflict holds source before output',async()=>{
 let ordinal=0
 await assert.rejects(source.run({maxJobs:1,fetchImpl:async url=>{const closing=ordinal++>1;let body=url===source.OFFICIAL_CAREERS_URL?corporate:detail;if(closing&&(phase==='corporate'?url===source.OFFICIAL_CAREERS_URL:url!==source.OFFICIAL_CAREERS_URL))body=body.replaceAll('Associate','Other Job');return response(fixture.packets[url===source.OFFICIAL_CAREERS_URL?0:1],body)}}),/closing|title mismatch/)
})
test('ignored body read expires and reader canceled/released once',async()=>{
 let cancels=0,releases=0
 const s=createRupeekTransport({requestTimeoutMs:10,sourceTimeoutMs:100,fetchImpl:async()=>({status:200,url:source.OFFICIAL_CAREERS_URL,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{read:()=>new Promise(()=>{}),cancel(){cancels++},releaseLock(){releases++}}}}})},[])
 try{await assert.rejects(s.read(source.OFFICIAL_CAREERS_URL,'html'),e=>e.name==='TimeoutError');assert.equal(cancels,1);assert.equal(releases,1)}finally{s.close()}
})
test('source deadline races ignored audit callback after parsed closing',async()=>{
 await assert.rejects(source.run({maxJobs:1,sourceTimeoutMs:500,fetchImpl:async url=>response(fixture.packets[url===source.OFFICIAL_CAREERS_URL?0:1]),onAudit:()=>new Promise(()=>{})}),e=>e.name==='TimeoutError')
})
test('all fifteen honest held candidates including intern survive normalization without enrichment promotion',async()=>{
 // Controlled identity-conflicting own responses deliberately hold every
 // detail; this is a candidate-consumer check, not fifteen native captures.
 const conflicting=detail.replaceAll('Associate','Other Job').replaceAll('Rupeek','Other Corporation')
 const jobs=await source.run({fetchImpl:async url=>response(url===source.OFFICIAL_CAREERS_URL?fixture.packets[0]:{...fixture.packets[1],requestedUrl:url},url===source.OFFICIAL_CAREERS_URL?corporate:conflicting)})
 assert.equal(jobs.length,15);assert.ok(jobs.some(j=>j.title==='Talent Acquisition Intern'))
 let calls=0;const unexpected=async()=>{calls++;throw Error('unexpected generic request')}
 const normalized=jobs.map(j=>normalizeScrapedJob(j,{source:'rupeek',companyName:'Rupeek',countryFilter:'India'}))
 const enriched=await enrichJobsWithPublicExperience(normalized,{fetchText:unexpected,fetchJson:unexpected,fetchBrowserText:unexpected})
 for(let i=0;i<15;i++){
  for(const rows of[jobs,normalized,enriched]){
   assert.equal(rows[i].jobId,jobs[i].jobId);assert.equal(rows[i].country,'India')
   assert.equal(rows[i].experienceRequired,null);assert.equal(rows[i].jobDescription,null)
   assert.equal(rows[i].requisitionId,null);assert.equal(rows[i].publicExperienceChecked,false)
   assert.equal(rows[i].skipPublicExperienceEnrichment,true)
  }
 }
 assert.equal(calls,0);assert.equal(jobs.sourceAudit.observedCorporateRoleCards,15);assert.equal(jobs.sourceAudit.ownCriteriaQualified,0)
 assert.equal(jobs.sourceAudit.nativeVacancyTotal,null);assert.equal(jobs.sourceAudit.sourceScopeComplete,false)
})
for(const [label,from,to] of [
 ['title','Associate</h1>','Other Job</h1>'],
 ['ID','urn:li:jobPosting:4486374940','urn:li:jobPosting:9000000001'],
 ['publisher','https://in.linkedin.com/company/rupeek?','https://in.linkedin.com/company/other?'],
 ['location','Bengaluru, Karnataka, India','Toronto, Canada'],
 ['canonical','https://in.linkedin.com/jobs/view/associate-at-rupeek-4486374940','https://in.linkedin.com/jobs/view/associate-at-rupeek-9000000001'],
])test('genuine own detail rejects controlled '+label+' mismatch',()=>{
 const changed=detail.replaceAll(from,to);assert.notEqual(changed,detail)
 assert.throws(()=>readRole(changed,genuineRow))
})
