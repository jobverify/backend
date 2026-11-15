import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const grouped=new Map()
for(const packet of fixture.packets){if(!grouped.has(packet.requestedURL))grouped.set(packet.requestedURL,[]);grouped.get(packet.requestedURL).push(packet)}

async function replay({change,intercept,options={}}={}){
 const counts=new Map(),calls=[],mutations=[]
 const fetchImpl=async(value,init)=>{
  const url=String(value),visit=counts.get(url)??0;counts.set(url,visit+1)
  const packet=structuredClone(grouped.get(url)?.[visit])
  assert.ok(packet,'Exact genuine current packet missing '+url+' #'+visit)
  const bytes=Buffer.from(packet.bodyBase64,'base64'),original=bytes.toString('utf8');packet.body=original
  const before=JSON.stringify(packet)
  change?.(packet,{url,visit})
  if(JSON.stringify(packet)!==before)mutations.push({url,visit})
  calls.push({url,visit,init})
  const intercepted=await intercept?.({packet,url,visit,init,calls})
  if(intercepted)return intercepted
  const response=new Response(packet.body===original?bytes:packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.url});return response
 }
 const previous=globalThis.fetch;globalThis.fetch=fetchImpl
 try{return{jobs:await run({fetchImpl,requestIntervalMs:0,now:()=>fixture.capturedAt,...options}),calls,mutations}}finally{globalThis.fetch=previous}
}

test('linked full Word criteria remain held without borrowing the inline overview',async()=>{
 const {jobs}=await replay()
 for(const [nativeID,count]of [['84167',3],['84154',2]]){
  assert.equal(jobs.some(j=>j.sourceNativeIdentifier===nativeID),false,'Current linked full Word criteria are not publicly qualified')
  const held=jobs.nativeCollectionEvidence.heldRows.find(r=>r.nativeID===nativeID)
  assert.equal(held.reason,'linked-full-job-description-unqualified')
  assert.equal(held.authoredRoleLinks.length,count)
  assert.ok(held.authoredRoleLinks.every(r=>r.attrs.href.startsWith('https://kpitc-my.sharepoint.com/')&&r.attrs.href.includes('.docx&action=default')))
  assert.equal(held.originalNativeRecord.job.status,'Published')
  assert.equal(held.originalNativeRecord.job.country,'India')
  assert.equal(held.originalNativeCard.nativeID,nativeID)
 }
})

test('native alternative Superset registration remains held with its original eligibility and agreement',async()=>{
 const {jobs}=await replay(),nativeID='82118'
 assert.equal(jobs.some(j=>j.sourceNativeIdentifier===nativeID),false,'Alternative native application identity has not been proved')
 const held=jobs.nativeCollectionEvidence.heldRows.find(r=>r.nativeID===nativeID)
 assert.equal(held.reason,'native-alternative-application-unqualified')
 assert.equal(held.authoredRoleLinks.length,1)
 assert.equal(held.authoredRoleLinks[0].attrs.href,'https://app.joinsuperset.com/join/#/signup/student/jobprofiles/7cefc520-f883-4672-8a9b-7c94498eed1c')
 for(const criterion of ['3.2 LPA','60% throughout academic career','2025/2026','service agreement of 2 years'])assert.ok(held.fullNativeCriteria.includes(criterion))
 assert.equal(held.nativeApplicationURL,'https://talentojo.kpit.com/tojo/app/job-apply/#/Career%20Portal/82118')
})

test('all sixteen authored hyperlink inventories retain every original destination and attribute in both reads',async()=>{
 const {jobs}=await replay(),evidence=jobs.nativeCollectionEvidence
 const expected=evidence.openingModels.map(payload=>{
  const d=readNativeDocument(payload.job.description)
  return{nativeID:payload.job.id,links:d.nodes(n=>n.tag==='a').map(node=>({text:d.text(node),attrs:node.attrs}))}
 })
 assert.equal(expected.length,16)
 assert.equal(expected.reduce((n,r)=>n+r.links.length,0),6)
 assert.deepEqual(evidence.authoredRoleLinks,expected)
 assert.deepEqual(evidence.closingAuthoredRoleLinks,expected)
 assert.equal(evidence.openingModels.length,16)
 assert.equal(evidence.closingModels.length,16)
})

