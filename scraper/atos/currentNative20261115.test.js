import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run as registeredRun} from './script.js'
import {currentAtosDocument,currentAtosHeaders,currentAtosUTC} from './currentNative20261115.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const body=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8')
const sha=s=>createHash('sha256').update(s).digest('hex')
async function replay(change,options={}){
 const counts=new Map(),calls=[],mutations=[]
 try{
  const {actualCatalog=false,...runOptions}=options
  const scraper=actualCatalog?createCatalogScraper(getScraperCatalog().find(p=>p.source==='atos')):null,invoke=scraper?scraper.run.bind(scraper):registeredRun
  const jobs=await invoke({maxJobs:null,requestIntervalMs:0,now:()=>fixture.capturedAt,...runOptions,
   fetchText:async url=>{throw Error('Original current HTTP 404 for '+url)},
   fetchImpl:async(value,init)=>{
    const url=String(value),index=counts.get(url)||0;counts.set(url,index+1)
    const original=fixture.packets.filter(p=>p.requestedURL===url)[index]
    assert.ok(original,'Missing genuine current native response '+url+' #'+index)
    assert.equal(init.method,original.request.method);assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.equal(init.cache,'no-store')
    if(init.method==='POST'){assert.equal(init.body,original.request.body);assert.equal(init.headers['Content-Type'],'application/json');assert.equal(init.headers['X-CSRF-Token'],original.request.headers['X-CSRF-Token'])}
    assert.ok(Object.keys(init.headers).every(k=>! /^(cookie|authorization|proxy-authorization)$/i.test(k)))
    const p={...structuredClone(original),body:body(original)},before=JSON.stringify(p)
    change?.(p,url,index);if(JSON.stringify(p)!==before)mutations.push({url,index})
    calls.push({url,method:init.method,body:init.body,headers:init.headers})
    const response=new Response(Buffer.from(p.body,'utf8'),{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response
   }})
  return{jobs,calls,mutations}
 }catch(error){return{jobs:[],calls,mutations,error}}
}
export {replay as replayCurrentAtos}

test('registered original Atos source follows current corporate publication and preserves full native India criteria',async()=>{
 const r=await replay();assert.ifError(r.error);assert.equal(r.jobs.length,25);assert.equal(r.calls.length,68)
 assert.equal(r.calls.filter(c=>c.method==='POST').length,2)
 for(const job of r.jobs){
  const native=fixture.passes[0].roles.find(role=>role.url===job.sourceUrl)
  assert.ok(native);assert.equal(job.company,'Atos');assert.equal(job.country,'India');assert.equal(job.nativeLegalEmployer,null);assert.equal(job.nativeEmployerLabel,'Atos')
  assert.equal(job.sourceNativeFullCriteria,native.description[0].text);assert.equal(sha(job.sourceNativeFullCriteria),native.description[0].sha256)
  assert.ok(job.jobDescription.includes(job.sourceNativeFullCriteria));assert.ok(job.sourceNativeFullCriteria.length>=987)
  assert.match(job.jobId,/^\d{6}$/);assert.equal(job.jobId,job.sourceNativeRecord.referenceNo);assert.equal(job.requisitionId,job.jobId)
  assert.equal(job.applyUrl,'https://jobs.atos.net/talentcommunity/apply/'+job.sourceNativeIdentity.routeID+'/?locale=en_US')
  assert.equal(job.sourceNativeCountryProof.nativeCountryCode,'IN');assert.equal(job.sourceNativeCountryProof.nativeCountryTranslation,'India')
  assert.equal(job.closingDate,null);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceRenderedApplicationQualified,false)
 }
 const e=r.jobs.nativeCollectionEvidence
 assert.equal(e.nativeRows.length,27);assert.equal(e.closingNativeRows.length,27)
 assert.equal(e.originalResponses.length,68);assert.equal(e.holds.length,2)
 assert.ok(e.holds.some(h=>h.routeID==='1450028633'&&/filled/.test(h.reason)))
 assert.ok(e.holds.some(h=>h.routeID==='1456395733'&&/unconfirmed/.test(h.reason)))
 assert.equal(e.verifiedZero,false);assert.equal(e.metadataAuthorityOnly,true);assert.equal(e.externalProgramsExecuted,false)
})

test('v2 native employer label alone does not assert an Atos legal entity',async()=>{
 const r=await replay();assert.ifError(r.error);assert.equal(r.jobs.length,25)
 for(const job of r.jobs){assert.equal(job.nativeLegalEmployer,null);assert.equal(job.nativeEmployerLabel,'Atos');assert.equal(job.sourceNativeRecord.legalEmployer,null);assert.equal(job.sourceNativeRecord.nativeEmployerLabel,'Atos')}
})

const additionalCriterion='An additional current minimum requirement: a PhD in cryptography.'
const addNativeCriterion=p=>{p.body=p.body.replace('<span class="jobdescription">','<span class="jobdescription"><p>'+additionalCriterion+'</p>')}
test('v2 consistent new full description criterion is retained from both genuine native reads',async()=>{
 const target=fixture.passes[0].rows[0].url,r=await replay((p,url)=>{if(url===target)addNativeCriterion(p)})
 assert.ifError(r.error);assert.equal(r.mutations.length,2);assert.equal(r.jobs.length,25)
 const job=r.jobs.find(j=>j.sourceUrl===target);assert.ok(job)
 for(const value of[job.jobDescription,job.sourceNativeFullCriteria,job.sourceNativeRecord.criteria,job.sourceNativeClosingRecord.criteria])assert.ok(value.includes(additionalCriterion))
 assert.ok(job.sourceNativeOriginalHTML.includes(additionalCriterion))
})

for(const [name,criterion]of[
 ['a new foreign workplace statement','<p>Work location: United States.</p>'],
 ['a new foreign employer statement','<p>Hiring organization: Another Employer Incorporated.</p>'],
 ['an unproved linked complete job description','<p>See the complete job description at https://example.invalid/current-full-role.docx</p>'],
])test('v2 bound-field authority rejects '+name,async()=>{
 const target=fixture.passes[0].rows[0].url,r=await replay((p,url)=>{if(url===target)p.body=p.body.replace('<span class="jobdescription">','<span class="jobdescription">'+criterion)})
 assert.ok(r.mutations.length);assert.equal(r.jobs.length,0);assert.equal(r.error?.failureKind,'coverage_gap')
})

for(const notice of[
 'We are no longer accepting applications for this position.',
 'This job is no longer accepting applications.',
 'This position is not currently available.',
 'This job posting is closed.',
 'The vacancy has been removed.',
 'This requisition has been cancelled.',
])test('v2 dynamic acceptance guard rejects unavailable notice: '+notice,async()=>{
 const target=fixture.passes[0].rows[0].url,r=await replay((p,url)=>{if(url===target)p.body=p.body.replace('<span class="jobdescription">','<span class="jobdescription"><p>'+notice+'</p>')})
 assert.ok(r.mutations.length);assert.equal(r.jobs.length,0);assert.equal(r.error?.failureKind,'coverage_gap')
})
for(const declaration of[
 'Application deadline: 1 November 2026.',
 'Applications close on 1 November 2026.',
 'Job title: A different native role.',
 'Requisition ID: 999999.',
 'Apply via https://another.example/employer/vacancy.',
])test('v2 dynamic acceptance guard retains strict identity/date/application declaration: '+declaration,async()=>{
 const target=fixture.passes[0].rows[0].url,r=await replay((p,url)=>{if(url===target)p.body=p.body.replace('<span class="jobdescription">','<span class="jobdescription"><p>'+declaration+'</p>')})
 assert.ok(r.mutations.length);assert.equal(r.jobs.length,0);assert.equal(r.error?.failureKind,'coverage_gap')
})

for(const declaration of[
 'The work location for this vacancy is United States.',
 'This position is located in United States.',
 'You will be employed directly by Another Employer Incorporated.',
 'Your employer will be Another Employer Incorporated.',
 'The closing date for this role is 1 November 2026.',
 'The application deadline is 1 November 2026.',
])test('v3 parent authority declaration requires review regardless of sentence grammar: '+declaration,async()=>{
 const target=fixture.passes[0].rows[0].url,r=await replay((p,url)=>{if(url===target)p.body=p.body.replace('<span class="jobdescription">','<span class="jobdescription"><p>'+declaration+'</p>')})
 assert.ok(r.mutations.length>=1);assert.equal(r.jobs.length,0);assert.equal(r.error?.failureKind,'coverage_gap')
})

for(const changedPass of[0,1])test('v3 new authority carrier requires review on independent pass'+changedPass,async()=>{
 const target=fixture.passes[0].rows[0].url,r=await replay((p,url,index)=>{if(url===target&&index===changedPass)p.body=p.body.replace('<span class="jobdescription">','<span class="jobdescription"><p>Your employer will be Another Employer Incorporated.</p>')})
 assert.equal(r.mutations.length,1);assert.equal(r.jobs.length,0);assert.equal(r.error?.failureKind,'coverage_gap')
})

test('v3 a complete ordinary current certification criterion remains dynamic and fully retained',async()=>{
 const criterion='You must hold a current cloud security certification before applying.',target=fixture.passes[0].rows[0].url
 const r=await replay((p,url)=>{if(url===target)p.body=p.body.replace('<span class="jobdescription">','<span class="jobdescription"><p>'+criterion+'</p>')})
 assert.ifError(r.error);assert.equal(r.mutations.length,2);assert.equal(r.jobs.length,25)
 const job=r.jobs.find(j=>j.sourceUrl===target);assert.ok(job)
 for(const value of[job.jobDescription,job.sourceNativeFullCriteria,job.sourceNativeRecord.criteria,job.sourceNativeClosingRecord.criteria])assert.ok(value.includes(criterion))
})

for(const [name,criterion]of[
 ['hidden criterion','<p hidden>'+additionalCriterion+'</p>'],
 ['ARIA criterion','<p aria-hidden="true">'+additionalCriterion+'</p>'],
 ['inert criterion','<p inert>'+additionalCriterion+'</p>'],
 ['unknown style','<p style="font-size:0">'+additionalCriterion+'</p>'],
 ['unknown attribute condition','<p data-minimum-qualification="PhD">'+additionalCriterion+'</p>'],
 ['duplicate attributes','<p class="x" class="y">'+additionalCriterion+'</p>'],
 ['unreviewed template criteria','<template><p>'+additionalCriterion+'</p></template>'],
 ['new executable program','<script>window.currentPositionClosed=true;</script>'],
 ['new inline style','<style>.jobdescription{display:none}</style>'],
 ['active closed notice','<p>This position is currently unavailable.</p>'],
])test('v2 exact description binding holds '+name,async()=>{
 const target=fixture.passes[0].rows[0].url,r=await replay((p,url)=>{if(url===target)p.body=p.body.replace('<span class="jobdescription">','<span class="jobdescription">'+criterion)})
 assert.ok(r.mutations.length);assert.equal(r.jobs.length,0);assert.equal(r.error?.failureKind,'coverage_gap')
})

for(const changedPass of[0,1])test('v2 full native criterion must reconcile with independent closing when only pass'+changedPass+' changes',async()=>{
 const target=fixture.passes[0].rows[0].url,r=await replay((p,url,index)=>{if(url===target&&index===changedPass)addNativeCriterion(p)})
 assert.equal(r.mutations.length,1);assert.equal(r.jobs.length,0);assert.equal(r.calls.length,68);assert.match(r.error?.message??'',/full native closing changed/)
})

for(const maxJobs of[null,2])test('v2 actual catalog preserves mixed27/26 original observations independently of caller maxJobs='+maxJobs,async()=>{
 const r=await replay(undefined,{actualCatalog:true,maxJobs});assert.ifError(r.error);assert.equal(r.jobs.length,maxJobs??25)
 const snapshot=readSourceObservationEvidence(r.jobs,'atos'),e=r.jobs.nativeCollectionEvidence
 assert.equal(snapshot.recordKind,'mixed');assert.equal(snapshot.observedRecordCount,27);assert.equal(snapshot.observedVacancyCount,26)
 assert.equal(e.recordKind,'mixed');assert.equal(e.observedRecordCount,27);assert.equal(e.observedVacancyCount,26)
 assert.equal(e.nativeRows.length,27);assert.equal(e.closingNativeRows.length,27);assert.equal(e.openingModels.length,27);assert.equal(e.closingModels.length,27);assert.equal(e.originalResponses.length,68)
 assert.equal(e.holds.filter(h=>h.reason!=='caller-current-result-budget').length,2)
})

test('expiry is checked against the fresh closing clock at the exact native 18:30 UTC boundary',async()=>{
 let clocks=0
 const r=await replay(undefined,{now:()=>++clocks===1?fixture.capturedAt:'2026-11-15T18:30:00.000Z'})
 assert.ifError(r.error);assert.equal(r.jobs.length,22);assert.equal(clocks,2)
 const e=r.jobs.nativeCollectionEvidence
 assert.equal(e.closingObservedAt,'2026-11-15T18:30:00.000Z');assert.equal(e.holds.length,5)
 assert.deepEqual(e.holds.filter(h=>h.reason==='original-native-publication-expired').map(h=>h.routeID).sort(),['1409482933','1437260133','1446494433'])
 assert.equal(e.nativeRows.length,27);assert.equal(e.closingModels.length,27)
})

test('a closing observation cannot precede the opening observation',async()=>{
 let clocks=0;const r=await replay(undefined,{now:()=>++clocks===1?fixture.capturedAt:'2026-11-14T00:00:00.000Z'})
 assert.equal(r.jobs.length,0);assert.match(r.error?.message??'',/closing observation clock/)
})

const corporatePacket=fixture.packets.find(p=>p.requestedURL.includes('www.atos.ai/?'))
const currentCorporatePacket=fixture.additionalCorporatePublicResponses[0]
const corporateProfile=JSON.parse(fs.readFileSync(new URL('./currentProfile20261115.json',import.meta.url)))
const changeCorporateFlag=(html,change)=>{
 const pattern=/"system__scriptSrc":("(?:\\.|[^"\\])*")/g,matches=[...html.matchAll(pattern)]
 assert.equal(matches.length,1)
 const match=matches[0],value=JSON.parse(match[1])
 return html.slice(0,match.index)+'"system__scriptSrc":'+JSON.stringify(change(value))+html.slice(match.index+match[0].length)
}
const qualifiesCorporate=(html,headers)=>{
 try{
  const proof=currentAtosDocument(html,{url:currentCorporatePacket.url,headers})
  return corporateProfile.documents[currentCorporatePacket.requestedURL].contextSHA256.includes(proof.contextSHA256)&&JSON.stringify(proof.headerContext)===JSON.stringify(corporateProfile.responseContracts[currentCorporatePacket.requestedURL].headerContext)
 }catch{return false}
}
test('v4 genuine old and post-VPN current corporate CSP/body differ only in bound boundary whitespace',()=>{
 const oldProof=currentAtosDocument(body(corporatePacket),corporatePacket),currentProof=currentAtosDocument(body(currentCorporatePacket),currentCorporatePacket)
 assert.deepEqual(currentProof.headerContext,oldProof.headerContext)
 assert.equal(currentProof.contextSHA256,oldProof.contextSHA256)
 assert.equal(qualifiesCorporate(body(currentCorporatePacket),currentCorporatePacket.headers),true)
 assert.equal(currentCorporatePacket.sha256,'13c88e023e623f6c144b5c8902912706924fe9a64850669c109cb03b0b669d77')
})
for(const whitespace of[' ','\t',' \t '])test('v4 only paired ASCII SP/HTAB before CSP directive boundary is formatting: '+JSON.stringify(whitespace),()=>{
 const headers={...currentCorporatePacket.headers,'content-security-policy':currentCorporatePacket.headers['content-security-policy'].replaceAll(';',whitespace+';')}
 const html=changeCorporateFlag(body(currentCorporatePacket),value=>value.replace(/[\t ]+$/,'')+whitespace)
 assert.equal(qualifiesCorporate(html,headers),true)
 assert.deepEqual(currentAtosHeaders(headers),currentAtosHeaders(currentCorporatePacket.headers))
})
for(const changed of['header-only','JSON-only'])test('v4 native policy/serialized source-list tail must agree: '+changed,()=>{
 const headers={...currentCorporatePacket.headers},original=body(currentCorporatePacket)
 if(changed==='header-only')headers['content-security-policy']=headers['content-security-policy'].replace('www.googleadservices.com;','www.googleadservices.com https://unreviewed.invalid;')
 const html=changed==='JSON-only'?changeCorporateFlag(original,value=>value+' https://unreviewed.invalid'):original
 assert.throws(()=>currentAtosDocument(html,{url:currentCorporatePacket.url,headers}),/source-list|CSP/)
})
test('v4 a new source in both policy and bound JSON never inherits the original publication context',()=>{
 const headers={...currentCorporatePacket.headers,'content-security-policy':currentCorporatePacket.headers['content-security-policy'].replace('www.googleadservices.com;','www.googleadservices.com https://unreviewed.invalid;')}
 const html=changeCorporateFlag(body(currentCorporatePacket),value=>value+' https://unreviewed.invalid')
 assert.equal(qualifiesCorporate(html,headers),false)
})
test('v4 whitespace inside a source token remains a policy and JSON content change',()=>{
 const headers={...currentCorporatePacket.headers,'content-security-policy':currentCorporatePacket.headers['content-security-policy'].replace('www.gstatic.com','www.gsta tic.com')}
 const html=changeCorporateFlag(body(currentCorporatePacket),value=>value.replace('www.gstatic.com','www.gsta tic.com'))
 assert.equal(qualifiesCorporate(html,headers),false)
})
for(const [name,change]of[
 ['removed CSP',headers=>{delete headers['content-security-policy']}],
 ['new CSP directive',headers=>{headers['content-security-policy']+=" worker-src 'none';"}],
 ['new report-only policy',headers=>{headers['content-security-policy-report-only']="default-src 'none';"}],
 ['whitespace inside nonce token',headers=>{headers['content-security-policy']=headers['content-security-policy'].replace(/'nonce-([^']+)'/,"'nonce-$1 '")}],
])test('v4 native policy/token/header meaning remains strict: '+name,()=>{
 const headers={...currentCorporatePacket.headers};change(headers)
 assert.equal(qualifiesCorporate(body(currentCorporatePacket),headers),false)
})
for(const [name,change]of[
 ['duplicate source-list JSON key',html=>html.replace('"system__scriptSrc":','"system__scriptSrc":"unreviewed.invalid","system__scriptSrc":')],
 ['multiple native JSON carriers',html=>{const start=html.lastIndexOf('<script',html.indexOf('id="__NEXT_DATA__"')),end=html.indexOf('</script>',start)+9;return html.replace('</body>',html.slice(start,end)+'</body>')}],
 ['inactive JSON MIME',html=>html.replace('id="__NEXT_DATA__" type="application/json"','id="__NEXT_DATA__" type="text/plain"')],
 ['new external JSON carrier',html=>html.replace('id="__NEXT_DATA__"','id="__NEXT_DATA__" src=""')],
 ['template JSON carrier',html=>{const start=html.lastIndexOf('<script',html.indexOf('id="__NEXT_DATA__"')),end=html.indexOf('</script>',start)+9;return html.slice(0,start)+'<template>'+html.slice(start,end)+'</template>'+html.slice(end)}],
])test('v4 only the unique strict own native JSON carrier binds the CSP source-list: '+name,()=>{
 assert.throws(()=>currentAtosDocument(change(body(currentCorporatePacket)),currentCorporatePacket),/JSON|carrier|source-list/)
})
test('v4 actual post-VPN corporate component qualifies with the retained full native cohort and raw headers intact',async()=>{
 const r=await replay((p,url,index)=>{if(url===currentCorporatePacket.requestedURL&&index===0){p.body=body(currentCorporatePacket);p.headers=structuredClone(currentCorporatePacket.headers)}})
 assert.ifError(r.error);assert.equal(r.jobs.length,25);assert.equal(r.calls.length,68);assert.equal(r.mutations.length,1)
 const audit=r.jobs.nativeCollectionEvidence,corporate=audit.originalResponses.find(p=>p.requestedURL===currentCorporatePacket.requestedURL)
 assert.equal(corporate.headers['content-security-policy'],currentCorporatePacket.headers['content-security-policy'])
 assert.equal(corporate.bodyBase64,currentCorporatePacket.bodyBase64)
 assert.equal(audit.observedRecordCount,27);assert.equal(audit.observedVacancyCount,26);assert.equal(audit.holds.length,2)
})
test('fresh corporate CSP nonce remains paired with every exact native HTML and Next stylesheet carrier',()=>{
 const original=body(corporatePacket),old=corporatePacket.headers['content-security-policy'].match(/'nonce-([^']+)'/)[1],fresh=Buffer.alloc(16,73).toString('base64')
 const headers={...corporatePacket.headers,'content-security-policy':corporatePacket.headers['content-security-policy'].replace(old,fresh)}
 assert.equal(currentAtosDocument(original,{url:corporatePacket.url,headers:corporatePacket.headers}).contextSHA256,currentAtosDocument(original.replaceAll(old,fresh),{url:corporatePacket.url,headers}).contextSHA256)
})
for(const [name,mutate]of[
 ['mismatched Next stylesheet nonce',(html,nonce)=>html.replace('data-n-css="'+nonce+'"','data-n-css="'+Buffer.alloc(16,12).toString('base64')+'"')],
 ['unknown nonce attribute carrier',(html,nonce)=>html.replace('</body>','<div data-extra-nonce="'+nonce+'"></div></body>')],
 ['unknown nonce literal program carrier',(html,nonce)=>html.replace('</body>','<script>window.extraNonce="'+nonce+'";</script></body>')],
 ['duplicate Next nonce carrier',(html,nonce)=>html.replace('</body>','<noscript data-n-css="'+nonce+'"></noscript></body>')],
])test('corporate nonce binding rejects '+name,()=>{
 const original=body(corporatePacket),nonce=corporatePacket.headers['content-security-policy'].match(/'nonce-([^']+)'/)[1],changed=mutate(original,nonce)
 assert.notEqual(changed,original);assert.throws(()=>currentAtosDocument(changed,{url:corporatePacket.url,headers:corporatePacket.headers}),/nonce/)
})

