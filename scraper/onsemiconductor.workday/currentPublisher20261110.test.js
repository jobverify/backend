import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {validateCorporate,roleHold,CAREERS,HISTORY,NATIVE_SITE} from './currentPublisher20261110.js'
import {extractionFailureDetails} from '../../scripts/catalogExtractionFailureEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261110.json.gz',import.meta.url))))
const replay=()=>{const packets=fixture.packets.filter(p=>p.capture==='registered-current'),used=new Set(),order=[];const read=async url=>{
 const index=packets.findIndex((p,i)=>p.requestedURL===String(url)&&!used.has(i)),p=packets[index]
 if(!p)throw Error('Uncaptured current URL '+url)
 used.add(index);order.push(index)
 const response=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers})
 Object.defineProperty(response,'url',{value:p.finalURL});return response
};read.assertConsumed=()=>{assert.equal(used.size,packets.length);assert.deepEqual(order,packets.map((_,i)=>i))};return read}
test('current official onsemi registration returns only explicitly native India roles with full criteria and legal employer unknown',async()=>{
 const transport=replay(),jobs=await run({fetchImpl:transport,maxDetails:80,maxRequests:128,maxPages:4,sourceTimeoutMs:180000})
 transport.assertConsumed()
 assert.equal(jobs.length,35)
 assert.ok(jobs.every(j=>j.country==='India'&&j.nativeLegalEmployer===null&&j.nativeHiringOrganization===null&&j.sourceDetailComplete===true&&j.lifecycleCleanupAllowed===false&&j.sourceScopeComplete===false))
 assert.ok(jobs.every(j=>j.sourceOfficialBinding.currentHandoffRechecked===true&&j.jobDescription.includes(j.nativeSourceRecord.detail.ExternalDescriptionStr)))
 assert.equal(jobs[Symbol.for('jobverify.verified-recruitment-observations')].nativeRecords,36)
})
const textAt=(url,capture)=>Buffer.from(fixture.packets.find(p=>p.requestedURL===url&&(!capture||p.capture===capture)&&p.status===200).bodyBase64,'base64').toString('utf8')
const original={detail:JSON.parse(textAt('https://hctz.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%222506716%22,siteNumber=CX_1001')).items[0],listing:JSON.parse(textAt('https://hctz.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1001,limit=20,offset=0,keyword=India')).items[0].requisitionList[1]}
for(const tag of ['template','blockquote','q','pre','code','div hidden','div aria-hidden="true"','div style="display:none"']){
 test('inactive/quoted careers cannot establish delegation: '+tag,()=>assert.throws(()=>validateCorporate('<'+tag+'>'+textAt(CAREERS)+'</'+tag.split(' ')[0]+'>',textAt(HISTORY))))
 test('inactive/quoted history cannot establish name binding: '+tag,()=>assert.throws(()=>validateCorporate(textAt(CAREERS),'<'+tag+'>'+textAt(HISTORY)+'</'+tag.split(' ')[0]+'>')))
}
test('rebrand evidence binds publisher brand while leaving legal employer unknown',()=>assert.equal(validateCorporate(textAt(CAREERS),textAt(HISTORY)).legalEmployer,null))
test('changed declared account is held',()=>assert.throws(()=>validateCorporate(textAt(CAREERS).replaceAll('CX_1001','CX_OTHER'),textAt(HISTORY))))
for(const [label,change] of [
 ['primary unknown',r=>r.detail.PrimaryLocationCountry='ZZ'],['listing unknown',r=>r.listing.PrimaryLocationCountry=null],
 ['foreign typed country',r=>r.detail.workLocation[0].Country='CA'],['unknown typed worksite',r=>r.detail.workLocation[0].Country='ZZ'],
 ['foreign primary written country',r=>r.detail.PrimaryLocation='Toronto (Canada)'],['foreign dash written country',r=>r.detail.PrimaryLocation='Algiers - Algeria'],
 ['explicit own-role foreign statement',r=>r.detail.ExternalDescriptionStr='<p>The position will be located in Toronto (Canada).</p>'+r.detail.ExternalDescriptionStr],
 ['explicit work-location label',r=>r.detail.ExternalDescriptionStr='<p>Work Location: Toronto (Canada).</p>'+r.detail.ExternalDescriptionStr],
 ['future-employer declaration',r=>r.detail.ExternalDescriptionStr='<p>Your employer will be Other Corporation.</p>'+r.detail.ExternalDescriptionStr],
 ['explicit other role assignment',r=>r.detail.ExternalDescriptionStr='<p>This role is for Other Corporation.</p>'+r.detail.ExternalDescriptionStr],
 ['malformed own qualifications',r=>r.detail.ExternalQualificationsStr=['opaque']],
 ['qualifications heading without own alternative',r=>r.detail.ExternalQualificationsStr='<h2>Qualifications</h2>'],
 ['unreviewed legal employer',r=>r.detail.LegalEmployer='Other Corporation'],['native title changed',r=>r.detail.Title+=' changed'],
 ['explicit different employer',r=>r.detail.ExternalDescriptionStr='<p>Employer: Other Corporation</p>'+r.detail.ExternalDescriptionStr],
 ['loose employer contradiction',r=>r.detail.ExternalDescriptionStr='Employer: Other Corporation\n'+r.detail.ExternalDescriptionStr],
 ['split own employer label',r=>r.detail.ExternalDescriptionStr='<dl><dt>Employer:</dt><dd>Other Corporation</dd></dl>'+r.detail.ExternalDescriptionStr],
 ['affirmative other employer',r=>r.detail.ExternalDescriptionStr='<p>You will be employed by Other Corporation.</p>'+r.detail.ExternalDescriptionStr],
 ['brand denial',r=>r.detail.ExternalDescriptionStr='<p>onsemi is not your employer.</p>'+r.detail.ExternalDescriptionStr],
 ['heading-only criteria',r=>{for(const f of ['ExternalDescriptionStr','ExternalResponsibilitiesStr','ExternalQualificationsStr'])r.detail[f]='<h2>Responsibilities and qualifications for experienced engineering applicants</h2>'.repeat(8)}],
 ['invalid own date',r=>r.detail.ExternalPostedStartDate='2026-02-30T04:10:39+00:00']
])test('own native qualification holds '+label,()=>{const r=structuredClone(original);change(r);assert.ok(roleHold(r))})
for(const tag of ['blockquote','template','q','pre','code','div hidden','div aria-hidden="true"'])test('quoted/inert negative prose is ignored: '+tag,()=>{const r=structuredClone(original);r.detail.ExternalDescriptionStr='<'+tag+'>Employer: Other Corporation. This role is based in Toronto, Canada.</'+tag.split(' ')[0]+'>'+r.detail.ExternalDescriptionStr;assert.equal(roleHold(r),null)})
test('global team mentions do not relocate the own role',()=>{const r=structuredClone(original);r.detail.ExternalDescriptionStr+='<p>Collaborate with global teams in Canada and Singapore.</p>';assert.equal(roleHold(r),null)})
test('source deadline includes synchronous transport work',async()=>assert.rejects(run({sourceTimeoutMs:1,fetchImpl:async(...args)=>{const end=performance.now()+5;while(performance.now()<end){/* synchronous transport simulation */}return replay()(...args)}}),{name:'TimeoutError'}))
test('caller cancellation preserves exact reason and prevents reads',async()=>{const c=new AbortController(),reason=Error('caller cancelled');c.abort(reason);let reads=0;await assert.rejects(run({signal:c.signal,fetchImpl:()=>{reads++;throw Error('not reached')}}),e=>e===reason);assert.equal(reads,0)})
const mutatedReplay=mutate=>{const base=replay(),counts=new Map();return async(url,init)=>{const r=await base(url,init),count=(counts.get(url)||0)+1;counts.set(url,count);const body=await r.text(),changed=mutate({url:String(url),count,body,headers:Object.fromEntries(r.headers),status:r.status});const out=new Response(changed?.body??body,{status:changed?.status??r.status,headers:changed?.headers??r.headers});Object.defineProperty(out,'url',{value:changed?.url??r.url});return out}}
test('own contradiction holds one role and retains all36 observations',async()=>{
 const jobs=await run({fetchImpl:mutatedReplay(({url,body})=>{if(url.includes('Id=%222506716%22')){const p=JSON.parse(body);p.items[0].PrimaryLocation='Toronto (Canada)';return {body:JSON.stringify(p)}}})})
 assert.equal(jobs.length,34);const o=jobs[Symbol.for('jobverify.verified-recruitment-observations')];assert.equal(o.nativeRecords,36);assert.equal(o.onsemiHeldRoles[0].id,'2506716');assert.equal(o.returnedIndiaJobs,34)
})
test('all own India criteria failures throw retaining original native observations',async()=>{
 await assert.rejects(run({fetchImpl:mutatedReplay(({url,body})=>{if(url.includes('RequisitionDetails?')){const p=JSON.parse(body);p.items[0].PrimaryLocation='Toronto (Canada)';return {body:JSON.stringify(p)}}})}),e=>e.recruitmentObservations?.nativeRecords===36&&e.recruitmentObservations.onsemiHeldRoles.length===35)
})
test('closing corporate delegation change fails closed',async()=>assert.rejects(run({fetchImpl:mutatedReplay(({url,count,body})=>url===CAREERS&&count===2?{body:body.replaceAll('CX_1001','CX_OTHER')}:null)})))
test('closing native inventory change fails closed',async()=>assert.rejects(run({fetchImpl:mutatedReplay(({url,count,body})=>{if(url.includes('findReqs;')&&count===2){const p=JSON.parse(body);p.items[0].requisitionList[0].Title+=' changed';return {body:JSON.stringify(p)}}})})))
test('closing own criteria change fails closed',async()=>assert.rejects(run({fetchImpl:mutatedReplay(({url,count,body})=>{if(url.includes('Id=%222506716%22')&&count===2){const p=JSON.parse(body);p.items[0].ExternalQualificationsStr+='<p>Changed criteria.</p>';return {body:JSON.stringify(p)}}})})))
for(const [name,change]of [['MIME',{headers:{'content-type':'text/plain'}}],['final URL',{url:'https://foreign.example/'}],['HTTP status',{status:500}]])test('native transport '+name+' fails closed',async()=>assert.rejects(run({fetchImpl:mutatedReplay(({url})=>url===NATIVE_SITE?change:null)})))
test('native403 stops that origin without retry or alternate endpoint',async()=>{
 let denied=false,afterDenial=0
 await assert.rejects(run({fetchImpl:mutatedReplay(({url})=>{if(new URL(url).origin===new URL(NATIVE_SITE).origin){if(denied)afterDenial++;if(url.includes('RequisitionDetails?')){denied=true;return {status:403,body:'Forbidden'}}}})}))
 assert.equal(denied,true);assert.equal(afterDenial,0)
})
test('metadata-free legacy transports cannot claim current first-party proof',async()=>assert.rejects(run({fetchPage:async()=>({html:textAt(CAREERS),url:CAREERS})})))
test('closing request work remains inside the caller source request budget',async()=>assert.rejects(run({maxRequests:50,fetchImpl:replay()}),e=>/request budget/.test(e.message)&&e.recruitmentObservations?.nativeRecords===36))
test('caller abort ends a transport that ignores its signal',async()=>{const c=new AbortController(),reason=Error('stop native read');const pending=run({signal:c.signal,fetchImpl:()=>new Promise(()=>{})});setTimeout(()=>c.abort(reason),5);await assert.rejects(pending,e=>e===reason)})
test('native public publisher inside a quote is not positive proof',async()=>assert.rejects(run({fetchImpl:mutatedReplay(({url,body})=>url===NATIVE_SITE?{body:'<blockquote>'+body+'</blockquote>'}:null)})))
test('own empty detail is held rather than being replaced with corporate boilerplate',()=>{const r=structuredClone(original);for(const f of ['ExternalDescriptionStr','ExternalResponsibilitiesStr','ExternalQualificationsStr'])r.detail[f]='';assert.equal(roleHold(r),'native-full-criteria-unavailable')})
test('response byte budget is bounded before any role can qualify',async()=>assert.rejects(run({fetchImpl:async url=>{const r=new Response('x'.repeat(4000001),{headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:String(url)});return r}})))
for(const field of ['ExternalDescriptionStr','ExternalResponsibilitiesStr','ExternalQualificationsStr','CorporateDescriptionStr','OrganizationDescriptionStr']){
 test('all public fields reject malformed present values: '+field,()=>{const r=structuredClone(original);r.detail[field]=['opaque'];assert.ok(roleHold(r))})
 test('all public fields hold explicit own-worksite conflict: '+field,()=>{const r=structuredClone(original);r.detail[field]='<p>Work Location: Toronto (Canada).</p>'+(r.detail[field]||'');assert.ok(roleHold(r))})
 test('all public fields hold explicit own-employer conflict: '+field,()=>{const r=structuredClone(original);r.detail[field]='<p>Your employer will be Other Corporation.</p>'+(r.detail[field]||'');assert.ok(roleHold(r))})
}
test('blank/heading-only duplicate responsibilities can use the genuine complete own description duties',()=>{for(const replacement of ['', '<h2>Responsibilities</h2>']){const r=structuredClone(original);r.detail.ExternalResponsibilitiesStr=replacement;assert.equal(roleHold(r),null)}})
test('blank qualifications without substantive own combined qualifications remain held',()=>{const r=structuredClone(original);r.detail.ExternalQualificationsStr='';assert.equal(roleHold(r),'native-full-criteria-unavailable')})
for(const id of ['2506717','2506113','2506108','2506109','2506110'])test('genuine current optional-section composition qualifies without ID exceptions: '+id,()=>{
 const p=fixture.packets.find(p=>p.requestedURL.includes('Id=%22'+id+'%22')),detail=JSON.parse(Buffer.from(p.bodyBase64,'base64')).items[0]
 const lists=fixture.packets.filter(p=>p.requestedURL.includes('findReqs;')&&p.capture==='registered-current').flatMap(p=>JSON.parse(Buffer.from(p.bodyBase64,'base64')).items[0].requisitionList),listing=lists.find(r=>r.Id===id)
 assert.equal(detail.ExternalResponsibilitiesStr,'');assert.equal(roleHold({detail,listing}),null)
})
for(const tag of ['p','div','td','th','dt','dd','h2','address','aside','main'])test('active employer/location labels preserve block boundaries: '+tag,()=>{
 const r=structuredClone(original);r.detail.ExternalDescriptionStr='<'+tag+'>Work Location:</'+tag+'><'+tag+'>Toronto (Canada)</'+tag+'>'+r.detail.ExternalDescriptionStr;assert.equal(roleHold(r),'native-criteria-country-conflict')
 const s=structuredClone(original);s.detail.OrganizationDescriptionStr='<'+tag+'>Employer:</'+tag+'><'+tag+'>Other Corporation</'+tag+'>';assert.equal(roleHold(s),'native-employer-contradiction')
})
for(const country of ['US','CA','ZZ','United States','USA'])test('explicit own Country label does not inherit India: '+country,()=>{const r=structuredClone(original);r.detail.ExternalDescriptionStr='<p>Country: '+country+'</p>'+r.detail.ExternalDescriptionStr;assert.ok(roleHold(r))})
test('split explicit Country code has typed country semantics',()=>{const r=structuredClone(original);r.detail.OrganizationDescriptionStr='<dl><dt>Country code:</dt><dd>CA</dd></dl>';assert.ok(roleHold(r))})
for(const country of ['IN','India'])test('consistent explicit own Country label remains allowed: '+country,()=>{const r=structuredClone(original);r.detail.ExternalDescriptionStr='<p>Country: '+country+'</p>'+r.detail.ExternalDescriptionStr;assert.equal(roleHold(r),null)})
test('heading prose cannot supply a missing alternate combined qualification section',()=>{const r=structuredClone(original);r.detail.ExternalQualificationsStr='';r.detail.ExternalDescriptionStr+='<h2>Qualifications</h2><h3>Experienced engineering applicants should possess detailed technical knowledge of semiconductor design verification planning and collaborate effectively across multidisciplinary teams while maintaining accurate technical documentation and communicating project requirements clearly.</h3>';assert.equal(roleHold(r),'native-full-criteria-unavailable')})
test('actual public403 remains blocked in the standard failure diagnostics with bounded original bytes',async()=>{
 let reads=0
 await assert.rejects(run({fetchImpl:async()=>{reads++;return new Response('Forbidden',{status:403,headers:{'content-type':'text/html'}})}}),error=>{
  assert.equal(error.status,403);assert.equal(extractionFailureDetails(error).failureKind,'blocked_or_access_denied')
  assert.equal(error.nativeEvidence.retainedResponses.length,1);assert.equal(error.nativeEvidence.transportPackets[0].status,403)
  assert.equal(Buffer.from(error.nativeEvidence.retainedResponses[0].rawBodyBase64,'base64').toString(),'Forbidden');return true
 });assert.equal(reads,1)
})
test('native403 after positive corporate reads outranks a semantic scope-gap wrapper',async()=>assert.rejects(run({fetchImpl:mutatedReplay(({url})=>url===NATIVE_SITE?{status:403,body:'Forbidden'}:null)}),error=>error.status===403&&error.cause.status===403&&extractionFailureDetails(error).failureKind==='blocked_or_access_denied'))
test('direct closing-detail403 forbids outer retries and retains current native observations',async()=>assert.rejects(run({fetchImpl:mutatedReplay(({url,count})=>url.includes('Id=%222506716%22')&&count===2?{status:403,body:'Forbidden'}:null)}),error=>error.status===403&&error.abortRetries===true&&error.recruitmentObservations.nativeRecords===36&&extractionFailureDetails(error).failureKind==='blocked_or_access_denied'))