test('only the thirteen independently full link-free native models qualify while all current cards remain raw',async()=>{
 const {jobs,calls}=await replay(),held=['84167','84154','82118']
 assert.equal(jobs.length,13)
 assert.deepEqual(jobs.map(j=>j.sourceNativeIdentifier),fixture.cohort.roles.map(url=>url.split('/').at(-1)).filter(id=>!held.includes(id)))
 assert.equal(jobs.nativeCollectionEvidence.nativeRows.length,16)
 assert.equal(jobs.nativeCollectionEvidence.closingNativeRows.length,16)
 assert.equal(jobs.nativeCollectionEvidence.heldRows.length,3)
 assert.equal(calls.length,184)
 assert.ok(jobs.every(j=>j.sourceDetailComplete&&j.sourceNativeAuthoredLinks.length===0))
})

test('current original KPIT publisher and declared native client qualify thirteen full own India roles',async()=>{
 const {jobs,calls}=await replay()
 assert.equal(jobs.length,13)
 assert.equal(jobs[0].company,'KPIT')
 assert.equal(jobs[0].sourceNativeIdentifier,'83929')
 assert.equal(jobs[0].country,'India')
 assert.ok(jobs[0].jobDescription.includes('Adaptive AUTOSAR'))
 assert.ok(jobs[0].jobDescription.includes('within 30 days'))
 assert.equal(calls.length,184)
 assert.ok(calls.every(c=>c.init.method==='GET'&&c.init.redirect==='manual'&&c.init.credentials==='omit'))
 assert.equal(jobs.nativeCollectionEvidence.nativeRows.length,16)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 const trainee=jobs.nativeCollectionEvidence.heldRows.find(j=>j.nativeID==='82118').originalNativeRecord.job
 assert.equal(trainee.code,'Technical Author (Mechanical Engineering)')
 assert.ok(jobs.every(j=>j.requisitionId===null))
 assert.ok(jobs.every(j=>j.postingDate===null&&j.closingDate===null&&j.sourceDateSemanticsUnresolved))
 assert.equal(trainee.created_at,'2026/06/11')
 assert.ok(calls.every(c=>!c.url.includes('/job_applications')&&!c.url.includes('/login')&&!c.url.includes('mktdplp102cdn')))
 for(const job of jobs){
  assert.equal(job.sourceNativeRecord.organization.id,133)
  assert.equal(job.sourceNativeRecord.job.organization_id,'133')
  assert.ok(job.jobDescription.includes(job.sourceNativeFullCriteria))
  const comments=job.sourceNativeRecord.job.comments
  if(comments)assert.ok(job.jobDescription.includes(comments),'all original notice-period and location alternatives retained')
  assert.equal(job.sourceNativeApplication.submissionPerformed,false)
  assert.equal(job.sourceNativeApplication.renderedApplicationQualified,false)
 }
})

const LIST=fixture.listingURL,CAREER=fixture.cohort.careerURL,ROLE='https://talentojo.kpit.com/service/jobs/83929'
const CONTROLLER='https://talentojo.kpit.com/tojo/app/job-apply/outside_job_apply_controller.js?v=1.0.2'
const MODEL_MARKER='Applicants must hold a cryptography doctorate before applying.'
const editModel=fn=>p=>{const data=JSON.parse(p.body);fn(data);p.body=JSON.stringify(data)}
const GTAG='https://www.googletagmanager.com/gtag/js?id=G-KMX4WXMZV6'
const FONT_STYLE='https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700'
const UNEXECUTED=[GTAG,FONT_STYLE]
const latestObservedAnalytics=fixture.unexecutedResourceObservations.find(p=>p.requestedURL===GTAG)
const latestAnalyticsResponse=()=>{const response=new Response(Buffer.from(latestObservedAnalytics.bodyBase64,'base64'),{status:latestObservedAnalytics.status,headers:latestObservedAnalytics.headers});Object.defineProperty(response,'url',{value:latestObservedAnalytics.url});return response}
const FORM_LOADER='https://cxppusa1formui01cdnsa01-endpoint.azureedge.net/ind/FormLoader/FormLoader.bundle.js'
const currentFormLoader=fixture.reviewedResponseHeaderVariants.find(p=>p.requestedURL===FORM_LOADER)
const installCurrentFormLoader=packet=>{Object.assign(packet,structuredClone(currentFormLoader));packet.body=Buffer.from(currentFormLoader.bodyBase64,'base64').toString('utf8')}