test('exact anonymous CSRF/tracking literals and passive override cache integers can refresh without changing native authority',()=>{
 const p=fixture.packets.find(p=>p.requestedURL===fixture.passes[0].rows[0].url),original=body(p),before=currentAtosDocument(original,{url:p.url,headers:p.headers})
 let changed=original.replace(before.token,'30000000-0000-4000-8000-000000000001'),count=0
 changed=changed.replace(/(\bctid\s*=\s*')[a-f0-9-]{36}(')/g,(_m,a,b)=>{count++;return a+'30000000-0000-4000-8000-000000000002'+b}).replace(/(\/js\/override\.js\?locale=en_US(?:&amp;|&)i=)\d{1,10}/,'$1999999999')
 assert.equal(count,1);assert.notEqual(changed,original)
 assert.equal(currentAtosDocument(changed,{url:p.url,headers:p.headers}).contextSHA256,before.contextSHA256)
})

for(const [name,change]of[
 ['country label alternative',p=>{const model=JSON.parse(p.body);model.facets.map.country.find(c=>c.name==='IN').translated='Indonesia';p.body=JSON.stringify(model)}],
 ['duplicate country JSON key',p=>{p.body=p.body.replace(/"translated"\s*:\s*"India"/,'"translated":"India","translated":"Indonesia"')}],
])test('closing public facet rejects '+name,async()=>{
 const r=await replay((p,url,index)=>{if(url.endsWith('/services/jobs/options/facetValues/')&&index===1)change(p)})
 assert.ok(r.mutations.length);assert.equal(r.jobs.length,0);assert.equal(r.error?.failureKind,'coverage_gap')
})

