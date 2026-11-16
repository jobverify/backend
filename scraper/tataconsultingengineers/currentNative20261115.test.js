import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run as registeredRun} from './script.js'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const body=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8'),sha=b=>createHash('sha256').update(b).digest('hex'),target=fixture.passes[0].roles[0].url
export async function replayCurrentTce(change,options={}){
 const counts=new Map(),calls=[],mutations=[]
 try{
  const {actualCatalog=false,...runOptions}=options,provider=actualCatalog?createCatalogScraper(getScraperCatalog().find(p=>p.source==='tataconsultingengineers')):null,invoke=provider?provider.run.bind(provider):registeredRun
  const jobs=await invoke({maxJobs:null,requestIntervalMs:0,now:()=>fixture.capturedAt,...runOptions,
   fetchText:async url=>{const p=fixture.originalProgramRed.packets.find(p=>p.requestedUrl===url);assert.ok(p,'Original current RED packet missing');return body(p)},
   fetchImpl:async(value,init)=>{
    const url=String(value),index=counts.get(url)??0;counts.set(url,index+1)
    const original=fixture.packets.filter(p=>p.requestedURL===url)[index]
    assert.ok(original,'Missing genuine current native packet '+url+' #'+index)
    assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.equal(init.cache,'no-store')
    assert.deepEqual(init.headers,original.request.headers)
    assert.ok(!Object.keys(init.headers).some(k=>/^(?:cookie|authorization|proxy-authorization)$/i.test(k)))
    const packet={...structuredClone(original),body:body(original)},before=JSON.stringify(packet)
    change?.(packet,url,index);if(JSON.stringify(packet)!==before)mutations.push({url,index})
    calls.push({url,index,method:init.method,headers:init.headers})
    const response=new Response(Buffer.from(packet.body,'utf8'),{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
   }})
  return{jobs,calls,mutations}
 }catch(error){return{jobs:[],calls,mutations,error}}
}

test('registered TCE retains two complete own typed India roles and every original native criterion',async()=>{
 const r=await replayCurrentTce();assert.ifError(r.error);assert.equal(r.jobs.length,2);assert.equal(r.calls.length,10)
 for(const job of r.jobs){
  const expected=fixture.passes[0].roles.find(role=>role.url===job.sourceUrl)
  assert.ok(expected);assert.equal(job.company,'Tata Consulting Engineers Limited');assert.equal(job.country,'India');assert.equal(job.nativeLegalEmployer,null);assert.equal(job.nativeEmployerLabel,'tatacons02')
  assert.equal(job.sourceNativeFullCriteria,expected.description.text);assert.ok(job.jobDescription.includes(expected.description.text));assert.ok(job.jobDescription.includes('comprehensive compensation and benefits packages'))
  assert.ok(expected.description.characters>5100);assert.equal(job.jobId,expected.routeID);assert.equal(job.requisitionId,null)
  assert.equal(job.applyUrl,'https://careers.tataconsultingengineers.com/talentcommunity/apply/'+expected.routeID+'/?locale=en_GB')
  assert.equal(job.sourceNativeCountryProof.countryCode,'IN');assert.equal(job.sourceNativeCountryProof.countryInferredFromCity,false)
  assert.equal(job.postingDate,'2026-11-15T02:00:00.000Z');assert.equal(job.closingDate,null)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceRenderedApplicationQualified,false)
 }
 const e=r.jobs.nativeCollectionEvidence
 assert.equal(e.recordKind,'mixed');assert.equal(e.observedRecordCount,25);assert.equal(e.observedVacancyCount,2);assert.equal(e.nativeRows.length,25);assert.equal(e.closingNativeRows.length,25)
 assert.equal(e.openingModels.length,2);assert.equal(e.closingModels.length,2);assert.equal(e.originalResponses.length,10);assert.equal(e.holds.length,23)
 assert.equal(e.verifiedZero,false);assert.equal(e.sourceScopeComplete,false);assert.equal(e.metadataAuthorityOnly,true);assert.equal(e.externalProgramsExecuted,false)
})

test('actual catalog retains mixed25/2 audit and maxJobs does not change observed native counts',async()=>{
 const r=await replayCurrentTce(null,{actualCatalog:true,maxJobs:1});assert.ifError(r.error);assert.equal(r.jobs.length,1);assert.equal(r.calls.length,10)
 assert.deepEqual(readSourceObservationEvidence(r.jobs,'tataconsultingengineers'),{source:'tataconsultingengineers',recordKind:'mixed',observedRecordCount:25,observedVacancyCount:2,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 assert.equal(r.jobs.nativeCollectionEvidence.nativeRows.length,25);assert.equal(r.jobs.nativeCollectionEvidence.originalResponses.length,10)
})

const criterion='An additional current minimum requirement: a PhD in cryptography.'
const addCriterion=p=>{p.body=p.body.replace('<span itemprop="description" class="jobdescription">','<span itemprop="description" class="jobdescription"><p>'+criterion+'</p>')}
test('consistent additional ordinary mandatory criterion is fully retained from both native reads',async()=>{
 const r=await replayCurrentTce((p,url)=>{if(url===target)addCriterion(p)})
 assert.ifError(r.error);assert.equal(r.mutations.length,2);assert.equal(r.jobs.length,2)
 const job=r.jobs.find(j=>j.sourceUrl===target)
 for(const value of[job.jobDescription,job.sourceNativeFullCriteria,job.sourceNativeRecord.criteria,job.sourceNativeClosingRecord.criteria])assert.ok(value.includes(criterion))
})
for(const changedPass of[0,1])test('one-pass full criteria change rejects all output after independent closing '+changedPass,async()=>{
 const r=await replayCurrentTce((p,url,index)=>{if(url===target&&index===changedPass)addCriterion(p)})
 assert.equal(r.mutations.length,1);assert.equal(r.jobs.length,0);assert.ok(r.error);assert.equal(r.calls.length,10)
})

for(const [name,mutate]of[
 ['foreign typed country',p=>{p.body=p.body.replace('itemprop="addressCountry" content="IN"','itemprop="addressCountry" content="US"')}],
 ['duplicate typed country',p=>{p.body=p.body.replace(/<meta itemprop="addressCountry" content="IN"\s*\/?>/,original=>original+original.replace('"IN"','"US"'))}],
 ['unknown employer account',p=>{p.body=p.body.replace('itemprop="hiringOrganization" content="tatacons02"','itemprop="hiringOrganization" content="another-account"')}],
 ['new typed qualification outside full JD',p=>{p.body=p.body.replace('</body>','<section itemprop="qualifications">'+criterion+'</section></body>')}],
 ['hidden qualification outside full JD',p=>{p.body=p.body.replace('</body>','<section hidden itemprop="qualifications">'+criterion+'</section></body>')}],
 ['altered application ID',p=>{p.body=p.body.replace('/talentcommunity/apply/59886244/?locale=en_GB','/talentcommunity/apply/99999999/?locale=en_GB')}],
 ['disabled native application',p=>{p.body=p.body.replace('class="btn btn-primary btn-large btn-lg apply dialogApplyBtn ', 'aria-disabled="true" class="btn btn-primary btn-large btn-lg apply dialogApplyBtn ')}],
 ['unknown inline program',p=>{p.body=p.body.replace('</body>','<script>window.currentRoleOpen=false</script></body>')}],
 ['unknown CSS hiding criteria',p=>{p.body=p.body.replace('</head>','<style>.jobdescription{display:none!important}</style></head>')}],
 ['hidden inside description',p=>{p.body=p.body.replace('<span itemprop="description" class="jobdescription">','<span itemprop="description" class="jobdescription" hidden>')}],
 ['extra authority nonce carrier',p=>{const m=p.body.match(/"X-CSRF-Token"\s*:\s*"([a-f\d-]+)"/);assert.ok(m);p.body=p.body.replace('</body>','<div data-extra="'+m[1]+'"></div></body>')}],
])for(const changedPass of[0,1])test('rejects '+name+' on native pass'+changedPass,async()=>{
 const r=await replayCurrentTce((p,url,index)=>{if(url===target&&index===changedPass)mutate(p)})
 assert.ok(r.mutations.length,'control must change genuine current packet');assert.equal(r.jobs.length,0);assert.ok(r.error)
})

for(const sentence of[
 'This position is currently unavailable.','This job is not available.','This position is filled.','Applications are now closed.',
 'The work location for this vacancy is United States.','Your employer will be Another Employer Incorporated.',
 'This role is based in United States.','Your employer will be Another Employer Limited.','Applications close on 1 November 2026.',
 'The closing date for this role is 1 November 2026.','The application deadline is 1 November 2026.',
 'See the full job description at https://example.invalid/mandatory-criteria.docx',
])test('new native description authority/availability declaration holds: '+sentence,async()=>{
 const r=await replayCurrentTce((p,url)=>{if(url===target)p.body=p.body.replace('<span itemprop="description" class="jobdescription">','<span itemprop="description" class="jobdescription"><p>'+sentence+'</p>')})
 assert.ok(r.mutations.length);assert.equal(r.jobs.length,0);assert.ok(r.error)
})

for(const sentence of[
 'Applications must be received by 1 November 2026.',
 'Applications will be accepted until 1 November 2026.',
 'All applications must reach us by 1 November 2026.',
 'Your application must arrive no later than 1 November 2026.',
 'For this position, applications will be considered through 1 November 2026.',
 'We accept applications through 1 November 2026.',
 'Apply by 1 November 2026.',
 'Apply on or before 1 November 2026.',
 'Apply before 1 November 2026.',
 'Please apply no later than 1 November 2026.',
])test('complete authored application paragraph needs review even when both reads agree: '+sentence,async()=>{
 const r=await replayCurrentTce((p,url)=>{if(url===target)p.body=p.body.replace('<span itemprop="description" class="jobdescription">','<span itemprop="description" class="jobdescription"><p>'+sentence+'</p>')})
 assert.ok(r.mutations.length>0,'The same new paragraph is supplied on either independent read; an opening hold may stop closing reads')
 assert.equal(r.jobs.length,0);assert.equal(r.error?.failureKind,'coverage_gap')
})

test('a complete ordinary qualification mentioning applying remains fully retained',async()=>{
 const sentence='You must hold a current cloud security certification before applying.'
 const r=await replayCurrentTce((p,url)=>{if(url===target)p.body=p.body.replace('<span itemprop="description" class="jobdescription">','<span itemprop="description" class="jobdescription"><p>'+sentence+'</p>')})
 assert.ifError(r.error);assert.equal(r.mutations.length,2);assert.equal(r.jobs.length,2)
 const job=r.jobs.find(j=>j.sourceUrl===target)
 for(const text of[job.jobDescription,job.sourceNativeFullCriteria,job.sourceNativeRecord.criteria,job.sourceNativeClosingRecord.criteria])assert.ok(text.includes(sentence))
})

for(const sentence of[
 'The hiring entity for this position is Acme Corporation.',
 'You will be working for Acme Corporation.',
 'The successful candidate will work for Acme Corporation.',
 'Your employing company will be Acme Corporation.',
 'The employing entity is Acme Corporation.',
 'Your duty station is New York, United States.',
 'This position is assigned to New York, United States.',
 'You will be stationed in New York, United States.',
 'Submit your CV by 1 November 2026.',
 'Please send your CV no later than 1 November 2026.',
 'Resumes must be received by 1 November 2026.',
 'Submit your resume before 1 November 2026.',
 'Please send your résumé by 1 November 2026.',
 'All curricula vitae should reach us by 1 November 2026.',
])test('new complete hiring workplace or submission topic requires review: '+sentence,async()=>{
 const r=await replayCurrentTce((p,url)=>{if(url===target)p.body=p.body.replace('<span itemprop="description" class="jobdescription">','<span itemprop="description" class="jobdescription"><p>'+sentence+'</p>')})
 assert.ok(r.mutations.length>0);assert.equal(r.jobs.length,0);assert.equal(r.error?.failureKind,'coverage_gap')
})

test('only the numeric passive override cache query may refresh independently',async()=>{
 const r=await replayCurrentTce((p,url,index)=>{if(new URL(url).hostname==='careers.tataconsultingengineers.com')p.body=p.body.replace(/(\/js\/override\.js\?locale=(?:en_US|en_GB)&amp;i=)\d{1,10}/,(_,prefix)=>prefix+String(123456+index))})
 assert.ifError(r.error);assert.equal(r.jobs.length,2);assert.equal(r.mutations.length,6)
})
test('generated passive alert IDs may refresh only with their own exact matching label',async()=>{
 const r=await replayCurrentTce((p,url,index)=>{if(url===target){const ids=[...p.body.matchAll(/<input id="(j_idt\d+)" type="number"/g)].map(m=>m[1]);assert.equal(ids.length,2);for(const [i,id]of ids.entries())p.body=p.body.replaceAll(id,'j_idt'+String(90000+index*10+i))}})
 assert.ifError(r.error);assert.equal(r.jobs.length,2);assert.equal(r.mutations.length,2)
})
for(const [name,change]of[
 ['duplicate passive input ID',p=>{const ids=[...p.body.matchAll(/<input id="(j_idt\d+)" type="number"/g)].map(m=>m[1]);assert.equal(ids.length,2);p.body=p.body.replaceAll(ids[1],ids[0])}],
 ['crossed passive label binding',p=>{const ids=[...p.body.matchAll(/<input id="(j_idt\d+)" type="number"/g)].map(m=>m[1]);assert.equal(ids.length,2);p.body=p.body.replace('for="'+ids[0]+'"','for="'+ids[1]+'"')}],
 ['changed passive control value',p=>{p.body=p.body.replace('name="frequency" required="required"','name="frequency" value="99" required="required"')}],
])test('unreviewed passive control mutation holds '+name,async()=>{
 const r=await replayCurrentTce((p,url)=>{if(url===target)change(p)})
 assert.ok(r.mutations.length);assert.equal(r.jobs.length,0);assert.ok(r.error)
})
for(const replacement of['/js/different.js?locale=en_GB&amp;i=12345','/js/override.js?locale=fr_FR&amp;i=12345','/js/override.js?locale=en_GB&amp;i=12345&amp;new=1'])test('unreviewed passive script URL change holds '+replacement,async()=>{
 const r=await replayCurrentTce((p,url)=>{if(url===target)p.body=p.body.replace(/\/js\/override\.js\?locale=en_GB&amp;i=\d{1,10}/,replacement)})
 assert.ok(r.mutations.length);assert.equal(r.jobs.length,0);assert.ok(r.error)
})
test('unreviewed non-vacancy card metadata cannot be silently counted as a confirmed vacancy',async()=>{
 const r=await replayCurrentTce((p,url)=>{if(url==='https://careers.tataconsultingengineers.com/search')p.body=p.body.replace('job-tile job-id-59882444','job-tile role-area-card job-id-59882444')})
 assert.ok(r.mutations.length);assert.equal(r.jobs.length,0);assert.ok(r.error)
})
test('critical role response CSP/header drift fails closed',async()=>{
 const r=await replayCurrentTce((p,url)=>{if(url===target)p.headers['content-security-policy']="default-src 'none'"})
 assert.ok(r.mutations.length);assert.equal(r.jobs.length,0);assert.ok(r.error)
})
test('corporate account handoff removal holds',async()=>{
 const r=await replayCurrentTce((p,url)=>{if(url==='https://www.tataconsultingengineers.com/careers/')p.body=p.body.replace('https://careers.tataconsultingengineers.com/search','https://another.example/jobs')})
 assert.ok(r.mutations.length);assert.equal(r.jobs.length,0);assert.ok(r.error)
})
test('own role expiration is respected using the fresh closing clock, without asserting a deadline',async()=>{
 let times=0
 const r=await replayCurrentTce(null,{now:()=>times++===0?fixture.capturedAt:'2026-12-01T00:00:00.000Z'})
 assert.ifError(r.error);assert.equal(r.jobs.length,1);assert.equal(r.jobs[0].jobId,'58087244');assert.equal(r.jobs[0].closingDate,null)
 assert.equal(r.jobs.nativeCollectionEvidence.observedVacancyCount,2);assert.ok(r.jobs.nativeCollectionEvidence.holds.some(h=>h.routeID==='59886244'&&/expired/.test(h.reason)))
})
test('all expired native models remain a coverage gap and cannot prove empty inventory',async()=>{
 const r=await replayCurrentTce(null,{now:()=>'2027-01-01T00:00:00.000Z'})
 assert.equal(r.jobs.length,0);assert.equal(r.calls.length,10);assert.equal(r.error?.failureKind,'coverage_gap')
})
test('future native publication cannot be admitted before its typed UTC instant',async()=>{
 const r=await replayCurrentTce(null,{now:()=>'2026-11-15T01:59:59.000Z'})
 assert.equal(r.jobs.length,0);assert.ok(r.error)
})

for(const reason of[Object.freeze(new Error('frozen caller stop')),'opaque caller stop'])test('pre-aborted caller reason remains exact '+String(reason),async()=>{
 const controller=new AbortController();controller.abort(reason)
 const r=await replayCurrentTce(null,{signal:controller.signal});assert.equal(r.error,reason);assert.equal(r.calls.length,0)
})
test('in-flight caller abort preserves exact frozen reason and disposes late public response',async()=>{
 const reason=Object.freeze(new Error('in-flight frozen caller stop')),controller=new AbortController();let canceled=0
 const promise=registeredRun({signal:controller.signal,requestIntervalMs:0,fetchImpl:async()=>{setTimeout(()=>controller.abort(reason),2);await new Promise(resolve=>setTimeout(resolve,12));return{status:200,url:'https://www.tataconsultingengineers.com/careers',headers:new Headers(),body:{cancel(){canceled++}}}}})
 await assert.rejects(promise,error=>error===reason);await new Promise(resolve=>setTimeout(resolve,25));assert.equal(canceled,1)
})
for(const reason of[Object.freeze(new Error('active stream caller stop')),'opaque active stream stop'])test('active native stream abort preserves exact reason and one disposal '+String(reason),async()=>{
 const controller=new AbortController();let canceled=0,released=0
 const result=registeredRun({
  signal:controller.signal,requestIntervalMs:0,
  fetchImpl:async()=>({
   status:301,url:'https://www.tataconsultingengineers.com/careers',headers:new Headers({location:'https://www.tataconsultingengineers.com/careers/'}),
   body:{getReader(){return{
    read(){setTimeout(()=>controller.abort(reason),2);return new Promise(()=>{})},
    cancel(){canceled++},releaseLock(){released++},
   }}},
  }),
 })
 await assert.rejects(result,error=>error===reason);assert.equal(canceled,1);assert.equal(released,1)
})
test('uncooperative public fetch settles within source deadline',async()=>{
 const start=performance.now();await assert.rejects(registeredRun({sourceDeadlineMs:8,requestIntervalMs:0,fetchImpl:()=>new Promise(()=>{})}));assert.ok(performance.now()-start<1000)
})
test('intrinsic oversized stream is rejected with one cancel and release before buffering',async()=>{
 let canceled=0,released=0
 const huge=new Uint8Array(4000001);Object.defineProperty(huge,'byteLength',{value:0})
 await assert.rejects(registeredRun({requestIntervalMs:0,fetchImpl:async()=>({status:200,url:'https://www.tataconsultingengineers.com/careers',headers:new Headers(),body:{getReader(){return{read:async()=>({done:false,value:huge}),cancel(){canceled++},releaseLock(){released++}}}}})}))
 assert.equal(canceled,1);assert.equal(released,1)
})
test('genuine fixture byte hashes and original program RED remain preserved',()=>{
 for(const p of fixture.packets){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(sha(b),p.sha256);assert.equal(b.length,p.bytes)}
 assert.equal(fixture.originalProgramRed.pipelineRecovered,false);assert.equal(fixture.originalProgramRed.codeUnchangedDuringCapture,true)
})