for(const mode of ['both','closing'])test('genuine exact second form-loader header set '+mode+' retains thirteen full native roles',async()=>{
 const {jobs,mutations}=await replay({change:(packet,{url,visit})=>{if(url===FORM_LOADER&&(mode==='both'||visit===1))installCurrentFormLoader(packet)}})
 assert.equal(jobs.length,13);assert.equal(jobs.nativeCollectionEvidence.heldRows.length,3)
 assert.equal(mutations.length,mode==='both'?2:1)
})

for(const [name,url,change]of[
 ['unreviewed cache value',FORM_LOADER,p=>{p.headers['x-cache-info']='L2_T9'}],
 ['new policy header',FORM_LOADER,p=>{p.headers['content-security-policy']="script-src 'none'"}],
 ['new program MIME',FORM_LOADER,p=>{p.headers['content-type']='text/plain'}],
 ['different program bytes',FORM_LOADER,p=>{p.body+='\nwindow.roleClosed=true;'}],
 ['same cache value at another URL',CONTROLLER,p=>{p.headers['x-cache-info']='L1_T2'}],
])test('form-loader header contract cannot admit '+name,async()=>{
 let edits=0
 await assert.rejects(()=>replay({change:(packet,ctx)=>{
  if(ctx.url!==url)return
  if(url===FORM_LOADER)installCurrentFormLoader(packet)
  const before=JSON.stringify(packet);change(packet);if(JSON.stringify(packet)!==before)edits++
 }}),error=>error.softFailure===true)
 assert.ok(edits>0)
})

test('genuine unrelated analytics build churn cannot gate the native API-only publication',async()=>{
 let analyticsReads=0
 const {jobs,calls}=await replay({intercept:({url})=>{if(url===GTAG){analyticsReads++;return latestAnalyticsResponse()}}})
 assert.equal(latestObservedAnalytics.sha256,'ecdf36e80aeee7b54cdbce05e9ce18e5500e8c1b0f91c2ff6f85b47ee6f9b207')
 assert.equal(jobs.length,13);assert.equal(jobs.nativeCollectionEvidence.heldRows.length,3)
 assert.equal(jobs.nativeCollectionEvidence.openingModels.length,16)
 assert.equal(jobs.nativeCollectionEvidence.closingModels.length,16)
 assert.equal(calls.length,184);assert.equal(analyticsReads,0)
 assert.ok(calls.every(c=>!UNEXECUTED.includes(c.url)))
 const ignored=jobs.nativeCollectionEvidence.unexecutedDeclaredResources
 assert.deepEqual(ignored.map(r=>r.url),UNEXECUTED)
 assert.ok(ignored.every(r=>!r.requested&&!r.executed&&!r.usedAsRoleData))
 assert.deepEqual(ignored.map(r=>r.declarations.length),[2,1])
 assert.deepEqual(jobs.nativeCollectionEvidence.closingUnexecutedDeclaredResources,ignored)
 assert.ok(jobs.every(j=>!j.sourceNativeApplication.renderedApplicationQualified))
})

