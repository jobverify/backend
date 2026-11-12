import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import vm from 'node:vm'
import {readCurrentImmutaProgramme,runCurrentImmutaProgramme} from '../scraper/immuta/currentProgramme.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {runWithCurrentProgrammeZero} from '../scraper-support/utils/currentProgrammeZeroRecovery.js'
const sha=x=>createHash('sha256').update(x).digest('hex'),bytes=fs.readFileSync(new URL('./fixtures/immuta-current-programme-20261111.json.gz',import.meta.url)),fixture=JSON.parse(gunzipSync(bytes)),manifest=JSON.parse(fs.readFileSync(new URL('./fixtures/immuta-current-programme-20261111.manifest.json',import.meta.url)))
assert.equal(sha(bytes),manifest.fixtureSHA256)
const now=()=>fixture.capturedAtLast,CORPORATE=fixture.responses[0].requestedURL,GROUPED=fixture.responses[1].requestedURL,FLAT=fixture.responses[2].requestedURL,INTAKE=fixture.responses[3].requestedURL,originalFlat=JSON.parse(Buffer.from(fixture.responses[2].bodyBase64,'base64')),originalGrouped=JSON.parse(Buffer.from(fixture.responses[1].bodyBase64,'base64'))
function replay(change=p=>p,options={}){
 const calls=[],mutated=[];let setupError=null
 const readPage=async(url,init)=>{
  const index=calls.length;calls.push({url,init});const original=fixture.responses[index]
  if(!original||url!==original.requestedURL){setupError=new Error('Uncaptured/out-of-order Immuta fixture route '+url);throw setupError}
  const body=Buffer.from(original.bodyBase64,'base64');assert.equal(sha(body),original.bodySHA256)
  const initial={url:original.finalURL,status:original.status,headers:structuredClone(original.headers),body:Buffer.from(body)},page=change(initial,{index,url,original,text:body.toString('utf8')})
  if(!ArrayBuffer.isView(page.body)||sha(page.body)!==sha(body)||JSON.stringify(page.headers)!==JSON.stringify(original.headers)||page.url!==original.finalURL||page.status!==original.status||page.headerEntries!==undefined&&JSON.stringify(page.headerEntries)!==JSON.stringify(original.headerEntries))mutated.push(index)
  return page
 }
 return{calls,mutated,run:async()=>{let result,error;try{result=await readCurrentImmutaProgramme({readPage,now,...options})}catch(e){error=e}if(setupError)throw setupError;if(error)throw error;return result}}
}
function models(change){const rows=change(structuredClone(originalFlat)),groups=originalGrouped.map(g=>({title:g.title,postings:rows.filter(r=>r.categories?.department===g.title)})).filter(g=>g.postings.length);return(p,c)=>[GROUPED,FLAT].includes(c.url)?{...p,body:Buffer.from(JSON.stringify(c.url===FLAT?rows:groups))}:p}
async function held(name,change,pattern,expectedReads,options={}){const r=replay(change,options);await assert.rejects(r.run(),error=>{assert.equal(error.failureKind,'coverage_gap');assert.equal(error.nativeCollectionEvidence?.currentDeclaredSourceProgramComplete,false);assert.match(error.message,pattern);return true},name);assert(r.mutated.length>0,'Acquired packet must actually be mutated');if(expectedReads!==undefined)assert.equal(r.calls.length,expectedReads,'Intended gate must be reached');return r}

test('fixture retains4 actual originals and labels every controlled closing reuse without a fresh closure claim',()=>{assert.equal(fixture.actualOpeningEntities,4);assert.equal(fixture.actualClosingEntities,0);assert.equal(fixture.currentProgrammeClosureClaim,false);assert.equal(fixture.HTTPMadeByPackager,0);assert.equal(fixture.responses.length,8);for(const[index,row]of fixture.responses.entries()){assert.equal(row.controlledClosingReuse,index>=4);assert.equal(row.actualClosingAcquired,false);assert.equal(sha(Buffer.from(row.bodyBase64,'base64')),row.bodySHA256);assert.equal(Buffer.from(row.bodyBase64,'base64').length,row.bodyBytes)}})

