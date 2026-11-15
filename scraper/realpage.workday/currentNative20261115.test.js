import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {validateCurrentRealPageDateWindow} from './currentNative20261115.js'
import {runRemainingRecruitmentBatchSource} from '../../scraper-support/utils/remainingRecruitmentBatch20261103.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const ACCOUNT='https://careers-international-realpagepms.icims.com/',FIRST=ACCOUNT+'jobs/14695/developer-iv/job',body=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8')
const profile=JSON.parse(fs.readFileSync(new URL('./currentProfile20261115.json',import.meta.url),'utf8'))
const UNREQUESTED=[
 'https://www.realpage.com/z8dY/FVtI/B4C/hGu/c73w/OSEmfGJ7hOb7Jcuw/Xmlu/Y1Eje/3UNNxk',
 'https://www.googletagmanager.com/gtm.js?id=GTM-MDKXBGH',
 'https://www.googletagmanager.com/gtm.js?id=GTM-W8W92P'
]
const grouped=new Map();for(const p of fixture.packets){if(!grouped.has(p.requestedURL))grouped.set(p.requestedURL,[]);grouped.get(p.requestedURL).push(p)}
function replay(change=()=>{},options={}){
 const calls=[],counts=new Map(),misses=[],mutations=[]
 const fetchImpl=options.fetchImpl||(async(value,init)=>{
  const url=String(value),index=counts.get(url)||0;counts.set(url,index+1)
  if(options.forbidURLs?.includes(url)){calls.push({url,index,init});throw Error('Unused external program must never be requested')}
  const currentBoard=options.currentBoard&&url===profile.board&&(!options.currentBoardClosingOnly||index===1)?fixture.supplementalCurrentAuthorityPackets.find(p=>p.requestedURL===url):null
  const original=options.legacyOnly?fixture.legacyOriginal.find(p=>p.requestedURL===url):currentBoard||grouped.get(url)?.[index]||fixture.legacyOriginal.find(p=>p.requestedURL===url)
  if(!original){misses.push(url);throw Error('No genuine retained native packet '+url+' #'+index)}
  const p={...structuredClone(original),body:body(original)};change(p,url,index)
  if(p.body!==body(original)||p.status!==original.status||p.url!==original.url||JSON.stringify(p.headers)!==JSON.stringify(original.headers))mutations.push({url,index})
  calls.push({url,index,init});const response=new Response(p.body===''?null:p.body,{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response
 })
 const task=options.legacyOnly?runRemainingRecruitmentBatchSource.bind(null,'realpage'):run
 return{calls,misses,mutations,promise:task({fetchImpl,requestIntervalMs:0,now:()=>new Date('2026-11-15T13:00:00.000Z'),...options})}
}
test('original registered generic program follows only retained US account and irrelevant menus without any fixture misses',async()=>{
 const r=replay(undefined,{legacyOnly:true});let jobs=[],error
 try{jobs=await r.promise}catch(e){error=e}
 assert.equal(r.misses.length,0);assert.equal(jobs.length,0);assert.equal(error?.failureKind,'coverage_gap')
 assert.ok(r.calls.some(c=>c.url.startsWith('https://careers-realpagepms.icims.com/')));assert.ok(!r.calls.some(c=>c.url.startsWith(ACCOUNT)))
 assert.equal(r.calls.length,8)
})
test('registered current RealPage preserves complete independently typed native India roles despite country-absent cards',async()=>{
 const r=replay();let jobs=[],error
 try{jobs=await r.promise}catch(e){error=e}
 assert.deepEqual(r.misses,[],'a missing replay response cannot masquerade as the original scraper bug')
 if(!jobs.length)console.log(JSON.stringify({originalError:error?.message,originalFailureKind:error?.failureKind,requests:r.calls.map(c=>c.url)}))
 assert.equal(jobs.length,2)
 assert.deepEqual(jobs.map(j=>j.title),['Developer IV','Developer IV (React.JS+Node.JS)'])
 for(const job of jobs){assert.equal(job.company,'RealPage');assert.equal(job.nativeLegalEmployer,'RealPage, Inc.');assert.equal(job.country,'India');assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceNativeClosingReconciled,true);assert.equal(job.sourceRenderedApplicationQualified,false);assert.ok(job.nativeSourceRecord.originalNativeJobPosting.jobLocation.every(location=>location.address.addressCountry==='IN'));assert.equal(job.nativeSourceRecord.originalNativeJobPosting.hiringOrganization.sameAs,'https://www.realpage.com/');assert.ok(job.jobDescription.includes('Qualifications'));assert.ok(job.jobDescription.includes('Responsibilities'));assert.ok(job.jobDescription.includes('European Union (EU) or United Kingdom (UK) resident'))}
 const d=readNativeDocument(body(grouped.get(FIRST)[0]));assert.ok(jobs[0].jobDescription.includes(d.text(d.nodes(n=>(n.attrs.class||'')==='iCIMS_JobContent')[0])))
 assert.equal(jobs.nativeCollectionEvidence.nativeRows.length,59);assert.equal(jobs.nativeCollectionEvidence.holds.length,57);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.ok(r.calls.every(c=>c.init.method==='GET'))
 assert.equal(r.calls.length,130);assert.equal(jobs.nativeCollectionEvidence.unavailableDeclaredResources.length,1)
 assert.deepEqual(jobs.nativeCollectionEvidence.originalDeclaredResourceURLs,profile.assetURLs);assert.equal(jobs.nativeCollectionEvidence.requiredNativeAuthorityResourceURLs.length,54)
 assert.equal(jobs[1].requisitionId,'2025-12414');assert.equal(jobs[1].postingDate,null);assert.equal(jobs[1].closingDate,null);assert.equal(jobs[1].sourceDateSemanticsUnresolved,true);assert.equal(jobs[1].nativeSourceRecord.originalNativeJobPosting.datePosted,'2026-10-18T04:00:00.000Z');assert.equal(jobs[1].department,'Hidden (37061)');assert.equal(jobs[1].employmentType,'OTHER')
})

const changeSchema=(p,change)=>{p.body=p.body.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,(_,a,json,z)=>a+JSON.stringify(change(JSON.parse(json)))+z)}
async function held(change,options={}){const r=replay(change,options);let error,jobs=[];try{jobs=await r.promise}catch(e){error=e}assert.deepEqual(r.misses,[]);assert.ok(r.mutations.length,'control must reach a genuine retained native response');assert.equal(jobs.length,0);assert.equal(error?.failureKind,'coverage_gap');assert.notEqual(error?.sourceScopeComplete,true);assert.notEqual(error?.lifecycleCleanupAllowed,true);return{r,error}}
const cases=[
 ['unknown native alternative country',p=>changeSchema(p,s=>({...s,jobLocation:[...s.jobLocation,{...s.jobLocation[0],address:{...s.jobLocation[0].address,addressCountry:'ZZ'}}]}))],
 ['foreign native alternative country',p=>changeSchema(p,s=>({...s,jobLocation:[...s.jobLocation,{...s.jobLocation[0],address:{...s.jobLocation[0].address,addressCountry:'US'}}]}))],
 ['missing typed country despite unchanged Hitech City label',p=>changeSchema(p,s=>({...s,jobLocation:s.jobLocation.map(l=>({...l,address:{...l.address,addressCountry:undefined}}))}))],
 ['wrong native employer',p=>changeSchema(p,s=>({...s,hiringOrganization:{...s.hiringOrganization,name:'Unrelated Real Estate Company'}}))],
 ['wrong native publisher',p=>changeSchema(p,s=>({...s,hiringOrganization:{...s.hiringOrganization,sameAs:'https://unrelated.example/'}}))],
 ['contradictory native own role identity',p=>changeSchema(p,s=>({...s,url:s.url.replace('/14695/','/12414/')}))],
 ['extra full original criterion in native schema',p=>changeSchema(p,s=>({...s,description:s.description+'<p>Additional mandatory licence required.</p>'}))],
 ['unknown native criterion field',p=>changeSchema(p,s=>({...s,qualifications:'Additional mandatory government registration.'}))],
 ['omitted original qualification',p=>{p.body=p.body.replace('8+ years of professional software engineering experience','2+ years of professional software engineering experience')}],
 ['matched extra schema and own native full criterion',p=>{changeSchema(p,s=>({...s,description:s.description+'<p>Mandatory security clearance.</p>'}));p.body=p.body.replace('Nice to Have:','Mandatory security clearance. Nice to Have:')}],
 ['explicit applications closed',p=>{p.body=p.body.replaceAll('Nice to Have:','Applications are closed. Nice to Have:')}],
 ['explicit applications no longer accepted',p=>{p.body=p.body.replaceAll('Nice to Have:','Applications are no longer accepted. Nice to Have:')}],
 ['explicit recruitment no longer accepting applications',p=>{p.body=p.body.replaceAll('Nice to Have:','We are no longer accepting applications for this role. Nice to Have:')}],
 ['impossible calendar date',p=>changeSchema(p,s=>({...s,datePosted:'2026-09-31T04:00:00.000Z'}))],
 ['expired full native publication',p=>changeSchema(p,s=>({...s,validThrough:'2026-11-14T05:00:00.000Z'}))],
 ['decoded duplicate native schema employer',p=>{p.body=p.body.replace('"hiringOrganization":','"hiring\\u004frganization":{},"hiringOrganization":')}],
 ['hidden native full role',p=>{p.body=p.body.replace('class="iCIMS_JobContent"','class="iCIMS_JobContent" hidden')}],
 ['inert full native role',p=>{p.body=p.body.replace('class="iCIMS_JobContent"','class="iCIMS_JobContent" inert')}],
 ['native inline application override',p=>{p.body=p.body.replace('</body>','<script>document.querySelector(".iCIMS_ApplyOnlineButton").href="https://unrelated.example/"</script></body>')}],
 ['native control VALUE drift',p=>{p.body=p.body.replace(/(<a\b[^>]*\biCIMS_ApplyOnlineButton\b[^>]*)(>)/,'$1 value="disabled"$2')}],
 ['native control DATA drift',p=>{p.body=p.body.replace(/(<a\b[^>]*\biCIMS_ApplyOnlineButton\b[^>]*)(>)/,'$1 data-requires-unavailable="true"$2')}],
 ['native LINK override',p=>{p.body=p.body.replace('</head>','<link rel="alternate" href="https://unrelated.example/" /></head>')}],
 ['document-local print-only stylesheet',p=>{p.body=p.body.replace('rel="stylesheet"','rel="stylesheet" media="print"')}],
 ['role Refresh navigation',p=>{p.headers.refresh='0;url=https://unrelated.example/'}],
 ['role CSP operation denial',p=>{p.headers['content-security-policy']="script-src 'none'; style-src 'none'; form-action 'none'"}],
 ['role declared charset drift',p=>{p.headers['content-type']='text/html;charset=ISO-8859-1'}],
 ['native account tenant mismatch',p=>{p.headers['icims-tenant']='unrelated-native-tenant'}],
 ['talent token wrong length',p=>{p.body=p.body.replace(/(connect\/interests\?csrf=)[A-F0-9]{16}/,'$1ABC')}],
 ['talent token consumer target override',p=>{p.body=p.body.replace('connect/interests?csrf=','jobs/14695/login?csrf=')}],
 ['talent token extra same-token reference',p=>{const token=/(connect\/interests\?csrf=)([A-F0-9]{16})/.exec(p.body)?.[2];p.body=p.body.replace('</body>','<script>window.otherToken="'+token+'";</script></body>')}]
]
for(const [name,change]of cases)test('holds '+name+' from actual own full role',async()=>{await held((p,url)=>{if(url===FIRST)change(p)})})