for(const ignoredURL of UNEXECUTED)test('unexecuted resource '+ignoredURL+' starts no request or body read',async()=>{
 let excludedRequests=0
 const {jobs}=await replay({intercept:({url})=>{if(url===ignoredURL){excludedRequests++;throw Error('Unexecuted third-party transport must not start')}}})
 assert.equal(jobs.length,13);assert.equal(excludedRequests,0)
})

test('native publication and exact retained form-loader headers coexist without analytics or font requests',async()=>{
 const {jobs,mutations,calls}=await replay({change:(p,{url})=>{if(url===FORM_LOADER)installCurrentFormLoader(p)},intercept:({url})=>{if(UNEXECUTED.includes(url))throw Error('Excluded request')}})
 assert.equal(jobs.length,13);assert.equal(jobs.nativeCollectionEvidence.heldRows.length,3)
 assert.equal(mutations.length,2);assert.equal(calls.length,184)
})

for(const visit of [0,1])for(const [name,url,change]of[
 ['analytics declaration URL',CAREER,p=>{p.body=p.body.replace(GTAG,GTAG+'-another-account')}],
 ['analytics declaration mode',CAREER,p=>{p.body=p.body.replace('<script async src="'+GTAG+'"','<script type="application/json" async src="'+GTAG+'"')}],
 ['font declaration mode',fixture.cohort.roles[0],p=>{p.body=p.body.replace("href='"+FONT_STYLE+"'","media='print' href='"+FONT_STYLE+"'")}],
])test((visit?'closing':'opening')+' retains authored '+name+' despite unexecuted body independence',async()=>{
 let edits=0
 await assert.rejects(()=>replay({change:(packet,{url:requested,visit:seen})=>{
  if(requested!==url||seen!==visit)return
  const before=packet.body;change(packet);if(packet.body!==before)edits++
 },intercept:({url})=>UNEXECUTED.includes(url)?latestAnalyticsResponse():undefined}),error=>error.softFailure===true)
 assert.equal(edits,1,'The authored declaration edit must reach its genuine document')
})

for(const visit of [0,1])for(const [name,url,change]of[
 ['country',ROLE,editModel(d=>{d.job.country='United States'})],
 ['employer account',ROLE,editModel(d=>{d.organization.id=144})],
 ['current Published status',ROLE,editModel(d=>{d.job.status='Closed'})],
 ['complete required criteria',ROLE,editModel(d=>{d.job.qualifications=MODEL_MARKER})],
 ['native declared controller',CONTROLLER,p=>{p.body+='\nwindow.roleClosed=true;'}],
 ['native full-description template', 'https://talentojo.kpit.com/tojo/app/job-apply/job_detail.html',p=>{p.body=p.body.replace('printHTML(job.description)','printHTML(job.summary)')}],
])test((visit?'closing':'opening')+' native '+name+' still fails amid unrelated analytics churn',async()=>{
 let edits=0,excludedRequests=0
 await assert.rejects(()=>replay({change:(packet,ctx)=>{
  if(ctx.url!==url||ctx.visit!==visit)return
  const before=packet.body;change(packet);if(packet.body!==before)edits++
 },intercept:({url})=>{if(UNEXECUTED.includes(url)){excludedRequests++;return latestAnalyticsResponse()}}}),error=>error.softFailure===true)
 assert.equal(edits,1);assert.equal(excludedRequests,0)
})

for(const phase of [0,1])for(const [name,nativeID,mutate]of[
 ['linked Word full-JD destination','84167',d=>{d.job.description=d.job.description.replaceAll('7C804536-B0F0-4A52-83BF-54ED924CE80E','7C804536-B0F0-4A52-83BF-54ED924CE80F')}],
 ['native alternative application identity','82118',d=>{d.job.description=d.job.description.replaceAll('7cefc520-f883-4672-8a9b-7c94498eed1c','7cefc520-f883-4672-8a9b-7c94498eed1d')}],
 ['new external full criteria on a previously qualified model','83929',d=>{d.job.description+='<p><a href="https://www.kpit.com/mandatory-new-criteria.docx">Full mandatory job description</a></p>'}],
])test((phase?'closing':'opening')+' '+name+' cannot be silently omitted even from held models',async()=>{
 let edits=0
 await assert.rejects(()=>replay({change:(packet,{url,visit})=>{
  if(url!=='https://talentojo.kpit.com/service/jobs/'+nativeID||visit!==phase)return
  const before=packet.body;editModel(mutate)(packet);if(packet.body!==before)edits++
 }}),error=>error.softFailure===true&&error.lifecycleCleanupAllowed===false)
 assert.equal(edits,1,'Changed authored href must reach the selected genuine native model')
})