test('controlled eight-read replay qualifies only complete current declared API programme with original11 models and separate native intake',async()=>{
 const r=replay(),jobs=await r.run(),a=jobs.nativeCollectionEvidence,e=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0);assert.deepEqual(r.calls.map(c=>c.url),[CORPORATE,GROUPED,FLAT,INTAKE,INTAKE,FLAT,GROUPED,CORPORATE]);assert.equal(e.status,'complete-inventory');assert.equal(e.reportedTotal,11);assert.equal(e.indiaFacetCount,0);assert.equal(e.listingComplete,true);assert.equal(e.lifecycleCleanupAllowed,false);assert(sourceLifecycleCleanupForbidden(jobs))
 assert.deepEqual(a.nativePayload,originalFlat);assert.deepEqual(a.groupedPayload,originalGrouped);assert.equal(a.nativeProgrammeRequests,8);assert.equal(a.rawPages.length,8);assert.equal(a.allOpeningReadsBeforeClosing,true);assert.equal(a.allFourWholeOpeningClosingEntitiesEqual,true);assert.equal(a.archiveNativeCollectionEvidence,true);assert(Object.hasOwn(Object.getOwnPropertyDescriptor(a,'archiveNativeCollectionEvidence'),'value'))
 assert.equal(a.publisherBrand,'Immuta');for(const key of['sourceScopeComplete','companyGlobalScopeQualified','lifecycleCleanupAllowed','legalEmployerQualified','nativePerRoleEmployerFieldQualified','ownVacancyUIQualified','applicationVisited','screeningQualified','browserCORSExecutionQualified','WebflowAndCSSExecutionQualified','otherHiringChannelsQualified'])assert.equal(a[key],false,key)
 for(const key of['companyGlobalTotal','companyIndiaTotal','publicationDate','firstEverPostedAt','closingDate','remoteStatus'])assert.equal(a[key],null,key)
 assert.equal(a.intake.classification,'explicit-native-general-interest-non-position');assert.equal(a.intake.nativeSchema['@type'],'JobPosting');assert.equal(a.intake.nativeCountry,null);assert.equal(a.intake.nativeLocality,'Remote USA or UK');assert.equal(a.intake.nativeEmploymentType,'Full-time');assert.equal(a.intake.nativeDatePosted,'2024-09-04');assert(a.intake.fullOwnText.includes('not tied to a specific open position or work location'));assert.equal(a.intake.bodySHA256,fixture.responses[3].bodySHA256)
 assert.equal(a.observedVacancyCount,11);assert.equal(a.observedRecordCount,12);assert.equal(readSourceObservationEvidence(jobs,'immuta').observedVacancyCount,11)
 assert.deepEqual(a.rawPages.map(p=>p.bodySHA256),fixture.responses.map(p=>p.bodySHA256));assert(r.calls.every(c=>c.init.method==='GET'&&c.init.redirect==='manual'&&c.init.credentials==='omit'&&c.init.cache==='no-store'))
 assert.deepEqual(JSON.parse(JSON.stringify(a)),a,'Opted-in audit must be ordinary complete JSON data')
})

test('consistent removal11 to10 derives programme counts dynamically without a role cap',async()=>{const r=replay(models(rows=>rows.slice(0,-1))),jobs=await r.run();assert.equal(r.mutated.length,4);assert.equal(readInventoryEvidence(jobs).reportedTotal,10);assert.equal(jobs.nativeCollectionEvidence.nativePayload.length,10);assert.equal(jobs.nativeCollectionEvidence.nonPositionIntakeCount,1)})

test('original flat response order is preserved even when grouped order differs',async()=>{const r=replay(models(rows=>rows.reverse())),jobs=await r.run();assert.deepEqual(jobs.nativeCollectionEvidence.nativePayload.map(row=>row.id),originalFlat.map(row=>row.id).reverse());assert.equal(readInventoryEvidence(jobs).reportedTotal,11)})