test('first failed opening role stops the queued role requests and drains active work',async()=>{
 const target=fixture.passes[0].rows[0].url,r=await replay((p,url,index)=>{if(url===target&&index===0)p.body=p.body.replace('</body>','<p>This job is now not available.</p></body>')})
 assert.ok(r.mutations.length);assert.equal(r.jobs.length,0);assert.equal(r.error?.failureKind,'coverage_gap')
 assert.ok(r.calls.filter(c=>/\/job\/[^?]+\/\d+\/$/.test(c.url)).length<=2)
})

test('native UTC publication and expiry calendars reject impossible or mismatched components',()=>{
 assert.equal(currentAtosUTC('Sun Nov 15 18:30:00 UTC 2026'),'2026-11-15T18:30:00.000Z')
 for(const value of['Sun Feb 30 18:30:00 UTC 2026','Mon Nov 15 18:30:00 UTC 2026','Sun Nov 15 24:30:00 UTC 2026','Sun Nov 15 18:61:00 UTC 2026'])assert.throws(()=>currentAtosUTC(value),/UTC calendar/)
})

for(const reason of['caller-stop',Object.freeze(Error('frozen caller-stop'))]){
 test('pre-aborted caller reason remains exact: '+String(reason),async()=>{
  const controller=new AbortController();controller.abort(reason);let called=false
  await assert.rejects(registeredRun({signal:controller.signal,fetchImpl:async()=>{called=true;throw Error('unreachable')}}),e=>e===reason);assert.equal(called,false)
 })
 test('in-flight uncooperative native fetch preserves caller reason and disposes a late response: '+String(reason),async()=>{
  const controller=new AbortController();let settle,canceled=0
  const result=registeredRun({signal:controller.signal,requestIntervalMs:0,fetchImpl:()=>new Promise(resolve=>{settle=resolve})})
  await new Promise(resolve=>setTimeout(resolve,20));assert.equal(typeof settle,'function');controller.abort(reason)
  await assert.rejects(result,e=>e===reason)
  settle({body:{cancel(){canceled++}}});await new Promise(resolve=>setTimeout(resolve,10));assert.equal(canceled,1)
 })
}