test('fresh unique coupled language-control IDs retain both independent current surfaces',async()=>{
 const {jobs,mutations}=await replay({change:(p,{url,visit})=>{
  if(![CAREER,LIST].includes(url))return
  const ids=[...new Set([...p.body.matchAll(/trp-shortcode-dropdown-[a-f0-9]{13}/g)].map(m=>m[0]))]
  ids.forEach((id,index)=>{p.body=p.body.replaceAll(id,'trp-shortcode-dropdown-'+String(visit+1)+String(index+1)+'a'.repeat(11))})
 }})
 assert.equal(jobs.length,13);assert.equal(mutations.length,4)
})

for(const [name,url,mutate]of[
 ['native foreign country',ROLE,editModel(d=>{d.job.country='United States'})],
 ['missing native country cannot borrow India from the filter or city',ROLE,editModel(d=>{delete d.job.country})],
 ['new native country carrier',ROLE,editModel(d=>{d.job.address={addressCountry:'United States'}})],
 ['wrong native employer',ROLE,editModel(d=>{d.organization.name='Another Company'})],
 ['wrong native employer URL',ROLE,editModel(d=>{d.organization.url='https://another.example'})],
 ['wrong native employer ID',ROLE,editModel(d=>{d.job.organization_id='144'})],
 ['wrong native role ID',ROLE,editModel(d=>{d.job.id='84155'})],
 ['wrong complete native title',ROLE,editModel(d=>{d.job.title='Another role'})],
 ['native unpublished role',ROLE,editModel(d=>{d.job.status='Closed'})],
 ['native upload availability limit',ROLE,editModel(d=>{d.job.resume_upload_limit_exhausted=true})],
 ['blank native full description',ROLE,editModel(d=>{d.job.description=' '})],
 ['nonstring native full description',ROLE,editModel(d=>{d.job.description={text:'Full role'}})],
 ['short native introduction cannot borrow the skills teaser',ROLE,editModel(d=>{d.job.description='<p>Join our team.</p>'})],
 ['new mandatory qualification outside original description',ROLE,editModel(d=>{d.job.qualifications=MODEL_MARKER})],
 ['changed original native notice period',ROLE,editModel(d=>{d.job.comments='Location: Pune, United States. '+MODEL_MARKER})],
 ['hidden required native criterion',ROLE,editModel(d=>{d.job.description+='<section hidden>'+MODEL_MARKER+'</section>'})],
 ['nontext native criterion carrier',ROLE,editModel(d=>{d.job.description+='<data itemprop="qualifications" value="'+MODEL_MARKER+'"></data>'})],
 ['duplicate country JSON',ROLE,p=>{p.body=p.body.replace('"country":"India"','"country":"United States","country":"India"')}],
 ['own card points to another native account',LIST,p=>{p.body=p.body.replaceAll('talentojo.kpit.com','talentojo.foreign.example')}],
 ['own country selector changes',LIST,p=>{p.body=p.body.replace(/(<option value="India")\s+selected='selected'/,'$1')}],
 ['own current visible availability contradicts the role',LIST,p=>{p.body=p.body.replace('</body>','<p>This position is currently unavailable.</p></body>')}],
 ['new hidden current native qualification control',LIST,p=>{p.body=p.body.replace('</body>','<input hidden required value="'+MODEL_MARKER+'"></body>')}],
 ['own Apply becomes disabled',LIST,p=>{p.body=p.body.replace('id="apply-job-kpit"','id="apply-job-kpit" aria-disabled="true"')}],
 ['current native country filter no longer declared',LIST,p=>{p.body=p.body.replace('id="filter-form"','id="old-filter-form"')}],
 ['whole current role client receives a new activation',CONTROLLER,p=>{p.body+='\nwindow.roleClosed=true;'}],
 ['current inline module activation added',LIST,p=>{p.body=p.body.replace('</head>','<script type="module">window.roleClosed=true</script></head>')}],
 ['stylesheet mode becomes print only',LIST,p=>{p.body=p.body.replace('rel="stylesheet"','rel="stylesheet" media="print"')}],
 ['corporate publisher handoff hidden',CAREER,p=>{p.body=p.body.replace('>Open Positions</a>',' hidden>Open Positions</a>')}],
 ['corporate publisher identity changes',CAREER,p=>{p.body=p.body.replace('property="og:site_name" content="KPIT"','property="og:site_name" content="Foreign"')}],
 ['effective CSP changes',ROLE,p=>{p.headers['content-security-policy']="default-src 'none'"}],
 ['new effective response context',ROLE,p=>{p.headers.refresh='0;url=https://another.example'}],
 ['native response MIME changes',ROLE,p=>{p.headers['content-type']='text/plain'}],
 ['native response identity changes',ROLE,p=>{p.url=LIST}],
 ['ordinary native denial',ROLE,p=>{p.status=403;p.body='Denied'}],
])test(name+' keeps the source unresolved',async()=>{
 let edits=0
 await assert.rejects(()=>replay({change:(p,ctx)=>{if(ctx.url!==url)return;const before=JSON.stringify(p);mutate(p);if(JSON.stringify(p)!==before)edits++}}),error=>error.softFailure===true&&error.lifecycleCleanupAllowed===false)
 assert.ok(edits>0,'Adverse edit must reach genuine published bytes')
})