for(const[name,change,pattern]of[
 ['primary India',rows=>{rows[0].country='IN';rows[0].categories.location='India';rows[0].categories.allLocations=['India'];return rows},/country|location|India/i],
 ['foreign primary additional India',rows=>{rows[0].categories.allLocations.push('India');return rows},/location|country/i],
 ['unqualified secondary worksite',rows=>{rows[0].categories.allLocations.push('Unqualified office');return rows},/location|country/i],
 ['unknown typed country',rows=>{rows[0].country='ZZ';return rows},/country|location/i],
 ['structured conflicting country',rows=>{rows[0].country={name:'GB',identifier:'IN'};return rows},/country|location/i],
 ['changed native London country',rows=>{rows[0].country='US';return rows},/country|location/i],
 ['missing allLocations',rows=>{delete rows[0].categories.allLocations;return rows},/location|country/i],
 ['India native title',rows=>{rows[0].text+=' – India';return rows},/authored|India/i],
 ['India authored entity',rows=>{rows[0].additional+='<p>Work country: Ind&#105;a.</p>';return rows},/authored|India|country/i],
 ['India inline split',rows=>{rows[0].lists[0].content+='<p>Applicants may work in Ind<span>ia</span>.</p>';return rows},/authored|India/i],
 ['hidden-X masks visible India',rows=>{rows[0].additional+='<p>Work country: I<span style="display:none">X</span>ndia.</p>';rows[0].additionalPlain+=' Work country: IXndia.';return rows},/authored|style|visibility/i],
 ['hidden-X visibility',rows=>{rows[0].additional+='<p>Work country: I<span style="visibility:hidden">X</span>ndia.</p>';return rows},/authored|style|visibility/i],
 ['zero-font geography',rows=>{rows[0].additional+='<p>I<span style="font-size:0">X</span>ndia</p>';return rows},/authored|style|visibility/i],
 ['authored Bengaluru worksite',rows=>{rows[0].additional+='<p>Work location: Bengaluru, Karnataka.</p>';return rows},/authored|location|India/i],
 ['new foreign work-country criterion',rows=>{rows[0].additional+='<p>Work country: Canada.</p>';return rows},/authored|country/i],
 ['new applicant-country field',rows=>{rows[0].applicantLocationRequirements={addressCountry:'IN'};return rows},/field|schema|applicant/i],
 ['new mandatory criterion',rows=>{rows[0].qualifications='Mandatory current certification.';return rows},/field|schema|criteria/i],
 ['unknown nested salary field',rows=>{rows[0].salaryRange.applicantCountry='India';return rows},/salary|criteria/i],
 ['duplicate identity',rows=>[...rows,structuredClone(rows[0])],/duplicate|identity/i],
 ['foreign native account',rows=>{rows[0].hostedUrl=rows[0].hostedUrl.replace('/immuta/','/other/');return rows},/account|URL|identity/i],
 ['application role mismatch',rows=>{rows[0].applyUrl=rows[1].applyUrl;return rows},/application|identity|URL/i],
 ['SVG recruitment declaration',rows=>{rows[0].additional+='<svg><a href="https://other.example/careers">Other jobs</a></svg>';return rows},/authored|carrier|HTML/i],
 ['MathML recruitment declaration',rows=>{rows[0].additional+='<math><mtext>Work country India</mtext></math>';return rows},/authored|carrier|HTML/i],
 ['duplicate authored style',rows=>{rows[0].additional+='<p style="color:black" style="display:none">India</p>';return rows},/authored|style|duplicate/i],
 ['missing full native criteria',rows=>{for(const k of['opening','openingPlain','description','descriptionPlain','descriptionBody','descriptionBodyPlain','additional','additionalPlain'])rows[0][k]='';rows[0].lists=[];return rows},/criteria/i]
])test(name+' withholds the complete programme',()=>held(name,models(change),pattern,3))

for(const[name,change]of[
 ['missing grouped role',groups=>{groups[0].postings.pop();return groups}],
 ['extra grouped role',groups=>{groups[0].postings.push(structuredClone(groups[0].postings[0]));return groups}],
 ['grouped full criterion discrepancy',groups=>{groups[0].postings[0].additional+='Additional mandatory certification.';return groups}],
 ['grouped department contradiction',groups=>{groups[0].title='Other department';return groups}],
 ['new grouped pagination envelope',()=>({groups:originalGrouped,hasMore:true})]
])test(name+' cannot hide behind a flat feed',()=>held(name,(p,c)=>c.url===GROUPED?{...p,body:Buffer.from(JSON.stringify(change(JSON.parse(c.text))))}:p,/grouped|department|envelope|membership|criteria|identity/i,3))

