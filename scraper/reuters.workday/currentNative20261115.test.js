import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {runReutersNative} from './currentNative.js'
import {PROFILE,readBoard,readClient,readRole,projectCriteriaAuthorityBlocks} from './nativeContract.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261115/current-http.json.gz',import.meta.url))))
const old=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-http.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex'),provider=getScraperCatalog().find(p=>p.source==='reuters')
const ownID='JREQ204519',nativeURL=PROFILE.nativePrefix+fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID).externalPath
const original=packet=>({url:packet.url,status:packet.status,headers:structuredClone(packet.headers),html:Buffer.from(packet.bodyBase64,'base64').toString('utf8')})
const packetFor=url=>fixture.packets.find(p=>p.requestedURL===url)
const pageFor=url=>original(packetFor(url))
const oldPage=phase=>{const packet=old.phases[phase].requests[0];return{url:packet.finalURL,html:Buffer.from(old.entities[packet.bodySHA256],'base64').toString('utf8')}}
function retainedIO(transform=p=>p,{cohort='current',packets=fixture.packets}={}){
 const calls=[]
 return{calls,fetchImpl:async(input,init={})=>{
  const packet=packets[calls.length];assert.ok(packet,'NETWORK TRIPWIRE extra request')
  assert.equal(String(input),packet.requestedURL);assert.equal(init.method??'GET',packet.method)
  assert.equal(sha(init.body??''),packet.requestBodySHA256);assert.deepEqual(Object.fromEntries(new Headers(init.headers)),packet.requestHeaders)
  assert.equal(init.credentials,'omit');assert.equal(init.redirect,packet.redirect)
  calls.push({url:String(input),method:init.method??'GET',body:init.body??null})
  let page=original(packet)
  if(cohort==='old'&&input===PROFILE.board)page={...page,...oldPage('board')}
  if(cohort==='old'&&input===PROFILE.client.url)page={...page,...oldPage('client')}
  page=transform(page,{input:String(input),init,sequence:calls.length,packet})
  const response=new Response(page.html,{status:page.status,headers:page.headers});Object.defineProperty(response,'url',{value:page.url});return response
 }}
}
const run=io=>runReutersNative({fetchImpl:io.fetchImpl,now:()=>fixture.observedAt})
const mutateRole=(page,change)=>{const model=JSON.parse(page.html);change(model);return{...page,html:JSON.stringify(model)}}
const currentBoard=()=>readBoard(pageFor(PROFILE.board))

test('genuine current 29-packet fixture preserves four own Reuters positives and all seven full models',async t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('No live network allowed'))
 assert.equal(fixture.packets.length,29)
 for(const packet of fixture.packets){assert.equal(sha(Buffer.from(packet.bodyBase64,'base64')),packet.bodySHA256);assert.equal(packet.status,200)}
 const io=retainedIO(),jobs=await createCatalogScraper(provider).run({fetchImpl:io.fetchImpl,now:()=>fixture.observedAt})
 assert.deepEqual(jobs.map(j=>j.jobId),fixture.expected.ownRoleIDs);assert.equal(io.calls.length,29)
 const audit=jobs.nativeCollectionEvidence;assert.equal(audit.openingDetails.length,7);assert.equal(audit.closingDetails.length,7)
 assert.deepEqual(audit.heldRoles.map(r=>r.id),fixture.expected.heldRoleIDs)
 for(const role of audit.openingDetails){const row=fixture.expected.criteria.find(r=>r.id===role.id);assert.equal(role.criteriaHTML.length,row.characters);assert.equal(sha(role.criteriaHTML),row.SHA256);assert.equal(role.complete,row.complete);assert.deepEqual(role.issues,row.issues);assert.deepEqual(role.nativeModel,audit.closingDetails.find(r=>r.id===role.id).nativeModel)}
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.nativeLegalEmployer,'IND003 Thomson Reuters India Private Ltd');assert.equal(job.legalEmployerAlias,false);assert.equal(job.applicationVisited,false);assert.equal(job.applicationAcceptanceVerified,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.applyUrl,job.sourceNativeRecord.nativeModel.jobPostingInfo.externalUrl)}
 assert.equal(readSourceObservationEvidence(jobs,'reuters').observedVacancyCount,fixture.expected.uniqueObservedRows)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(audit.companyIndiaZeroProven,false);assert.equal(audit.publisherProgramsExecuted,false)
 assert.ok(audit.receipts.every(r=>r.body&&r.headers));assert.ok(io.calls.every(c=>!c.body||!c.body.includes('token')))
})