for(const [name,url,mutate]of[
 ['complete native criterion',ROLE,editModel(d=>{d.job.description+='<p>'+MODEL_MARKER+'</p>'})],
 ['native employer identity',ROLE,editModel(d=>{d.organization.name='Another Company'})],
 ['native country alternative',ROLE,editModel(d=>{d.job.country='India / United States'})],
 ['native published availability',ROLE,editModel(d=>{d.job.status='Withdrawn'})],
 ['native control value',LIST,p=>{p.body=p.body.replace('</body>','<input required value="'+MODEL_MARKER+'"></body>')}],
 ['corporate publisher',CAREER,p=>{p.body=p.body.replace('>Open Positions</a>','>Closed</a>')}],
 ['full role handler',CONTROLLER,p=>{p.body+='\nwindow.roleClosed=true;'}],
 ['declared native style','https://talentojo.kpit.com/tojo/app/css/app.css',p=>{p.body+='\n.cp-job-desc{display:none}'}],
])test('independent closing rejects '+name,async()=>{
 let edits=0
 await assert.rejects(()=>replay({change:(p,ctx)=>{if(ctx.url===url&&ctx.visit===1){const before=JSON.stringify(p);mutate(p);if(JSON.stringify(p)!==before)edits++}}}),error=>error.softFailure===true)
 assert.ok(edits>0)
})

for(const variant of ['duplicate','crossed','missing','new-script-literal'])test('language-control binding '+variant+' cannot normalize authority drift',async()=>{
 let edits=0
 await assert.rejects(()=>replay({change:(p,{url})=>{
  if(url!==LIST)return
  const ids=[...new Set([...p.body.matchAll(/trp-shortcode-dropdown-[a-f0-9]{13}/g)].map(m=>m[0]))]
  const before=p.body
  if(variant==='duplicate')p.body=p.body.replaceAll(ids[1],ids[0])
  if(variant==='crossed')p.body=p.body.replace('aria-controls="'+ids[0]+'"','aria-controls="'+ids[1]+'"')
  if(variant==='missing')p.body=p.body.replace('id="'+ids[0]+'"','id="no-language-control"')
  if(variant==='new-script-literal')p.body=p.body.replace('</head>','<script>window.languageID="'+ids[0]+'"</script></head>')
  if(before!==p.body)edits++
 }}),error=>error.softFailure===true)
 assert.ok(edits>0)
})