test('duplicate own JSON country key is rejected before parsing can erase it',()=>held('duplicate JSON',(p,c)=>c.url===FLAT?{...p,body:Buffer.from(c.text.replace('"country":"GB"','"country":"IN","country":"GB"'))}:p,/duplicate|JSON/i,3))

for(const[name,change]of[
 ['corporate account change',text=>text.replaceAll('postings/immuta','postings/other')],
 ['new corporate recruitment channel',text=>text.replace('</body>','<a href="https://jobs.lever.co/other">Other careers</a></body>')],
 ['duplicate mount',text=>text.replace('</body>','<template><div id="open-positions-list"></div></template></body>')],
 ['changed initial location filter',text=>text.replace('value="all"','value="India" selected')],
 ['new pagination',text=>text.replace('</head>','<link rel="next" href="/careers?page=2"></head>')],
 ['client subset truncation',text=>text.replace('renderJobs(allJobs);','renderJobs(allJobs.slice(0,1));')],
 ['hidden stylesheet wrapper',text=>text.replace('</head>','<style>#open-positions-list{display:none!important}</style></head>')]
])test(name+' holds current whole corporate consumer profile',()=>held(name,(p,c)=>c.index===0?{...p,body:Buffer.from(change(c.text))}:p,/corporate|consumer|profile|declaration/i,1))

for(const[name,change]of[
 ['intake unavailable',(p)=>({...p,status:404})],
 ['intake now a specific role',(p,c)=>({...p,body:Buffer.from(c.text.replaceAll('This is a general interest posting and is not tied to a specific open position or work location.','This is a specific current India position.'))})],
 ['intake new applicant condition',(p,c)=>({...p,body:Buffer.from(c.text.replace('<script>(function(){function c(){','<p>Applicants must be based in India.</p><script>(function(){function c(){'))})],
 ['intake unknown schema country',(p,c)=>({...p,body:Buffer.from(c.text.replace(/"addressCountry"\s*:\s*null/,'"addressCountry":"IN"'))})],
 ['intake carrier SVG',(p,c)=>({...p,body:Buffer.from(c.text.replace('<script type="application/ld+json">','<svg><script type="application/ld+json">').replace('</script>','</script></svg>'))})]
])test(name+' withholds rather than dropping the advertised channel',()=>held(name,(p,c)=>c.index===3?change(p,c):p,/intake|HTTP|profile/i,4))

for(const index of[4,5,6,7])test('whole original entity drift at closing phase'+index+' withholds zero',()=>held('closing '+index,(p,c)=>c.index===index?{...p,body:Buffer.concat([p.body,Buffer.from(' ')])}:p,/closing|changed/i,index+1))

for(const[index,name,headers]of[
 [0,'UTF16 corporate',{'content-type':'text/html; charset=utf-16le'}],
 [1,'JSON charset ambiguity',{'content-type':'application/json; charset=UTF-8; charset=windows-1252'}],
 [2,'plain MIME',{'content-type':'text/plain; charset=utf-8'}],
 [3,'native intake charset',{'content-type':'text/html; charset=windows-1252'}],
 [0,'refresh',{'refresh':'0;url=https://foreign.example/jobs'}],
 [3,'attachment',{'content-disposition':'attachment'}],
 [4,'challenge',{'cf-mitigated':'challenge'}],
 [5,'new API CORS',{'access-control-allow-origin':'https://other.example'}],
 [6,'closing script policy',{'content-security-policy':"script-src 'none'"}],
 [7,'closing report-only drift',{'content-security-policy-report-only':"script-src 'none'"}],
 [0,'new COEP',{'cross-origin-embedder-policy':'require-corp'}],
 [0,'new auth',{'www-authenticate':'Basic realm=private'}]
])test(name+' header cannot qualify unchanged body bytes',()=>held(name,(p,c)=>c.index===index?{...p,headers:{...p.headers,...headers}}:p,/MIME|charset|encoding|header|security|policy|CORS/i,index+1))