test('abort disposes an uncooperative native body reader exactly once without waiting for cancellation',async()=>{
 const controller=new AbortController(),reason=Object.freeze(Error('body caller-stop'));let canceled=0,released=0,started
 const ready=new Promise(resolve=>{started=resolve}),result=registeredRun({signal:controller.signal,requestIntervalMs:0,fetchImpl:async()=>({body:{getReader(){return{read(){started();return new Promise(()=>{})},cancel(){canceled++;return new Promise(()=>{})},releaseLock(){released++}}}}})})
 await ready;controller.abort(reason);await assert.rejects(result,e=>e===reason)
 assert.equal(canceled,1);assert.equal(released,1)
})

test('source deadline bounds an uncooperative fetch without relying on transport cooperation',async()=>{
 const started=performance.now()
 await assert.rejects(registeredRun({sourceDeadlineMs:20,requestIntervalMs:0,fetchImpl:()=>new Promise(()=>{})}),e=>e.failureKind==='coverage_gap'&&/deadline/.test(e.message))
 assert.ok(performance.now()-started<1000)
})

test('intrinsic response bytes reject a spoofed oversized chunk before buffering and dispose once',async()=>{
 const chunk=new Uint8Array(4000001);Object.defineProperty(chunk,'byteLength',{value:1});let canceled=0,released=0
 await assert.rejects(registeredRun({requestIntervalMs:0,fetchImpl:async()=>({body:{getReader(){return{async read(){return{done:false,value:chunk}},cancel(){canceled++},releaseLock(){released++}}}}})}),e=>e.failureKind==='coverage_gap'&&/streaming byte bound/.test(e.message))
 assert.equal(canceled,1);assert.equal(released,1)
})