for(const reason of [Object.freeze(new Error('caller-stop')),'opaque-caller-stop'])test('pre-aborted caller '+typeof reason+' retains exact reason',async()=>{
 const controller=new AbortController();controller.abort(reason);let calls=0
 await assert.rejects(()=>run({signal:controller.signal,fetchImpl:()=>{calls++;throw Error('Unexpected GET')}}),e=>e===reason)
 assert.equal(calls,0)
})

for(const reason of [Object.freeze(new Error('in-flight-stop')),'opaque-in-flight-stop'])test('in-flight caller '+typeof reason+' cancels a late response',async()=>{
 const controller=new AbortController();let resolveRead,canceled=0
 const promise=run({signal:controller.signal,requestIntervalMs:0,fetchImpl:()=>new Promise(resolve=>{resolveRead=resolve;setTimeout(()=>controller.abort(reason),5)})})
 await assert.rejects(()=>promise,e=>e===reason)
 const response=new Response(new ReadableStream({cancel(){canceled++}}),{headers:{'content-type':'text/html'}})
 Object.defineProperty(response,'url',{value:fixture.entryURL});resolveRead(response)
 await new Promise(r=>setTimeout(r,15));assert.equal(canceled,1)
})

const streamResponse=(packet,{onRead=()=>{},onCancel=()=>{},onRelease=()=>{},chunk}={})=>({status:packet.status,url:packet.url,headers:new Headers(packet.headers),body:{cancel:onCancel,getReader(){return{read(){onRead();return chunk?Promise.resolve({done:false,value:chunk}):new Promise(()=>{})},cancel:onCancel,releaseLock:onRelease}}}})
test('intrinsic source-byte cap rejects a spoofed oversized chunk before buffering',async()=>{
 let canceled=0,released=0,reads=0
 const chunk=new Uint8Array(4000001);Object.defineProperty(chunk,'byteLength',{value:0})
 await assert.rejects(()=>run({sourceDeadlineMs:100,requestIntervalMs:0,fetchImpl:async()=>{reads++;return streamResponse(grouped.get(fixture.entryURL)[0],{chunk,onCancel:()=>{canceled++},onRelease:()=>{released++}})}}),/streaming byte bound/)
 assert.equal(reads,1);assert.equal(canceled,1);assert.equal(released,1)
})
test('uncooperative native body settles and releases at the bounded source deadline',async()=>{
 let canceled=0,released=0,reads=0
 await assert.rejects(()=>run({sourceDeadlineMs:25,requestIntervalMs:0,fetchImpl:async()=>{reads++;return streamResponse(grouped.get(fixture.entryURL)[0],{onCancel:()=>{canceled++},onRelease:()=>{released++}})}}),/deadline/)
 assert.equal(reads,1);assert.equal(canceled,1);assert.equal(released,1)
})
test('first parallel asset failure stops queued work and drains the other active native body',async()=>{
 const authoritativeResources=fixture.cohort.resources.filter(url=>!UNEXECUTED.includes(url))
 const [first,second]=authoritativeResources;let resolveRead,canceled=0,released=0,assetCalls=0
 const ready=new Promise(resolve=>{resolveRead=resolve})
 await assert.rejects(()=>replay({intercept:async({packet,url})=>{
  if(authoritativeResources.includes(url))assetCalls++
  if(url===first){await ready;return{...streamResponse(packet),status:403,body:null}}
  if(url===second)return streamResponse(packet,{onRead:()=>resolveRead(),onCancel:()=>{canceled++},onRelease:()=>{released++}})
 }}),/status|URL/)
 assert.equal(assetCalls,2);assert.equal(canceled,1);assert.equal(released,1)
})