test('denial preserves its bounded actual body and exact classification',async()=>{const r=replay((p,c)=>c.index===0?{...p,status:403}:p);await assert.rejects(r.run(),e=>{assert.equal(e.failureKind,'blocked_or_access_denied');assert.equal(e.nativeCollectionEvidence.rawPages[0].status,403);assert.equal(e.nativeCollectionEvidence.rawPages[0].bodySHA256,fixture.responses[0].bodySHA256);return true});assert.equal(r.calls.length,1)})

test('HTTP upstream error retains exact native evidence without retries',async()=>{const r=replay((p,c)=>c.index===0?{...p,status:503}:p);await assert.rejects(r.run(),e=>e.failureKind==='network_or_timeout'&&e.status===503);assert.equal(r.calls.length,1)})

test('response URL redirect identity is held',()=>held('final URL',(p,c)=>c.index===0?{...p,url:'https://other.example/careers'}:p,/URL|provenance/i,1))

test('a parsed-only callback cannot substitute missing raw body',()=>held('missing body',(p,c)=>c.index===0?{...p,body:undefined,html:c.text}:p,/raw|body|bytes/i,1))

test('complete8-read reserve is required before public reads',async()=>{const r=replay(p=>p,{maxRequests:7});await assert.rejects(r.run(),/budget|bound/i);assert.equal(r.calls.length,0)})

test('entity byte cap uses full raw bytes',async()=>{const r=replay(p=>p,{maxResponseBytes:100});await assert.rejects(r.run(),/byte|bound/i);assert.equal(r.calls.length,1)})

test('aggregate bytes cannot be reset across distinct channels',async()=>{const r=replay(p=>p,{maxAggregateBytes:500000});await assert.rejects(r.run(),/byte|bound/i);assert.equal(r.calls.length,3)})

test('untrusted Uint8Array conversion cannot hide appended corporate bytes or run callbacks',async()=>{let callbacks=0;const r=replay((p,c)=>{if(c.index)return p;const body=new Uint8Array(Buffer.concat([p.body,Buffer.from('<p>new role India</p>')]));Object.defineProperty(body,'valueOf',{value:()=>{callbacks++;return p.body}});Object.defineProperty(body,'length',{get(){callbacks++;return p.body.length}});return{...p,body}});await assert.rejects(r.run(),/profile/i);assert.equal(callbacks,0);assert.equal(r.calls.length,1)})

test('native byte copying supports genuine cross-realm Uint8Array without conversion hooks',async()=>{const r=replay(p=>({...p,body:vm.runInNewContext('new Uint8Array(bytes)',{bytes:[...p.body]})}));assert.equal((await r.run()).nativeCollectionEvidence.nativeProgrammeRequests,8)})

test('caller preabort performs no read',async()=>{const reason=new Error('stop before Immuta'),r=replay(p=>p,{signal:AbortSignal.abort(reason)});await assert.rejects(r.run(),e=>e===reason);assert.equal(r.calls.length,0)})

test('caller abort after full closing evidence cannot publish a result',async()=>{const controller=new AbortController(),reason=new Error('stop after Immuta audit'),r=replay(p=>p,{signal:controller.signal,onAudit:()=>controller.abort(reason)});await assert.rejects(r.run(),e=>e===reason&&e.nativeCollectionEvidence.currentDeclaredSourceProgramComplete===false);assert.equal(r.calls.length,8)})

test('observer errors retain native proof but cannot publish a result',async()=>{const reason=new Error('observer failed'),r=replay(p=>p,{onAudit:()=>{throw reason}});await assert.rejects(r.run(),e=>e===reason&&e.nativeCollectionEvidence.nativeProgrammeRequests===8&&e.nativeCollectionEvidence.currentDeclaredSourceProgramComplete===false)})

test('source deadline bounds a noncooperating raw callback',async()=>{let calls=0;await assert.rejects(readCurrentImmutaProgramme({now,sourceTimeoutMs:20,readPage:()=>{calls++;return new Promise(()=>{})}}),e=>e.name==='TimeoutError');assert.equal(calls,1)})