for(const [name,change]of [
 ['same-role application redirected to foreign account',p=>{p.headers.location='https://unrelated.example/jobs/14695/login'}],
 ['same-role application redirected to another role',p=>{p.headers.location=profile.roleModels[1].applicationURL}]
])test('holds '+name,async()=>{await held((p,url)=>{if(url===profile.roleModels[0].applyURL)change(p)})})
for(const [name,change]of [
 ['own public login action changed',p=>{p.body=p.body.replace('login?step=email','login?step=unrelated')}],
 ['full native EU/UK application condition omitted',p=>{p.body=p.body.replaceAll('European Union (EU) or United Kingdom (UK)','Canada')}],
 ['native required application field changed',p=>{p.body=p.body.replaceAll('aria-required="true"','aria-required="false"')}]
])test('holds '+name,async()=>{await held((p,url)=>{if(url===profile.roleModels[0].applicationURL)change(p)})})
test('closing-only full criterion drift holds opening positives',async()=>{await held((p,url,index)=>{if(url===FIRST&&index===1)p.body=p.body.replace('Nice to Have:','Additional mandatory security clearance. Nice to Have:')})})
test('closing-only public application condition drift holds',async()=>{await held((p,url,index)=>{if(url===profile.roleModels[0].applicationURL&&index===1)p.body=p.body.replaceAll('European Union (EU) or United Kingdom (UK)','Canada')})})
test('closing-only explicit job unavailability holds opening full models',async()=>{await held((p,url,index)=>{if(url===FIRST&&index===1)p.body=p.body.replaceAll('Nice to Have:','Recruitment is closed. Nice to Have:')})})
test('closing-only board membership change holds rather than inventing zero',async()=>{await held((p,url,index)=>{if(url===profile.board&&index===1)p.body=p.body.replaceAll('Customer Experience Advocate II','Customer Experience Advocate III')})})
test('corporate explicit International delegation cannot be inferred from US board',async()=>{await held((p,url)=>{if(url===profile.corporate)p.body=p.body.replaceAll(ACCOUNT,'https://careers-realpagepms.icims.com/')})})
test('corporate csrf meta exact field may vary without replay or context change',async()=>{const r=replay((p,url)=>{if(url===profile.corporate)p.body=p.body.replace(/(<meta name="csrf-token" content=")[A-Za-z0-9]{40}/,'$1AbCdEf0123456789AbCdEf0123456789AbCdEf01')});const jobs=await r.promise;assert.equal(jobs.length,2);assert.equal(r.mutations.length,2);assert.ok(r.calls.every(c=>!c.url.includes('csrf=')))})
test('separate talent subscription token may vary with same exact field and byte-pinned consumer',async()=>{const r=replay((p,url)=>{if(profile.roleModels.some(m=>m.url===url))p.body=p.body.replace(/(connect\/interests\?csrf=)[A-F0-9]{16}/,'$1A1B2C3D4E5F60718')});const jobs=await r.promise;assert.equal(jobs.length,2);assert.equal(r.mutations.length,4);assert.ok(r.calls.every(c=>!c.url.includes('connect/interests')))})
test('corporate csrf field cannot carry unknown attributes',async()=>{await held((p,url)=>{if(url===profile.corporate)p.body=p.body.replace('<meta name="csrf-token"','<meta data-extra="unknown" name="csrf-token"')})})
test('corporate csrf field wrong shape holds',async()=>{await held((p,url)=>{if(url===profile.corporate)p.body=p.body.replace(/(<meta name="csrf-token" content=")[A-Za-z0-9]{40}/,'$1ABC')})})
for(const url of UNREQUESTED)test('does not fetch or trust exact unused external program '+url,async()=>{
 const r=replay(undefined,{forbidURLs:[url]}),jobs=await r.promise,evidence=jobs.nativeCollectionEvidence,excluded=evidence.unrequestedExternalPrograms
 assert.equal(jobs.length,2);assert.equal(r.calls.length,130);assert.deepEqual(r.misses,[]);assert.ok(!r.calls.some(call=>UNREQUESTED.includes(call.url)))
 assert.deepEqual(excluded.exactURLs,UNREQUESTED);assert.equal(excluded.requested,false);assert.equal(excluded.executed,false);assert.equal(excluded.suppliesExtractedMetadata,false);assert.equal(excluded.programEquivalenceClaimed,false);assert.equal(excluded.renderedExecutionQualified,false)
 assert.ok(excluded.openingOriginalDeclarations.some(declaration=>declaration.resourceURL===url));assert.deepEqual(excluded.openingOriginalDeclarations,excluded.closingOriginalDeclarations)
 assert.ok(excluded.openingOriginalDeclarations.every(declaration=>declaration.originalDeclaration.tag==='script'&&declaration.sourceNormalizedSHA256===profile.documents[declaration.sourceURL].normalizedSHA256))
 assert.equal(evidence.verifiedZero,false);assert.equal(evidence.sourceScopeComplete,false);assert.equal(evidence.lifecycleCleanupAllowed,false)
})
test('unused opaque corporate script declaration remains exact authored authority',async()=>{await held((p,url)=>{if(url===profile.corporate)p.body=p.body.replace('/Xmlu/Y1Eje/3UNNxk','/Xmlu/Y1Eje/UNKNOWN')})})
test('unused corporate GTM account declaration remains exact authored authority',async()=>{await held((p,url)=>{if(url===profile.corporate)p.body=p.body.replaceAll('GTM-MDKXBGH','GTM-UNKNOWN')})})
test('closing-only unused native GTM declaration change holds original full native context',async()=>{await held((p,url,index)=>{if(url===FIRST&&index===1)p.body=p.body.replaceAll('GTM-W8W92P','GTM-UNKNOWN')})})
test('unused corporate script unknown DATA attributes hold full authored context',async()=>{await held((p,url)=>{if(url===profile.corporate)p.body=p.body.replace('src="/z8dY/','data-unknown-control="true" src="/z8dY/')})})
test('closing-only full native job application program drift holds',async()=>{const url=profile.assetURLs.find(url=>url.endsWith('/script/portal/job.js'));await held((p,u,index)=>{if(u===url&&index===1)p.body+='\nwindow.nativeApplicationUnavailable=true;'} )})
test('closing-only whole native stylesheet drift holds',async()=>{const url=profile.assetURLs.find(url=>url.endsWith('/css/icims.blue.ranked.css'));await held((p,u,index)=>{if(u===url&&index===1)p.body+='\n.iCIMS_JobContent{display:none}'} )})
test('native public EU residency checkbox original VALUE is retained',async()=>{await held((p,url)=>{if(url===profile.roleModels[0].applicationURL)p.body=p.body.replace(/(name="eu_resident"[^>]*value=")1/, '$10')})})
test('unavailable declared locale resource remains an explicit hold, never rendered-operation qualification',async()=>{const r=replay();const jobs=await r.promise;assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.sourceRenderedApplicationQualified===false));assert.equal(jobs.nativeCollectionEvidence.unavailableDeclaredResources[0].status,404);assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)})
test('an unexpected outage of a previously available declared client holds',async()=>{const url=profile.assetURLs.find(url=>url.endsWith('/script/portal/job.js'));await held((p,u)=>{if(u===url)p.status=503})})
test('external opaque caller abort is preserved by identity before any network',async()=>{const reason=Object.freeze({opaque:true}),controller=new AbortController();controller.abort(reason);const r=replay(undefined,{signal:controller.signal});await assert.rejects(r.promise,e=>e===reason);assert.equal(r.calls.length,0)})
test('external opaque caller abort during native body read cancels and releases exactly once',async()=>{
 const reason=Object.freeze({opaque:true}),controller=new AbortController();let cancel=0,release=0
 const original=grouped.get(profile.corporate)[0]
 const fetchImpl=async()=>({status:200,url:profile.corporate,headers:new Headers(original.headers),body:{getReader(){return{read(){controller.abort(reason);return new Promise(()=>{})},cancel(){cancel++},releaseLock(){release++}}}}})
 const r=replay(undefined,{signal:controller.signal,fetchImpl});await assert.rejects(r.promise,e=>e===reason);assert.equal(cancel,1);assert.equal(release,1)
})
test('decorated typed array cannot bypass intrinsic 4MB source bound',async()=>{
 let reads=0,cancel=0,release=0;const bytes=new Uint8Array(4000001);Object.defineProperty(bytes,'byteLength',{value:1})
 const original=grouped.get(profile.corporate)[0]
 const fetchImpl=async()=>({status:200,url:profile.corporate,headers:new Headers(original.headers),body:{getReader(){return{async read(){reads++;return{done:false,value:bytes}},cancel(){cancel++},releaseLock(){release++}}}}})
 const r=replay(undefined,{fetchImpl});await assert.rejects(r.promise,/byte bound/);assert.equal(reads,1);assert.equal(cancel,1);assert.equal(release,1)
})
test('bounded source deadline disposes a late native response body',async()=>{let cancel=0;const original=grouped.get(profile.corporate)[0],r=replay(undefined,{sourceDeadlineMs:5,fetchImpl:async()=>new Promise(resolve=>setTimeout(()=>resolve({status:200,url:profile.corporate,headers:new Headers(original.headers),body:{cancel(){cancel++}}}),30))});await assert.rejects(r.promise,/deadline/);await new Promise(resolve=>setTimeout(resolve,45));assert.equal(cancel,1)})
test('genuine earlier native frame close holds while canonical timestamp is still future',()=>{
 const model=profile.roleModels[1],clock='2026-11-29T19:00:00.000Z'
 assert.ok(Date.parse(model.originalJobPosting.validThrough)>Date.parse(clock))
 assert.ok(model.originalNativeDateContexts.some(context=>Date.parse(context.originalValidThrough)<Date.parse(clock)))
 assert.throws(()=>validateCurrentRealPageDateWindow(model.originalJobPosting,model,clock),/known native closing/)
})
test('genuine earlier canonical close holds while frame timestamp is still future',()=>{
 const model=profile.roleModels[0],clock='2026-11-19T06:00:00.000Z'
 assert.ok(model.originalNativeDateContexts.some(context=>Date.parse(context.originalValidThrough)>Date.parse(clock)))
 assert.throws(()=>validateCurrentRealPageDateWindow(model.originalJobPosting,model,clock),error=>error.failureKind==='coverage_gap')
})
test('earliest observed native closing guard preserves exact unresolved contexts',()=>{
 const model=profile.roleModels[1],result=validateCurrentRealPageDateWindow(model.originalJobPosting,model,'2026-11-29T18:29:59.000Z')
 assert.equal(result.earliestObservedNativeClosingGuard,'2026-11-29T18:30:00.000Z');assert.deepEqual(result.originalNativeDateContexts,model.originalNativeDateContexts);assert.equal(result.sourceDateSemanticsUnresolved,true);assert.equal(result.runtimeFrameReadsPerformed,false)
})

const OLD_AGE='4 weeks ago<span class="sr-only">(10/18/2026 10:13 AM)</span></span>',CURRENT_AGE='1 month ago<span class="sr-only">(10/18/2026 10:13 AM)</span></span>'
test('genuine current relative display age preserves full native metadata positives and all raw labels',async()=>{
 const r=replay(undefined,{currentBoard:true}),jobs=await r.promise
 assert.equal(jobs.length,2);assert.deepEqual(r.misses,[]);assert.equal(r.calls.length,130)
 const card=jobs.nativeCollectionEvidence.nativeRows.find(row=>row.id==='14274');assert.ok(card.originalCardText.includes('1 month ago (10/18/2026 10:13 AM)'));assert.ok(jobs.every(job=>job.postingDate===null&&job.closingDate===null))
 assert.equal(jobs.nativeCollectionEvidence.uninterpretedNativeRelativeAgeDisplays.opening.relativeDisplayText,'1 month ago');assert.equal(jobs.nativeCollectionEvidence.uninterpretedNativeRelativeAgeDisplays.scalarDateInferred,false)
})
test('genuine closing-only relative display age tick does not discard unchanged own full roles',async()=>{
 const r=replay(undefined,{currentBoard:true,currentBoardClosingOnly:true}),jobs=await r.promise
 assert.equal(jobs.length,2);assert.deepEqual(r.misses,[])
 const evidence=jobs.nativeCollectionEvidence;assert.equal(evidence.uninterpretedNativeRelativeAgeDisplays.opening.relativeDisplayText,'4 weeks ago');assert.equal(evidence.uninterpretedNativeRelativeAgeDisplays.closing.relativeDisplayText,'1 month ago')
 assert.ok(evidence.nativeRows.find(row=>row.id==='14274').originalCardText.includes('4 weeks ago'));assert.ok(evidence.closingNativeRows.find(row=>row.id==='14274').originalCardText.includes('1 month ago'))
})
for(const [name,change]of [
 ['unknown relative carrier attributes',p=>{p.body=p.body.replace('<span title="10/18/2026 10:13 AM">','<span title="10/18/2026 10:13 AM" data-unknown="true">')}],
 ['relative carrier absolute title timestamp change',p=>{p.body=p.body.replace('<span title="10/18/2026 10:13 AM">','<span title="10/17/2026 10:13 AM">')}],
 ['relative carrier absolute sr-only timestamp change',p=>{p.body=p.body.replace(CURRENT_AGE,CURRENT_AGE.replace('(10/18/2026 10:13 AM)','(10/17/2026 10:13 AM)'))}],
 ['extra native values within relative age carrier',p=>{p.body=p.body.replace(CURRENT_AGE,CURRENT_AGE.replace('</span></span>','</span><span>Additional mandatory licence.</span></span>'))}],
 ['criterion inside relative display text',p=>{p.body=p.body.replace(CURRENT_AGE,CURRENT_AGE.replace('1 month ago','1 month ago Mandatory licence required.'))}],
 ['unrelated full card criterion drift beside passive age',p=>{p.body=p.body.replace('Make an Impact with RealPage','Mandatory licence required. Make an Impact with RealPage')}],
 ['another card posted-date display is not generally projected',p=>{p.body=p.body.replace(/(Posted Date<\/span>\n<span title="[^"]+">\n)([^<]+)(<span class="sr-only">)/,'$19 years ago$3')}]
])test('holds '+name+' while retaining genuine current board',async()=>{await held((p,url)=>{if(url===profile.board)change(p)},{currentBoard:true})})
test('dated native board exact original absolute timestamp and card remain genuine',()=>{
 const old=body(grouped.get(profile.board)[0]),current=body(fixture.supplementalCurrentAuthorityPackets[0]);assert.equal(old.split(OLD_AGE).length,2);assert.equal(old.replace(OLD_AGE,CURRENT_AGE),current)
})
test('native role that reaches earliest known close during the two passes is held at completion',async()=>{
 let clocks=0
 const r=replay(undefined,{now:()=>new Date(clocks++===0?'2026-11-19T04:59:59.000Z':'2026-11-19T05:00:00.000Z')})
 let jobs=[],error;try{jobs=await r.promise}catch(e){error=e}
 assert.deepEqual(r.misses,[]);assert.equal(r.calls.length,130);assert.equal(jobs.length,0);assert.equal(error?.failureKind,'coverage_gap');assert.match(error?.message||'',/known native closing/);assert.equal(clocks,2)
})
