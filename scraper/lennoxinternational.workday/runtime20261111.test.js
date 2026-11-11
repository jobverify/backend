import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {CAREERS_URL,run} from './script.js'
import {profile,readCorporate,readShell,readListing,readRole} from './nativeContract20261111.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
import {createLennoxTransport} from './transport20261111.js'
import {extractionFailureDetails} from '../../scripts/catalogExtractionFailureEvidence.js'
import {retainNativeFailureArtifact} from '../../scripts/catalogExtractionFailureArtifacts.js'
import os from 'node:os'
import path from 'node:path'
import {withRetry} from '../../scraper-support/utils/retry.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native20261111.json.gz',import.meta.url))))
test('genuine 2026-11-10 UTC capture retains 38 distinct opening/closing byte receipts',()=>{assert.equal(fixture.responses.length,38);for(const p of fixture.responses){assert.equal(createHash('sha256').update(Buffer.from(p.bodyBase64,'base64')).digest('hex'),p.bodySHA256);assert.ok(p.completedAt>=p.requestedAt);assert.equal(p.status,200);assert.equal(p.finalURL,p.requestedURL)}})
test('Lennox International registration begins at its current exact corporate publisher, rather than third-party Opennash',()=>assert.equal(CAREERS_URL,'https://www.lennox.com/in'))
const text=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8'),board=text(fixture.responses[3]),shell=text(fixture.responses[2]),own=text(fixture.responses[4]),row=readListing(board).rows[0]
const schemaNode=document(own).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0]
const schemaChange=change=>{const value=JSON.parse(schemaNode.raw);change(value);return own.slice(0,schemaNode.openEnd)+JSON.stringify(value)+own.slice(schemaNode.closeStart)}
const mutateNode=(html,predicate,mutate)=>{const doc=document(html),nodes=doc.nodes(predicate);assert.equal(nodes.length,1,'test mutation must bind one exact native node');const n=nodes[0];return html.slice(0,n.start)+mutate(doc.outer(n),doc,n)+html.slice(n.end)}
const classed=(n,name)=>(n.attrs.class||'').split(/\s+/).includes(name)
const ownContainer=html=>document(html).nodes(n=>classed(n,'iCIMS_JobContent'))[0]
function addOwn(html,extra){const node=ownContainer(html);return html.slice(0,node.closeStart)+extra+html.slice(node.closeStart)}
function addCriteria(html,extra){const d=document(html),heading=d.nodes(n=>n.tag==='h2'&&d.text(n)==='Job Description')[0],parent=d.nodes(n=>classed(n,'iCIMS_JobContent'))[0],index=parent.children.indexOf(heading),next=parent.children.slice(index+1).find(n=>typeof n!=='string');return html.slice(0,next.closeStart)+extra+html.slice(next.closeStart)}
function ownAndSchemaCriteria(extra){const s=JSON.parse(schemaNode.raw);assert.equal(s.description.split('<h2>Qualifications</h2>').length,2);s.description=s.description.replace('<h2>Qualifications</h2>',extra+'<h2>Qualifications</h2>');return addCriteria(schemaChange(v=>v.description=s.description),extra)}
function replay(mutate){
 const counts=new Map(),used=[]
 const fetchImpl=async url=>{const index=counts.get(url)||0;counts.set(url,index+1);const packets=fixture.responses.filter(p=>p.requestedURL===url),p=packets[index];assert.ok(p,'unexpected replay occurrence '+url+' #'+index);used.push(p);let packet={...p,body:Buffer.from(p.bodyBase64,'base64')};packet=mutate?.(packet,index)??packet;const response=new Response(packet.body,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.finalURL});return response}
 return{fetchImpl,used,counts}
}
test('all 15 genuine opening and distinct closing own models reconcile, including 54502 without an optional company profile',()=>{
 const listing=readListing(board);assert.equal(listing.rows.length,15)
 for(const r of listing.rows){const packets=fixture.responses.filter(p=>p.requestedURL===r.requestedURL);assert.equal(packets.length,2);const a=readRole(text(packets[0]),r),b=readRole(text(packets[1]),r);assert.deepEqual(a,b);assert.equal(a.country,'India');assert.equal(a.nativeLegalEmployer,null);assert.equal(a.sourceEmployerBinding.legalEntityVerified,false);assert.equal(a.sourceScopeComplete,false);assert.equal(a.requisitionId,r.fields['Requisition #']);assert.equal(a.sourceNativeRequestedURL,r.requestedURL);assert.equal(a.sourceUrl,r.canonicalURL);assert.ok(a.jobDescription.includes('Qualifications'))}
})
test('full source replay consumes all 38 original occurrences and retains raw byte provenance, observations and scope holds',async()=>{
 const r=replay(),jobs=await run({fetchImpl:r.fetchImpl});assert.equal(jobs.length,15);assert.equal(r.used.length,38);assert.equal(jobs.sourceAudit.observedNativeCount,15);assert.equal(jobs.sourceAudit.closingOwnModelsMatch,true);assert.equal(readSourceObservationEvidence(jobs,'lennoxinternational').observedVacancyCount,15);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.deepEqual(jobs.sourceAudit.originalPages.map(p=>p.rawBodyBase64),r.used.map(p=>p.bodyBase64));assert.deepEqual(jobs.sourceAudit.originalPages.map(p=>p.url),r.used.map(p=>p.requestedURL));assert.equal(new Set(r.used.map(p=>p.requestedAt)).size,38);assert.equal(extractionDetailHealth(jobs).missingDescriptions,0);assert.equal(extractionDetailHealth(jobs).nativeCollections.length,1);assert.equal(extractionDetailHealth(jobs).nativeCollections[0].complete,true)
 assert.doesNotThrow(()=>JSON.stringify(jobs));assert.doesNotThrow(()=>structuredClone(jobs.sourceAudit))
})
for(const url of profile.corporateURLs)test('active current corporate declaration '+url,()=>assert.equal(readCorporate(text(fixture.responses.find(p=>p.requestedURL===url)),url).declaredNativeURL,profile.shellURL))
for(const tag of ['template','blockquote','pre','code']){
 test('quoted/inert '+tag+' corporate delegation cannot establish publisher handoff',()=>{const html=text(fixture.responses[0]).replaceAll('href="'+profile.shellURL.replaceAll('&','&amp;')+'"','href="https://example.org/"').replaceAll('href="'+profile.shellURL+'"','href="https://example.org/"');assert.throws(()=>readCorporate(html.replace('</body>','<'+tag+'><a href="'+profile.shellURL+'">View Openings</a></'+tag+'></body>'),CAREERS_URL),/delegation/)})
 test('quoted/inert '+tag+' own schema cannot qualify an own role',()=>assert.throws(()=>readRole(mutateNode(own,n=>n.tag==='script'&&n.attrs.type==='application/ld+json',raw=>'<'+tag+'>'+raw+'</'+tag+'>'),row),/schema/))
 test('quoted/inert '+tag+' own content cannot qualify an own role',()=>assert.throws(()=>readRole(mutateNode(own,n=>classed(n,'iCIMS_JobContent'),raw=>'<'+tag+'>'+raw+'</'+tag+'>'),row),/content/))
 test('quoted/inert '+tag+' native listing card cannot supply positive membership',()=>{const value=readListing(mutateNode(board,n=>classed(n,'iCIMS_JobCardItem')&&document(board).text(n).includes('2026-55657'),raw=>'<'+tag+'>'+raw+'</'+tag+'>'));assert.equal(value.rows.length,14);assert.ok(!value.rows.some(r=>r.nativeJobId==='55657'))})
}
test('reviewed shell resolves the exact literal active AST iframe and retains actual URL separately from publisher canonical',()=>{const value=readShell(shell);assert.equal(value.declaredFrameURL,profile.frameURL);assert.notEqual(value.requestedURL,value.publisherCanonical)})
for(const [name,extra]of[
 ['override inline program','<script>icimsFrame.src="https://other.example/"</script>'],['external program','<script src="https://other.example/program.js"></script>'],['active event','<img src="missing" onerror="location.href=\'https://other.example/\'">'],['new frame','<iframe src="https://other.example/"></iframe>'],['data frame','<iframe src="data:text/html,foreign"></iframe>'],['javascript link','<a href="javascript:location.href=\'https://other.example/\'">Foreign</a>']
])test('native shell rejects '+name,()=>assert.throws(()=>readShell(shell.replace('</body>',extra+'</body>')),/shell|program/))
test('inert program decoy does not change a genuine active native shell',()=>assert.deepEqual(readShell(shell.replace('</body>','<template><script>icimsFrame.src="https://other.example/"</script></template></body>')),readShell(shell)))
for(const change of [s=>s.replace('https:\\/\\/globalcareers-lennox.icims.com\\/jobs\\/search?','https:\\/\\/other.icims.com\\/jobs\\/search?'),s=>s.replace('icimsFrame.src =','otherFrame.src =')])test('native iframe AST/program identity mutation is held',()=>assert.throws(()=>readShell(change(shell))))
for(const [name,mutate]of[
 ['foreign native publisher',v=>v.hiringOrganization.name='Other Corporation'],['native publisher homepage conflict',v=>v.hiringOrganization.sameAs='www.other.example'],['foreign URL',v=>v.url=v.url.replace('indiacareers-lennox','other')],['wrong own ID',v=>v.url=v.url.replace('/55657/','/55656/')],['title conflict',v=>v.title='Other role'],['unknown country',v=>v.jobLocation[0].address.addressCountry='UNKNOWN'],['foreign country',v=>v.jobLocation[0].address.addressCountry='CA'],['extra foreign location',v=>v.jobLocation.push({...v.jobLocation[0],address:{...v.jobLocation[0].address,addressCountry:'CA'}})],['country masked in locality',v=>v.jobLocation[0].address.addressLocality='Toronto (Canada), India'],['criteria lost',v=>v.description='<h2>Job Description</h2><h2>Qualifications</h2>'],['criteria wrong shape',v=>v.description=[]],['unreviewed schema criterion',v=>v.responsibilities='Additional required license'],['bad calendar',v=>v.datePosted='2026-02-30T04:00:00.000Z']
])test('own role rejects '+name,()=>assert.throws(()=>readRole(schemaChange(mutate),row)))
test('original native schema remains exactly retained, including country facts and full criteria',()=>{const role=readRole(own,row);assert.equal(role.sourceNativeSchemaJSON,schemaNode.raw);assert.equal(role.sourceNativeSchema.jobLocation[0].address.addressCountry,'IN');assert.equal(role.jobDescription,JSON.parse(schemaNode.raw).description)})
for(const [label,payload]of[
 ['affirmative employer','<p>You will be employed by Other Corporation.</p>'],['employer label','<p>Employer: Other Corporation</p>'],['employer split','<p>Employer:</p><p>Other Corporation</p>'],['employer colon split','<dt>Employer</dt><dd>:</dd><dd>Other Corporation</dd>'],['named denial','<p>Lennox International is not your employer.</p>'],['not employed denial','<p>You are not employed by Lennox International.</p>'],['contracted denial',"<p>You won't be employed by Lennox International.</p>"],['workplace','<p>Work Location: Toronto, Canada</p>'],['split workplace','<p>Work Location:</p><p>Toronto (Canada), India</p>'],['hyphen workplace','<p>Location: Toronto - Canada</p>'],['negated workplace','<p>Location: Not India</p>'],['own workplace statement','<p>This role is based in Canada.</p>']
]){
 test('own criteria holds active '+label,()=>assert.throws(()=>readRole(ownAndSchemaCriteria(payload),row),/employer|denial/.test(label)?/employer/:/country/))
 for(const tag of ['blockquote','template','pre','code'])test('inert/quoted '+tag+' '+label+' does not contradict genuine native criteria',()=>assert.equal(readRole(ownAndSchemaCriteria('<'+tag+'>'+payload+'</'+tag+'>'),row).country,'India'))
}
for(const tag of ['aside','main','address','div','td','th','dt','dd'])test('own negative employer block '+tag+' is bounded after loose overview',()=>assert.throws(()=>readRole(ownAndSchemaCriteria('Our overview<'+tag+'>Employer: Other Corporation</'+tag+'>'),row),/employer/))
test('active criteria outside reviewed section boundaries cannot be silently omitted',()=>assert.throws(()=>readRole(addOwn(own,'<p>An additional professional license is required for this role.</p>'),row),/outside/))
test('literal native own requisition conflict is held',()=>assert.throws(()=>readRole(own.replace('2026-55657','2026-55656'),row),/requisition/))
test('listing duplicate identities are held before observation accounting',()=>{const doc=document(board),cards=doc.nodes(n=>classed(n,'iCIMS_JobCardItem')),last=cards.at(-1);assert.throws(()=>readListing(board.slice(0,last.start)+doc.outer(cards[0])+board.slice(last.end)),/duplicate/)})
test('listing multiple pages cannot be represented as a complete bounded cohort',()=>assert.throws(()=>readListing(board.replace('Page 1 of 1','Page 1 of 2')),/pagination/))
test('listing missing explicit country prefix is not inferred from Chennai filter',()=>{const changed={...row,fields:{...row.fields,'Job Locations':'Chennai'}};assert.throws(()=>readRole(own.replace('IN-Chennai','Chennai'),changed),/country/)})
for(const phase of ['own-role-closing','native-listing-closing','native-shell-closing','corporate-closing'])test('closing read change in '+phase+' holds the entire result',async()=>{
 const r=replay(p=>{if(p.kind!==phase)return p;let body=p.body.toString();if(phase==='own-role-closing')body=body.replace('2026-55657','2026-55656');else if(phase==='native-listing-closing')body=body.replace('Page 1 of 1','Page 1 of 2');else if(phase==='native-shell-closing')body=body.replace('</body>','<script>var other=1</script></body>');else body=body.replaceAll('Lennox India','Other Brand');return{...p,body}})
 await assert.rejects(run({fetchImpl:r.fetchImpl}))
})
for(const [name,mutate]of[
 ['403',p=>({...p,status:403})],['challenge redirect',p=>({...p,status:302})],['wrong final URL',p=>({...p,finalURL:'https://other.example/'})],['bad MIME',p=>({...p,headers:{'content-type':'application/json'}})],['oversized body',p=>({...p,body:Buffer.alloc(2000001,65)})]
])test('native transport holds '+name+' without further origin calls',async()=>{const r=replay(p=>r.used.length===1?mutate(p):p);await assert.rejects(run({fetchImpl:r.fetchImpl}));assert.equal(r.used.length,1)})
test('exact caller cancellation reason is retained and pre-aborted reads make no request',async()=>{const c=new AbortController(),reason={name:'caller-specific'};c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:()=>assert.fail('unexpected fetch')}),e=>e===reason)})
test('ignored fetch cancellation is actively bounded and its late body is canceled once',async()=>{
 let resolve,cancels=0;const pending=new Promise(r=>resolve=r),receipts=[],session=createLennoxTransport({sourceTimeoutMs:1000,requestTimeoutMs:15,fetchImpl:()=>pending},receipts)
 try{await assert.rejects(session.read(CAREERS_URL,'html'),e=>e.name==='TimeoutError');resolve({status:200,url:CAREERS_URL,headers:new Headers({'content-type':'text/html'}),body:{cancel(){cancels++}}});await new Promise(r=>setTimeout(r,15));assert.equal(cancels,1)}finally{session.close()}
})
test('ignored acquired body read is bounded, canceled and released exactly once',async()=>{
 let cancels=0,releases=0;const session=createLennoxTransport({sourceTimeoutMs:1000,requestTimeoutMs:15,fetchImpl:async()=>({status:200,url:CAREERS_URL,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel(){cancels++},releaseLock(){releases++}})}})},[])
 try{await assert.rejects(session.read(CAREERS_URL,'html'),e=>e.name==='TimeoutError');assert.equal(cancels,1);assert.equal(releases,1)}finally{session.close()}
})
test('monotonic request deadline catches synchronous fetch stalls before accepting native bytes',async()=>{
 const session=createLennoxTransport({sourceTimeoutMs:1000,requestTimeoutMs:10,fetchImpl:async()=>{const until=performance.now()+35;while(performance.now()<until){/* Intentionally block beyond the deadline. */}const response=new Response('<html>native</html>',{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:CAREERS_URL});return response}},[])
 try{await assert.rejects(session.read(CAREERS_URL,'html'),e=>e.name==='TimeoutError')}finally{session.close()}
})
test('source deadline races callbacks that ignore cancellation',async()=>{const session=createLennoxTransport({sourceTimeoutMs:15,requestTimeoutMs:15},[]);try{await assert.rejects(session.race(()=>new Promise(()=>{})),e=>e.name==='TimeoutError')}finally{session.close()}})
for(const value of ['IN-Toronto (Canada), India','IN-Toronto - Canada','IN-Chennai; CA-Toronto'])test('own native workplace header country conflict '+value+' is held even with explicit IN primary schema',()=>{
 const changed={...row,fields:{...row.fields,'Job Locations':value}}
 assert.throws(()=>readRole(own.replace('IN-Chennai',value),changed),/country/)
})
test('ordinary role description about U.S. consumers is not a worksite country inference',()=>{assert.match(own,/U\.S\. consumers/);assert.equal(readRole(own,row).country,'India')})
for(const field of ['Job Description','Qualifications'])test('mandatory '+field+' cannot be headings-only despite other full sections',()=>{
 const d=document(own),heading=d.nodes(n=>n.tag==='h2'&&d.text(n)===field)[0],parent=ownContainer(own);parent.children.indexOf(heading)
 // Offset mutations are scoped to the exact own section, never an earlier
 // identical string elsewhere in the captured document.
 const direct=d.nodes(n=>classed(n,'iCIMS_JobContent'))[0],at=direct.children.indexOf(heading),section=direct.children.slice(at+1).find(n=>typeof n!=='string')
 assert.ok(section);const html=own.slice(0,section.openEnd)+'<h2>Responsibilities</h2><h3>Requirements</h3>'+own.slice(section.closeStart)
 assert.throws(()=>readRole(html,row),/placeholder|empty/)
})
test('a consistently native foreign own role is excluded without losing observed membership or claiming global scope',async()=>{
 const r=replay(p=>{
  let html=p.body.toString()
  if(p.kind.includes('listing'))html=mutateNode(html,n=>classed(n,'iCIMS_JobCardItem')&&document(html).text(n).includes('2026-55657'),raw=>raw.replace('IN-Chennai','CA-Toronto'))
  if(p.requestedURL===row.requestedURL){const d=document(html),node=d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0],value=JSON.parse(node.raw);value.jobLocation[0].address.addressCountry='CA';value.jobLocation[0].address.addressLocality='Toronto';html=html.slice(0,node.openEnd)+JSON.stringify(value)+html.slice(node.closeStart);html=html.replace('IN-Chennai','CA-Toronto')}
  return{...p,body:html}
 })
 const jobs=await run({fetchImpl:r.fetchImpl});assert.equal(jobs.length,14);assert.equal(readSourceObservationEvidence(jobs,'lennoxinternational').observedVacancyCount,15);assert.equal(jobs.sourceAudit.observedNonIndiaCount,1);assert.equal(jobs.sourceAudit.nativeRecords[0].country,'Canada');assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(extractionDetailHealth(jobs).nativeCollections[0].complete,true)
})
test('native row ID cannot be substituted independently of its own canonical URL',()=>assert.throws(()=>readRole(own,{...row,nativeJobId:'99999'}),/ID/))
test('explicit native legal employer supplied in an unreviewed schema field cannot be silently overwritten by publisher brand',()=>assert.throws(()=>readRole(schemaChange(v=>v.legalEmployer='Other Corporation'),row),/schema/))
test('native request budget is bounded independently of source duration',async()=>{
 const receipts=Array.from({length:64},()=>({})),session=createLennoxTransport({fetchImpl:()=>assert.fail('budget must stop request')},receipts)
 try{await assert.rejects(session.read(CAREERS_URL,'html'),/budget/)}finally{session.close()}
})
test('source monotonic deadline catches a synchronously blocking callback',async()=>{
 const session=createLennoxTransport({sourceTimeoutMs:10,requestTimeoutMs:10},[])
 try{await assert.rejects(session.race(()=>{const until=performance.now()+30;while(performance.now()<until){/* Intentionally block beyond the deadline. */}return 'late'}),e=>e.name==='TimeoutError')}finally{session.close()}
})
test('in-flight caller cancellation preserves the exact reason even if fetch ignores cancellation',async()=>{
 const caller=new AbortController(),reason={message:'exact caller identity'},session=createLennoxTransport({signal:caller.signal,sourceTimeoutMs:1000,requestTimeoutMs:1000,fetchImpl:()=>new Promise(()=>{})},[])
 try{const request=session.read(CAREERS_URL,'html');setTimeout(()=>caller.abort(reason),5);await assert.rejects(request,e=>e===reason)}finally{session.close()}
})
test('source race removes its listener on success and closes subsequent operations',async()=>{
 const session=createLennoxTransport({},[]);assert.equal(await session.race(()=>42),42);session.close();assert.throws(()=>session.check())
})
test('current native transport uses the ordinary Node capture representation and omits credentials without redirects',async()=>{
 let actual;const r=replay();await run({fetchImpl:async(url,init)=>{actual=init;return r.fetchImpl(url)}})
 assert.equal(actual.headers['User-Agent'],'node');assert.equal(actual.headers.Accept,'text/html');assert.equal(actual.credentials,'omit');assert.equal(actual.redirect,'manual')
})
for(const wrapper of ['<div hidden>','<div style="display:none">','<blockquote>','<pre>','<code>'])test('unreviewed shell executable under '+wrapper+' still executes and is rejected',()=>{
 const close='</'+wrapper.match(/^<([a-z]+)/)[1]+'>'
 assert.throws(()=>readShell(shell.replace('</body>',wrapper+'<script>icimsFrame.src="https://other.example/jobs"</script>'+close+'</body>')),/program/)
})
for(const wrapper of ['<div hidden>','<blockquote>','<pre>'])test('shell executable handler under '+wrapper+' is not a visible-proof exemption',()=>{
 const close='</'+wrapper.match(/^<([a-z]+)/)[1]+'>'
 assert.throws(()=>readShell(shell.replace('</body>',wrapper+'<img src="missing" onerror="location.href=\'https://other.example/\'">'+close+'</body>')),/handler/)
})
for(const tag of ['blockquote','pre','code','template'])test('corporate positive publisher title under '+tag+' is unqualified',()=>{
 const html=text(fixture.responses[0]),matches=[...html.matchAll(/<title\b[^>]*>[\s\S]*?<\/title>/gi)];assert.equal(matches.length,1);const ownTitle=matches[0],changed=html.slice(0,ownTitle.index)+'<'+tag+'>'+ownTitle[0]+'</'+tag+'>'+html.slice(ownTitle.index+ownTitle[0].length);assert.throws(()=>readCorporate(changed,CAREERS_URL),/title/)
})
for(const [name,payload]of[
 ['typed US country','<p>Country: US</p>'],['typed Canada country','<p>Country:</p><p>CA</p>'],['unknown typed country','<p>Country: Unknown</p>'],['explicit country mixture','<p>Country: India, Canada</p>'],['successful candidate own country','<p>The successful candidate will be based in Toronto, Canada.</p>'],['candidate country via you','<p>You will be based in Toronto, Canada.</p>'],['worksite label','<p>Worksite: Toronto, Canada</p>'],['own role employer assignment','<p>This role is for Other Corporation.</p>'],['own role employer at','<p>This position is at Other Corporation.</p>'],['own employee assignment','<p>You will be working for Other Corporation.</p>']
]){
 test('own criteria rejects '+name,()=>assert.throws(()=>readRole(ownAndSchemaCriteria(payload),row),/employer|assignment/.test(name)?/employer/:/country/))
 for(const tag of ['blockquote','template','code'])test('quoted '+tag+' '+name+' remains excluded from employer/country evidence',()=>assert.equal(readRole(ownAndSchemaCriteria('<'+tag+'>'+payload+'</'+tag+'>'),row).country,'India'))
}
test('typed native IN country and short CA state workplace remain distinct facts',()=>assert.equal(readRole(ownAndSchemaCriteria('<p>Country: IN</p><p>Work Location: CA</p>'),row).country,'India'))
test('primary403 keeps standard access-denial diagnostics and exact public failure response bytes',async()=>{
 const r=replay(p=>({...p,status:403}));let error
 try{await run({fetchImpl:r.fetchImpl});assert.fail('must reject')}catch(e){error=e}
 assert.equal(error.status,403);const detail=extractionFailureDetails(error);assert.equal(detail.failureKind,'blocked_or_access_denied');assert.equal(detail.failureEvidence.observedListingCount,null);assert.equal(detail.failureEvidence.inventoryComplete,false);assert.equal(detail.failureEvidence.cleanupAllowed,false);assert.equal(r.used.length,1)
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lennox-native-failure-'))
 try{const retained=retainNativeFailureArtifact(error,{outputDirectory:dir,source:'lennoxinternational',attemptedAt:new Date().toISOString(),completedAt:new Date().toISOString()});assert.equal(retained.retainedResponses,1);assert.equal(retained.rejectedResponses,0);const artifact=JSON.parse(fs.readFileSync(path.join(dir,retained.filename)));assert.equal(artifact.retainedResponses[0].status,403);assert.equal(artifact.retainedResponses[0].rawBodyBase64,fixture.responses[0].bodyBase64);assert.equal(artifact.retainedResponses[0].bodySHA256,fixture.responses[0].bodySHA256);assert.equal(artifact.qualifiedJobCounts,null);assert.equal(artifact.cleanupAllowed,false)}finally{fs.rmSync(dir,{recursive:true,force:true})}
})
for(const reason of [Object.freeze(Error('frozen caller error')),'caller string',null])test('cancellation diagnostics preserve exact non-extensible/nonError reason '+String(reason),async()=>{const c=new AbortController();c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:()=>assert.fail('no request')}),e=>e===reason)})
function replaceQualification(inner){
 const d=document(own),parent=d.nodes(n=>classed(n,'iCIMS_JobContent'))[0],h=d.nodes(n=>n.tag==='h2'&&d.text(n)==='Qualifications')[0],at=parent.children.indexOf(h),section=parent.children.slice(at+1).find(n=>typeof n!=='string'),s=JSON.parse(schemaNode.raw)
 s.description=s.description.slice(0,s.description.indexOf('<h2>Qualifications</h2>'))+'<h2>Qualifications</h2>'+inner
 const changed=own.slice(0,section.openEnd)+inner+own.slice(section.closeStart),n=document(changed).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0]
 return changed.slice(0,n.openEnd)+JSON.stringify(s)+changed.slice(n.closeStart)
}
for(const content of ['<p><strong>Experience</strong></p>','<p>Experience</p><p>Education</p>','<p>Location: India</p><p>Department: Sales</p><h3>Qualifications</h3>','<dt>Location</dt><dd>India</dd><dt>Department</dt><dd>Sales</dd>'])test('matching own/schema mandatory criteria still rejects formatting or metadata only '+content,()=>assert.throws(()=>readRole(replaceQualification(content),row),/placeholder|empty/))
for(const targetKind of ['corporate-opening','own-role-closing'])test('actual outer retry wrapper stops after first '+targetKind+'403 source failure',async()=>{
 let attempts=0,totalRequests=0,originalError
 await assert.rejects(withRetry(async()=>{
  attempts++;const r=replay(p=>p.kind===targetKind?{...p,status:403}:p)
  try{return await run({fetchImpl:async(...args)=>{totalRequests++;return r.fetchImpl(...args)}})}catch(error){originalError=error;throw error}
 },{attempts:2,baseDelayMs:0,label:'lennox-'+targetKind}),error=>!!error)
 assert.equal(originalError.status,403);assert.equal(originalError.abortRetries,true);assert.equal(attempts,1);assert.equal(totalRequests,targetKind==='corporate-opening'?1:20);assert.equal(extractionFailureDetails(originalError).failureKind,'blocked_or_access_denied')
})