test('monotonic deadline also catches synchronous timer starvation',async()=>{let calls=0;await assert.rejects(readCurrentImmutaProgramme({now,sourceTimeoutMs:20,readPage:async url=>{const row=fixture.responses[calls++];assert.equal(url,row.requestedURL);const until=performance.now()+35;while(performance.now()<until){/* Deliberately starve the abort timer to check the monotonic deadline. */}return{url:row.finalURL,status:row.status,headers:row.headers,body:Buffer.from(row.bodyBase64,'base64')}}}),e=>e.name==='TimeoutError');assert.equal(calls,1)})

const fixtureFetch=()=>{let index=0;const responses=[];return{responses,get count(){return index},fetch:async(url,init)=>{const row=fixture.responses[index++];assert(row,'No uncaptured extra request');assert.equal(url,row.requestedURL);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');assert.equal(new Headers(init.headers).get('authorization'),null);assert.equal(new Headers(init.headers).get('cookie'),null);const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalURL});responses.push(response);return response}}}

test('ordinary raw runtime preserves original bytes, safe GET options and releases every reader',async()=>{const f=fixtureFetch(),jobs=await runCurrentImmutaProgramme({now,requestIntervalMs:0,fetchImpl:f.fetch});assert.equal(f.count,8);assert.deepEqual(jobs.nativeCollectionEvidence.nativePayload,originalFlat);for(const response of f.responses)assert.equal(response.body.locked,false)})

test('parsed-only injection never falls back to uncontrolled global HTTP',async()=>{let calls=0;await assert.rejects(runCurrentImmutaProgramme({fetchJson:async()=>{calls++;return[]}}),/raw|transport|fetchImpl/i);assert.equal(calls,0)})

test('streaming response cap cancels and releases original body',async()=>{let calls=0,canceled=0,response;await assert.rejects(runCurrentImmutaProgramme({now,requestIntervalMs:0,maxResponseBytes:100,fetchImpl:async url=>{calls++;const row=fixture.responses[0];assert.equal(url,row.requestedURL);response=new Response(new ReadableStream({start(c){c.enqueue(Buffer.from(row.bodyBase64,'base64'))},cancel(){canceled++}}),{headers:row.headers});Object.defineProperty(response,'url',{value:url});return response}}),/byte|bound/i);await Promise.resolve();assert.equal(calls,1);assert.equal(canceled,1);assert.equal(response.body.locked,false)})

test('stalled streaming body is timed out, canceled and released once',async()=>{let calls=0,canceled=0,response;await assert.rejects(runCurrentImmutaProgramme({now,requestIntervalMs:0,requestTimeoutMs:30,fetchImpl:async url=>{calls++;const row=fixture.responses[0];response=new Response(new ReadableStream({start(c){c.enqueue(Buffer.from(row.bodyBase64,'base64').subarray(0,20))},pull(){return new Promise(()=>{})},cancel(){canceled++}}),{headers:row.headers});Object.defineProperty(response,'url',{value:url});return response}}),e=>e.name==='TimeoutError');await Promise.resolve();assert.equal(calls,1);assert.equal(canceled,1);assert.equal(response.body.locked,false)})

test('existing bridge rejects reordered prior full native array even though programme members agree',async()=>{const prior=[];Object.defineProperty(prior,'nativeCollectionEvidence',{value:{source:'immuta',nativePayload:structuredClone(originalFlat).reverse()}});const r=replay();await assert.rejects(runWithCurrentProgrammeZero({now},{source:'immuta',runPrimary:async()=>prior,runProgramme:r.run}),/Earlier native criteria|identities|countries changed/i);assert.equal(r.calls.length,8)})

test('existing bridge rejects changed prior criteria instead of discarding the same-attempt contradiction',async()=>{const prior=[],payload=structuredClone(originalFlat);payload[0].additional+='Additional requirement';Object.defineProperty(prior,'nativeCollectionEvidence',{value:{source:'immuta',nativePayload:payload}});const r=replay();await assert.rejects(runWithCurrentProgrammeZero({now},{source:'immuta',runPrimary:async()=>prior,runProgramme:r.run}),/Earlier native criteria|identities|countries changed/i);assert.equal(r.calls.length,8)})

for(const name of ['permissions-policy','document-policy'])test(name+' security change holds the original native programme',()=>held(name,(p,c)=>c.index===0?{...p,headers:{...p.headers,[name]:'unreviewed-policy'}}:p,/security|policy/i,1))

for(const name of ['cf-chl-out','cf-chl-bypass','x-captcha','x-captcha-required','x-challenge'])test(name+' challenge marker holds unchanged current body',()=>held(name,(p,c)=>c.index===0?{...p,headers:{...p.headers,[name]:'unreviewed'}}:p,/challenge|header|security/i,1))

test('controlled newly header-bound intake metadata preserves every original while raw equality remains distinct',async()=>{
 const source=fixture.responses[3],oldRay=source.headers['cf-ray'].split('-')[0],oldSeconds=String(Date.parse(source.headers.date)/1000),seconds=String(Number(oldSeconds)+1),newRay='0000000000000001',newDate=new Date(Number(seconds)*1000).toUTCString(),oldTime=Buffer.from(oldSeconds).toString('base64'),newTime=Buffer.from(seconds).toString('base64')
 const r=replay((p,c)=>c.index===4?{...p,headers:{...p.headers,'cf-ray':newRay+'-LHR',date:newDate},body:Buffer.from(c.text.replaceAll(oldRay,newRay).replace(oldTime,newTime))}:p),jobs=await r.run(),a=jobs.nativeCollectionEvidence
 assert.equal(r.calls.length,8);assert.equal(r.mutated.length,1);assert.equal(a.allFourWholeOpeningClosingEntitiesEqual,false);assert.equal(a.wholeCorporateAndAPIOpeningClosingEntitiesEqual,true);assert.equal(a.intakeCompleteEntityComparisonEqual,true);assert.deepEqual(a.openingClosingEntityEquality.map(row=>row.wholeRawEntityEqual),[true,true,true,false]);assert(a.openingClosingEntityEquality.every(row=>row.completeEntityComparisonEqual));assert.notEqual(a.intake.bodySHA256,a.intakeClosing.bodySHA256);assert.equal(a.intake.requestMetadataCertificate.comparisonFingerprint,a.intakeClosing.requestMetadataCertificate.comparisonFingerprint);assert.equal(a.intakeClosing.requestMetadataCertificate.headerBinding.date,newDate);assert.equal(a.intakeClosing.requestMetadataCertificate.headerBinding.cfRay,newRay+'-LHR');assert.equal(a.rawPages[3].bodySHA256,source.bodySHA256);assert.equal(a.rawPages[4].bodySHA256,a.intakeClosing.bodySHA256);assert.deepEqual(a.intake.nativeSchema,a.intakeClosing.nativeSchema);assert.deepEqual(a.nativePayload,originalFlat);assert.equal(a.observedRecordCount,12);assert.equal(a.observedVacancyCount,11);assert.equal(readSourceObservationEvidence(jobs,'immuta').observedRecordCount,12);assert.equal(a.lifecycleCleanupAllowed,false);assert.deepEqual(JSON.parse(JSON.stringify(a)),a)
})

test('intake source ray may not drift without its exact current response header binding',()=>held('unbound closing intake source',(p,c)=>c.index===4?{...p,body:Buffer.from(c.text.replaceAll(fixture.responses[3].headers['cf-ray'].split('-')[0],'0000000000000001'))}:p,/ray|bind/i,5))

test('intake duplicate original response Date entries cannot be folded into proof',()=>held('duplicate actual Date',(p,c)=>c.index===3?{...p,headerEntries:[...fixture.responses[3].headerEntries,['date',p.headers.date]]}:p,/duplicate|Date|entry/i,4))

test('company overview alone cannot substitute for missing published role-specific criteria',()=>held('missing own criteria',models(rows=>{rows[0].lists=[];rows[0].descriptionBody='';rows[0].descriptionBodyPlain='';return rows}),/criteria|role/i,3))

test('encoded India in the original title holds zero without rewriting native text',()=>held('encoded native title',models(rows=>{rows[0].text+=' - Ind&#105;a';return rows}),/authored|India|location/i,3))