test('complete current client remains pinned to the exact current bootstrap cohort',()=>{
 const board=currentBoard(),client=readClient(pageFor(PROFILE.client.url),board)
 assert.equal(client.bodySHA256,fixture.currentClient.SHA256);assert.equal(client.programExecuted,false);assert.equal(board.tokenUsedForRequests,false)
 assert.throws(()=>readClient({...pageFor(PROFILE.client.url),html:pageFor(PROFILE.client.url).html+'\n'},board),/client/)
 assert.throws(()=>readClient({...pageFor(PROFILE.client.url),url:fixture.currentClient.finalURL.replace('2026.45.12','2026.45.13')},board),/client/)
 assert.throws(()=>readClient(oldPage('client'),board),/client/)
 assert.throws(()=>readClient(pageFor(PROFILE.client.url),readBoard(oldPage('board'))),/client/)
})

test('both independently observed current opaque tokens change only the bounded unused literal slot',()=>{
 const pages=fixture.packets.filter(p=>p.requestedURL===PROFILE.board).map(original)
 assert.equal(pages.length,2);assert.notEqual(pages[0].html,pages[1].html)
 for(const page of pages){const board=readBoard(page);assert.equal(board.tokenUsedForRequests,false);assert.equal(board.programExecuted,false);assert.equal(board.rawHTML,page.html)}
})
for(const [label,change]of [
 ['escaped token',html=>html.replace(/(\n            token: ")[A-Za-z0-9+/]/,'$1\\u0041')],
 ['oversized token',html=>html.replace(/(\n            token: ")/,'$1'+'A'.repeat(4096))],
 ['nonliteral token',html=>html.replace('token: "','token: String("')],
 ['second token field',html=>html.replace('token: "','token: "extra", token: "')],
 ['new executable',html=>html.replace('</script>','fetch("https://unrelated.example/");</script>')],
 ['unreviewed toggle',html=>html.replace('bce501965f00100013f45b4362460000','bce501965f00100013f45b4362460001')],
 ['foreign account',html=>html.replace('tenant: "thomsonreuters"','tenant: "unrelated"')],
 ['hidden model',html=>html.replace('<script type="text/javascript">','<script hidden type="text/javascript">')],
])test('current complete bootstrap rejects '+label,()=>{const page=pageFor(PROFILE.board);const html=change(page.html);assert.notEqual(html,page.html);assert.throws(()=>readBoard({...page,html}),/bootstrap|slot|token|profile|markup/)})

for(const [label,header,value]of [
 ['redirect Refresh','refresh','0;url=https://unrelated.example/'],
 ['HTTP200 Location','location','https://unrelated.example/'],
 ['attachment disposition','content-disposition','attachment; filename=role.html'],
 ['foreign declared charset','content-type','text/html; charset=iso-8859-1'],
 ['conflicting declared charsets','content-type','text/html; charset=UTF-8; charset=iso-8859-1'],
])test('unambiguous native response metadata rejects '+label+' before model qualification',async()=>{
 const io=retainedIO((p,{sequence})=>sequence===1?{...p,headers:{...p.headers,[header]:value}}:p,{cohort:'old'})
 await assert.rejects(run(io),/header|charset|navigation|disposition/i)
 assert.equal(io.calls.length,1)
})
test('old reviewed cohort still qualifies full current native models without new countries or employer aliases',async()=>{const io=retainedIO(p=>p,{cohort:'old'});const jobs=await run(io);assert.deepEqual(jobs.map(j=>j.jobId),fixture.expected.ownRoleIDs)})

for(const [label,change,pattern]of [
 ['foreign primary country',m=>{m.jobPostingInfo.country.descriptor='United States'},/country/],
 ['foreign requisition country',m=>{m.jobPostingInfo.jobRequisitionLocation.country.alpha2Code='US'},/country/],
 ['unknown typed alternative',m=>{m.jobPostingInfo.additionalLocations=[{country:{descriptor:'India',alpha2Code:'IN'},location:'India, Bengaluru'}]},/secondary|country|worksite/],
 ['foreign typed alternative',m=>{m.jobPostingInfo.additionalLocations=[{country:{descriptor:'United States',alpha2Code:'US'},location:'United States'}]},/secondary|country|worksite/],
 ['new separate qualification carrier',m=>{m.jobPostingInfo.requiredQualifications='Professional licence mandatory.'},/unknown fields/],
 ['wrong application account',m=>{m.jobPostingInfo.externalUrl=m.jobPostingInfo.externalUrl.replace('thomsonreuters','unrelated')},/account|identity/],
 ['wrong native ID',m=>{m.jobPostingInfo.jobReqId='JREQ000000'},/identity/],
 ['hidden qualification',m=>{m.jobPostingInfo.jobDescription+='<p hidden>Mandatory certification.</p>'},/hidden|criteria/],
])test('current full role rejects '+label,()=>{const row=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID);const page=mutateRole(pageFor(nativeURL),change);assert.throws(()=>readRole(page,row,fixture.observedAt),pattern)})

test('new complete native authored criteria survive losslessly when both independent reads agree',async()=>{
 const addition='<p>Professional reporting certification is required. Preferred data-analysis expertise receives additional consideration.</p>'
 const io=retainedIO((page,{input})=>input===nativeURL?mutateRole(page,m=>{m.jobPostingInfo.jobDescription+=addition}):page),jobs=await run(io),job=jobs.find(j=>j.jobId===ownID)
 assert.ok(job.sourceDescription.endsWith(addition));assert.ok(job.jobDescription.includes('Preferred data-analysis expertise'))
 assert.equal(job.sourceDescription,job.sourceNativeClosingRecord.nativeModel.jobPostingInfo.jobDescription)
})
for(const [label,change]of [
 ['full mandatory criteria',m=>{m.jobPostingInfo.jobDescription+='<p>Additional mandatory certification.</p>'}],
 ['all original country data',m=>{m.jobPostingInfo.additionalLocations=['Unconfirmed alternate workplace']}],
 ['native employer',m=>{m.hiringOrganization.name='IND002 Thomson Reuters International Services Private Limited'}],
 ['application availability',m=>{m.jobPostingInfo.canApply=false}],
])test('independent closing rejects changed '+label,async()=>{let reads=0;const io=retainedIO((page,{input})=>input===nativeURL&&++reads===2?mutateRole(page,change):page);await assert.rejects(run(io),/changed at closing/);assert.equal(reads,2)})

test('unknown original fields cannot disappear through decoded duplicate JSON keys',()=>{const row=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),page=pageFor(nativeURL);page.html=page.html.replace('"country":','"\\u0063ountry":{"descriptor":"United States","id":"foreign"},"country":');assert.throws(()=>readRole(page,row,fixture.observedAt),/duplicate|JSON/)})
for(const notice of ['Applications are closed.','Recruitment is closed.','Applications are no longer accepted.','We are no longer accepting applications for this role.'])test('current explicit own availability notice remains an individual raw-preserving hold: '+notice,()=>{
 const row=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),page=mutateRole(pageFor(nativeURL),m=>{m.jobPostingInfo.jobDescription+='<p>'+notice+'</p>'}),role=readRole(page,row,fixture.observedAt)
 assert.equal(role.complete,false);assert.ok(role.issues.includes('native-own-role-closed-or-unavailable'));assert.ok(role.criteriaText.endsWith(notice));assert.ok(role.rawBody.includes(notice))
})
for(const notice of ['Applications are not closed.','We are still accepting applications for this role.'])test('negated or continuing availability stays active: '+notice,()=>{const row=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),page=mutateRole(pageFor(nativeURL),m=>{m.jobPostingInfo.jobDescription+='<p>'+notice+'</p>'});assert.equal(readRole(page,row,fixture.observedAt).complete,true)})
for(const [label,statement,issue]of [
 ['country','This role is based in United States.','native-criteria-workplace-declaration-unreconciled'],
 ['legal employer','Your employer will be Another Employer Limited.','native-criteria-employer-declaration-conflict'],
 ['past closing date','Applications close on 1 November 2026.','native-criteria-closing-date-conflict'],
])test('complete native criteria cannot contradict typed '+label,()=>{
 const row=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),page=mutateRole(pageFor(nativeURL),m=>{m.jobPostingInfo.jobDescription+='<p>'+statement+'</p>'}),role=readRole(page,row,fixture.observedAt)
 assert.equal(role.complete,false);assert.ok(role.issues.includes(issue));assert.ok(role.criteriaText.endsWith(statement));assert.equal(role.nativeModel.jobPostingInfo.country.descriptor,'India');assert.equal(role.nativeLegalEmployer,PROFILE.eligibleRawLegalEmployer)
})
test('new authority paragraphs need review even when text resembles typed country, employer and date',()=>{
 const row=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),statement='<p>This role is based in India.</p><p>Your employer will be '+PROFILE.eligibleRawLegalEmployer+'.</p><p>Applications close on 20 November 2026.</p>',page=mutateRole(pageFor(nativeURL),m=>{m.jobPostingInfo.jobDescription+=statement}),role=readRole(page,row,fixture.observedAt)
 assert.equal(role.complete,false);assert.ok(role.criteriaHTML.endsWith(statement));assert.ok(role.issues.includes('native-criteria-authority-block-unreviewed'))
})
for(const [statement,issue]of [
 ['This role is based in Unknown native office.','native-criteria-workplace-declaration-unreconciled'],
 ['Applications close on 21 November 2026.','native-criteria-closing-date-conflict'],
 ['Applications close on 31 November 2026.','native-criteria-closing-date-conflict'],
 ['Applications close on tomorrow.','native-criteria-closing-date-conflict'],
])test('unreconciled own authority declaration remains held without country or calendar inference: '+statement,()=>{const row=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),page=mutateRole(pageFor(nativeURL),m=>{m.jobPostingInfo.jobDescription+='<p>'+statement+'</p>'}),role=readRole(page,row,fixture.observedAt);assert.equal(role.complete,false);assert.ok(role.issues.includes(issue));assert.ok(role.rawBody.includes(statement))})
test('pending request preserves opaque caller cancellation and disposes late body',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'Reuters opaque abort'});let cancelled=0,reads=0
 const pending=runReutersNative({signal:controller.signal,fetchImpl:()=>{reads++;queueMicrotask(()=>controller.abort(reason));return new Promise(resolve=>setTimeout(()=>resolve({body:{cancel(){cancelled++}}}),5))}})
 await assert.rejects(pending,error=>error===reason);await new Promise(resolve=>setTimeout(resolve,15));assert.equal(reads,1);assert.equal(cancelled,1)
})
const paraphrasedAuthorityClaims=[
 ['geography-located','This role is located in the United States.'],
 ['geography-position','The position is based in the United States.'],
 ['geography-work-location','The primary work location for this position is United States.'],
 ['employment-legal','The legal employer for this role is Another Employer Limited.'],
 ['employment-employed','You will be employed by Another Employer Limited.'],
 ['deadline-received','Applications must be received by 1 November 2026.'],
 ['deadline-accepted','Applications will be accepted until 1 November 2026.'],
 ['deadline-apply-by','Apply by 1 November 2026.'],
 ['deadline-apply-before','Apply before 1 November 2026.'],
 ['deadline-colon','Application deadline: 1 November 2026.'],
 ['deadline-submit','Applications must be submitted by 1 November 2026.'],
]
for(const [label,claim]of paraphrasedAuthorityClaims)test('whole authority blocks hold independent-review paraphrase '+label,()=>{
 const row=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),page=mutateRole(pageFor(nativeURL),m=>{m.jobPostingInfo.jobDescription+='<p>'+claim+'</p>'}),role=readRole(page,row,fixture.observedAt)
 assert.equal(role.complete,false);assert.ok(role.issues.includes('native-criteria-authority-block-unreviewed'));assert.ok(role.criteriaText.endsWith(claim));assert.ok(role.rawBody.includes(claim))
})
for(const [label,claim]of paraphrasedAuthorityClaims.filter(([label])=>['geography-located','employment-legal','deadline-received','deadline-accepted','deadline-apply-by','deadline-apply-before'].includes(label)))test('complete stable opening and closing hold unreviewed authority '+label,async()=>{
 const io=retainedIO((page,{input})=>input===nativeURL?mutateRole(page,m=>{m.jobPostingInfo.jobDescription+='<p>'+claim+'</p>'}):page),jobs=await run(io),audit=jobs.nativeCollectionEvidence
 assert.deepEqual(jobs.map(j=>j.jobId),fixture.expected.ownRoleIDs.filter(id=>id!==ownID));assert.equal(io.calls.length,29);assert.equal(audit.openingDetails.length,7);assert.equal(audit.closingDetails.length,7);assert.equal(audit.heldRoles.length,4);assert.equal(audit.observedRecordCount,27);assert.equal(audit.observedVacancyCount,27)
 const held=audit.heldRoles.find(r=>r.id===ownID);assert.ok(held);assert.ok(held.opening.criteriaText.endsWith(claim));assert.deepEqual(held.opening.nativeModel,held.closing.nativeModel)
})
for(const claim of [
 'The hiring entity for this role is Acme Corporation.',
 'The employing company for this role is Acme Corporation.',
 'The employing entity for this role is Acme Corporation.',
 'You will work for Acme Corporation.',
 'You will be working for Acme Corporation.',
 'You will work for Acme Group.',
 'You will be working for Acme Group.',
 'Your duty station is Toronto.',
 'You will be assigned to Toronto.',
 'You will be stationed in Toronto.',
 'Submit your CV by 1 November 2026.',
 'Please send your CV no later than 1 November 2026.',
])test('full topic block guard holds neutral employer, duty or CV claim: '+claim,()=>{
 const row=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),page=mutateRole(pageFor(nativeURL),m=>{m.jobPostingInfo.jobDescription+='<p>'+claim+'</p>'}),role=readRole(page,row,fixture.observedAt)
 assert.equal(role.complete,false);assert.ok(role.issues.includes('native-criteria-authority-block-unreviewed'));assert.ok(role.criteriaText.endsWith(claim))
})
for(const claim of ['A journalism degree is required before applying.','Candidates must hold a journalism degree before applying.'])test('benign complete education requirement before applying remains lossless: '+claim,()=>{
 const row=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),addition='<p>'+claim+'</p>',page=mutateRole(pageFor(nativeURL),m=>{m.jobPostingInfo.jobDescription+=addition}),role=readRole(page,row,fixture.observedAt)
 assert.equal(role.complete,true);assert.ok(role.criteriaHTML.endsWith(addition));assert.ok(role.criteriaText.endsWith(claim))
})
for(const [label,change]of [
 ['coherent alternative India facility',m=>{m.jobPostingInfo.location='India, Mumbai';m.jobPostingInfo.jobRequisitionLocation.descriptor='India, Mumbai'}],
 ['coherent extended closing date',m=>{m.jobPostingInfo.endDate='2026-12-20';m.jobPostingInfo.jobPostingEndDateAsText='End Date: December 20, 2026'}],
 ['coherent changed employment type',m=>{m.jobPostingInfo.timeType='Part time'}],
])test('full original authority block is bound to original native context: '+label,()=>{
 const row=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),page=mutateRole(pageFor(nativeURL),change),role=readRole(page,row,fixture.observedAt)
 assert.equal(role.complete,false);assert.ok(role.issues.includes('native-criteria-authority-block-unreviewed'))
})
for(const claim of ['A journalism degree is required by Christmas before applying.','A journalism degree is required before applying by Christmas.'])test('education prerequisite cannot conceal an unreviewed calendar condition: '+claim,()=>{
 const row=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),page=mutateRole(pageFor(nativeURL),m=>{m.jobPostingInfo.jobDescription+='<p>'+claim+'</p>'}),role=readRole(page,row,fixture.observedAt)
 assert.equal(role.complete,false);assert.ok(role.issues.includes('native-criteria-authority-block-unreviewed'));assert.ok(role.criteriaText.endsWith(claim))
})
test('new native identity with full ordinary criteria does not require an individual role allowlist',()=>{
 const row=structuredClone(fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID)),model=JSON.parse(pageFor(nativeURL).html),info=model.jobPostingInfo
 row.title='Research Correspondent';row.externalPath='/job/India-Bengaluru-Karnataka/Research-Correspondent_JREQ299999';row.bulletFields[2]='JREQ299999'
 Object.assign(info,{id:'1234567890abcdef1234567890abcdef',title:row.title,jobReqId:'JREQ299999',jobPostingId:row.externalPath.split('/').at(-1),externalUrl:PROFILE.boardCanonical+row.externalPath,jobDescription:'<p>Reuters is seeking a reporter.</p><p>A reporting certification is mandatory. Strong statistical reasoning, accurate editing, ethical research and professional scientific literacy are essential. Knowledge of modern data-analysis methods is preferred.</p>'})
 const role=readRole({url:PROFILE.nativePrefix+row.externalPath,html:JSON.stringify(model)},row,fixture.observedAt)
 assert.equal(role.complete,true);assert.equal(role.criteriaAuthorityBlocks.blocks.length,0);assert.equal(role.criteriaHTML,info.jobDescription)
 info.jobDescription+='<p>This role is located in India.</p>'
 const unreviewed=readRole({url:PROFILE.nativePrefix+row.externalPath,html:JSON.stringify(model)},row,fixture.observedAt);assert.equal(unreviewed.complete,false);assert.ok(unreviewed.issues.includes('native-criteria-authority-block-unreviewed'))
})
for(const action of ['omit','duplicate','extend'])test('complete original authority block pins reject '+action,()=>{
 const row=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),page=pageFor(nativeURL),model=JSON.parse(page.html),html=model.jobPostingInfo.jobDescription,block=[...html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)].map(m=>m[0]).find(p=>html.split(p).length===2&&projectCriteriaAuthorityBlocks(p).blocks.length>0)
 assert.ok(block)
 model.jobPostingInfo.jobDescription=html.replace(block,action==='omit'?'':action==='duplicate'?block+block:block.replace(/(<p\b[^>]*>)/,'$1Additional professional reporting certification is required. '))
 const role=readRole({...page,html:JSON.stringify(model)},row,fixture.observedAt);assert.equal(role.complete,false);assert.ok(role.issues.includes('native-criteria-authority-block-unreviewed'))
})
for(const addition of ['This role is located in the United States.','<p>You will be sta<span>tioned</span> in Toronto.</p>','<p>A journalism degree is required before applying. You will work for Acme Group.</p>','<p>A journalism degree is required before applying. Submit your CV by 1 November 2026.</p>'])test('full authority topic cannot hide in loose text, inline fragments or education: '+addition,()=>{
 const row=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),page=mutateRole(pageFor(nativeURL),m=>{m.jobPostingInfo.jobDescription+=addition}),role=readRole(page,row,fixture.observedAt)
 assert.equal(role.complete,false);assert.ok(role.issues.includes('native-criteria-authority-block-unreviewed'));assert.ok(role.criteriaHTML.endsWith(addition))
})
test('full current workflow retains an ordinary education-before-applying requirement on both reads',async()=>{
 const addition='<p>A journalism degree is required before applying.</p>',io=retainedIO((page,{input})=>input===nativeURL?mutateRole(page,m=>{m.jobPostingInfo.jobDescription+=addition}):page),jobs=await run(io),job=jobs.find(j=>j.jobId===ownID)
 assert.deepEqual(jobs.map(j=>j.jobId),fixture.expected.ownRoleIDs);assert.ok(job.sourceDescription.endsWith(addition));assert.equal(job.sourceDescription,job.sourceNativeClosingRecord.criteriaHTML);assert.equal(jobs.nativeCollectionEvidence.heldRoles.length,3)
})
function coherentIdentityVariant(){
 const originalRow=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),newID='JREQ299997',newNativeID='0123456789abcdef0123456789abcdef',newPath=originalRow.externalPath.replace(ownID,newID),newURL=PROFILE.nativePrefix+newPath
 const packets=fixture.packets.map(originalPacket=>{
  const packet=structuredClone(originalPacket)
  if(packet.method!=='POST'&&packet.requestedURL!==nativeURL)return packet
  const model=JSON.parse(Buffer.from(packet.bodyBase64,'base64'))
  if(packet.method==='POST'){for(const row of model.jobPostings)if(row.externalPath===originalRow.externalPath){row.externalPath=newPath;row.bulletFields[2]=newID}}
  else if(packet.requestedURL===nativeURL){Object.assign(model.jobPostingInfo,{id:newNativeID,jobReqId:newID,jobPostingId:newPath.split('/').at(-1),externalUrl:PROFILE.boardCanonical+newPath});packet.requestedURL=newURL;packet.url=newURL}
  const bytes=Buffer.from(JSON.stringify(model));packet.bodyBase64=bytes.toString('base64');packet.bodySHA256=sha(bytes);packet.bodyBytes=bytes.length
  return packet
 })
 const row=structuredClone(originalRow);row.externalPath=newPath;row.bulletFields[2]=newID
 return{packets,row,newID,newNativeID,newURL,page:original(packets.find(p=>p.requestedURL===newURL))}
}
test('coherent new native identity reuses complete genuine blocks and exact native context without a saved-ID gate',()=>{
 const variant=coherentIdentityVariant(),role=readRole(variant.page,variant.row,fixture.observedAt),originalRole=readRole(pageFor(nativeURL),fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),fixture.observedAt)
 assert.equal(role.criteriaHTML,originalRole.criteriaHTML);assert.deepEqual(role.criteriaAuthorityBlocks.blocks,originalRole.criteriaAuthorityBlocks.blocks);assert.deepEqual(role.criteriaAuthorityBlocks.nativeContext,originalRole.criteriaAuthorityBlocks.nativeContext)
 assert.equal(role.complete,true);assert.equal(role.id,variant.newID);assert.equal(role.nativeId,variant.newNativeID);assert.equal(role.url,PROFILE.boardCanonical+variant.row.externalPath)
})
test('coherent new native identity remains eligible through all 29 stable opening and closing responses',async()=>{
 const variant=coherentIdentityVariant(),io=retainedIO(p=>p,{packets:variant.packets}),jobs=await run(io),audit=jobs.nativeCollectionEvidence,job=jobs.find(j=>j.jobId===variant.newID)
 assert.deepEqual(jobs.map(j=>j.jobId),fixture.expected.ownRoleIDs.map(id=>id===ownID?variant.newID:id));assert.ok(job);assert.equal(job.nativePublishedId,variant.newNativeID);assert.equal(job.sourceDescription,JSON.parse(pageFor(nativeURL).html).jobPostingInfo.jobDescription);assert.deepEqual(job.sourceNativeRecord.nativeModel,job.sourceNativeClosingRecord.nativeModel)
 assert.equal(io.calls.length,29);assert.equal(io.calls.filter(c=>c.url===variant.newURL).length,2);assert.equal(io.calls.filter(c=>c.url===nativeURL).length,0);assert.equal(audit.observedVacancyCount,27);assert.equal(audit.openingDetails.length,7);assert.equal(audit.closingDetails.length,7);assert.deepEqual(audit.heldRoles.map(r=>r.id),fixture.expected.heldRoleIDs)
})
for(const [label,change]of [
 ['wrong current site',m=>{m.jobPostingInfo.jobPostingSiteId='Other_Site'}],
 ['old canonical URL',m=>{m.jobPostingInfo.externalUrl=JSON.parse(pageFor(nativeURL).html).jobPostingInfo.externalUrl}],
 ['old requisition',m=>{m.jobPostingInfo.jobReqId=ownID}],
])test('new identity must still match actual native listing/body/account: '+label,()=>{const v=coherentIdentityVariant(),page=mutateRole(v.page,change);assert.throws(()=>readRole(page,v.row,fixture.observedAt),/identity|account|canonical/)})
test('new identity cannot borrow unchanged blocks with a different typed native context',()=>{const v=coherentIdentityVariant(),page=mutateRole(v.page,m=>{m.jobPostingInfo.location='India, Mumbai';m.jobPostingInfo.jobRequisitionLocation.descriptor='India, Mumbai'}),role=readRole(page,v.row,fixture.observedAt);assert.equal(role.complete,false);assert.ok(role.issues.includes('native-criteria-authority-block-unreviewed'))})
const ordinaryReplacementCriteria='<p>Reuters is seeking a reporter.</p><p>A reporting certification is mandatory. Strong statistical reasoning, accurate editing, ethical research and professional scientific literacy are essential. Knowledge of modern data-analysis methods is preferred.</p>'
const eraseAuthorityAndChangeContext=m=>{m.jobPostingInfo.jobDescription=ordinaryReplacementCriteria;m.jobPostingInfo.location='India, Mumbai';m.jobPostingInfo.jobRequisitionLocation.descriptor='India, Mumbai'}
test('saved native identity cannot erase all reviewed authority while changing its native context',()=>{
 const row=fixture.expected.selectedRows.find(r=>r.bulletFields[2]===ownID),role=readRole(mutateRole(pageFor(nativeURL),eraseAuthorityAndChangeContext),row,fixture.observedAt)
 assert.equal(role.criteriaAuthorityBlocks.blocks.length,0);assert.equal(role.complete,false);assert.ok(role.issues.includes('native-criteria-authority-block-unreviewed'));assert.equal(role.criteriaHTML,ordinaryReplacementCriteria)
})
test('full stable native reads preserve the known-identity authority-erasure hold after context drift',async()=>{
 const io=retainedIO((page,{input})=>input===nativeURL?mutateRole(page,eraseAuthorityAndChangeContext):page),jobs=await run(io),audit=jobs.nativeCollectionEvidence
 assert.deepEqual(jobs.map(j=>j.jobId),fixture.expected.ownRoleIDs.filter(id=>id!==ownID));assert.equal(io.calls.length,29);assert.equal(audit.observedVacancyCount,27);assert.equal(audit.openingDetails.length,7);assert.equal(audit.closingDetails.length,7)
 const held=audit.heldRoles.find(r=>r.id===ownID);assert.ok(held.reasons.includes('native-criteria-authority-block-unreviewed'));assert.equal(held.opening.criteriaHTML,ordinaryReplacementCriteria);assert.deepEqual(held.opening.nativeModel,held.closing.nativeModel)
})
test('new native identity must preserve its full native UID at independent closing',async()=>{const v=coherentIdentityVariant();let reads=0;const io=retainedIO((page,{input})=>input===v.newURL&&++reads===2?mutateRole(page,m=>{m.jobPostingInfo.id='abcdef0123456789abcdef0123456789'}):page,{packets:v.packets});await assert.rejects(run(io),/changed at closing/);assert.equal(reads,2)})
for(const claim of ['Please send your résumé by 1 November 2026.','Please send your résumés no later than 1 November 2026.','Please send your re\u0301sume\u0301 by 1 November 2026.','A journalism degree is required before applying. A re\u0301sume\u0301 is required.'])test('Unicode résumé topic holds the original complete criteria on both native passes: '+claim,async()=>{
 const addition='<p>'+claim+'</p>',io=retainedIO((page,{input})=>input===nativeURL?mutateRole(page,m=>{m.jobPostingInfo.jobDescription+=addition}):page),jobs=await run(io),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.some(j=>j.jobId===ownID),false);assert.equal(jobs.length,3);assert.equal(io.calls.length,29);assert.equal(audit.observedVacancyCount,27);assert.equal(audit.openingDetails.length,7);assert.equal(audit.closingDetails.length,7)
 const held=audit.heldRoles.find(r=>r.id===ownID);assert.ok(held);assert.ok(held.reasons.includes('native-criteria-authority-block-unreviewed'));assert.ok(held.opening.criteriaHTML.endsWith(addition));assert.deepEqual(held.opening.nativeModel,held.closing.nativeModel)
})