test('contradictory published dates remain original representations with no scalar date invention',async()=>{
 const r=await replay();assert.ifError(r.error)
 const conflict=r.jobs.find(j=>j.sourceNativeIdentity.routeID==='1448466833');assert.ok(conflict)
 assert.equal(conflict.postingDate,null);assert.match(conflict.sourceNativeDateRepresentations.listingPublishDate,/Oct 16, 2026/)
 assert.match(conflict.sourceNativeDateRepresentations.datePosted,/Sat Nov 14 02:00:00 UTC 2026/)
 assert.ok(r.jobs.filter(j=>j.sourceNativeIdentity.routeID!=='1448466833').every(j=>typeof j.postingDate==='string'))
})

for(const [name,change]of[
 ['new active unavailable notice',p=>{p.body=p.body.replace('</body>','<p>This position is currently unavailable.</p></body>')}],
 ['new hidden value-only criterion',p=>{p.body=p.body.replace('</body>','<input type="hidden" name="qualifications" value="Applicants must hold a cryptography doctorate."></body>')}],
 ['new ARIA-hidden criterion',p=>{p.body=p.body.replace('</body>','<section itemprop="qualifications" aria-hidden="true">Applicants must hold a cryptography doctorate.</section></body>')}],
 ['native employer change',p=>{p.body=p.body.replace('itemprop="hiringOrganization" content="Atos"','itemprop="hiringOrganization" content="Another Employer"')}],
 ['native country change',p=>{p.body=p.body.replace('content="Pune, IN"','content="Pune, ID"')}],
 ['native Apply identity change',p=>{p.body=p.body.replaceAll('/talentcommunity/apply/1448019133/','/talentcommunity/apply/1448019134/')}],
 ['disabled own Apply anchor',p=>{p.body=p.body.replace('apply dialogApplyBtn ','apply dialogApplyBtn disabled ')}],
 ['new own program mutation',p=>{p.body=p.body.replace('</body>','<script>window.currentAtosPositionClosed=true;</script></body>')}],
 ['stylesheet mode change',p=>{p.body=p.body.replace('rel="stylesheet"','rel="stylesheet" media="print"')}],
 ['native header Refresh',p=>{p.headers.refresh='0;url=https://another.example/closed'}],
 ['native header MIME',p=>{p.headers['content-type']='text/plain; charset=UTF-8'}],
])test('closing proof rejects '+name,async()=>{
 const role=fixture.passes[0].rows[0].url,r=await replay((p,url,index)=>{if(url===role&&index===1)change(p)})
 assert.ok(r.mutations.length,'control must actually modify genuine native bytes');assert.equal(r.jobs.length,0);assert.equal(r.error?.failureKind,'coverage_gap')
})
