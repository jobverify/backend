import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261107/finacus-current.json.gz',import.meta.url)))),oracle=fixture.independentOracle,packets=new Map(fixture.packets.map(p=>[p.requestedURL,p])),sha=b=>createHash('sha256').update(b).digest('hex')
const provider=getScraperCatalog().find(p=>p.source==='finacussolutions'),home='https://www.finacus.co.in/',careers=home+'careers/',about=home+'about/',detail=id=>home+'wp-admin/admin-ajax.php?action=finacus_careers_position_ajax_request&get_position_id='+id
async function replay(options={}){
 const calls=[],seen=new Map()
 const response=async(url,init={},legacy=false)=>{
  if(!legacy){assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')}
  const n=(seen.get(url)||0)+1;seen.set(url,n);calls.push({url,n});const p=packets.get(url);assert.ok(p,'Uncaptured or application/account URL: '+url)
  const initial=Buffer.from(p.bodyBase64,'base64').toString('utf8'),text=options.change?options.change({url,n,text:initial,packet:p}):initial,bytes=options.changeBytes?options.changeBytes({url,n,bytes:Buffer.from(text)}):Buffer.from(text)
  return{...p,bytes,bodySHA256:sha(bytes),...(options.responseChange?.({url,n})||{})}
 }
 const fetchImpl=async(url,init)=>{const p=await response(url,init,true),r=new Response(p.bytes,{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}
 let jobs,error,rejected=false
 try{jobs=await createCatalogScraper(provider).run({now:()=>new Date('2026-11-06T20:00:00Z'),fetchResponse:response,fetchImpl,...options,...(options.useDefaultTransport?{fetchResponse:undefined}:{} )})}catch(e){error=e;rejected=true}
 return{jobs,error,rejected,calls}
}
test('Finacus original research bytes and independent oracle retain all20 roles and country ambiguity',()=>{
 assert.equal(fixture.packets.length,26);assert.equal(oracle.observedRoles,20);assert.equal(oracle.qualifiedIDs.length,19);assert.deepEqual(oracle.heldIDs,['602']);assert.equal(oracle.publishedOpenings,40);assert.equal(oracle.qualifiedOpenings,35)
 for(const p of fixture.packets){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(b.length,p.bodyBytes);assert.equal(sha(b),p.bodySHA256);assert.equal(p.method,'GET')}
 assert.equal(fixture.freshAcceptedClosingProofClaimed,false);assert.equal(fixture.qualifiedSourceCredit,0)
})
test('Finacus registered route qualifies nineteen exact Mumbai workplaces and holds the multi-region row',async()=>{
 let audit;const r=await replay({onAudit:a=>{audit=a}});assert.equal(r.rejected,false,r.error?.message)
 assert.equal(r.jobs.filter(j=>j.country==='India'&&j.sourceDetailComplete).length,19)
 assert.equal(r.jobs.length,19);assert.equal(r.calls.length,52);assert.equal(audit.heldRecords.length,1);assert.equal(audit.heldRecords[0].jobId,'602')
 assert.equal(readInventoryEvidence(r.jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(r.jobs).listingComplete,false)
 assert.equal(readSourceObservationEvidence(r.jobs,'finacussolutions').observedRecordCount,20)
 for(const j of r.jobs){const o=oracle.roles[j.jobId];assert.equal(j.jobDescription,o.description);assert.equal(j.sourceDescription,o.detailHTML);assert.deepEqual(j.nativeSourceRecord.metadata,o.metadata);assert.equal(j.nativeOpenPositions,o.openPositions);assert.equal(j.nativeLocation,o.metadata.Location);assert.equal(j.country,'India');assert.equal(j.city,'Mumbai');assert.equal(j.requisitionId,null);assert.equal(j.canonicalRoleURL,null);assert.equal(j.postingDate,null);assert.equal(j.closingDate,null);assert.equal(j.sourceUrl,detail(j.jobId));assert.equal(j.applyUrl,careers+'#careerform');assert.equal(j.sourceScopeComplete,false);assert.equal(j.lifecycleCleanupAllowed,false);assert.equal(j.applicationVisited,false);assert.equal(j.activeApplyVerified,false)}
 assert.match(r.jobs.find(j=>j.jobId==='620').jobDescription,/Gender : Female/)
})

const roleChange=(id,change,closingOnly=false)=>p=>p.url===detail(id)&&(!closingOnly||p.n===2)?change(p.text):p.text
const append=(html,text)=>{assert.match(html,/<\/div>\s*$/);return html.replace(/<\/div>(\s*)$/,text+'</div>$1')}
const reject=async options=>{const r=await replay(options);assert.equal(r.rejected,true);assert.match(String(r.error?.message),/Finacus native/);return r}

test('Finacus every complete opening and closing tree equals the independent oracle',async()=>{
 let audit;const r=await replay({onAudit:a=>{audit=a}});assert.equal(r.rejected,false,r.error?.message)
 for(const j of r.jobs){assert.deepEqual(j.nativeSourceRecord.model.tree,oracle.roles[j.jobId].tree);assert.deepEqual(j.nativeClosingRecord.model,j.nativeSourceRecord.model);assert.equal(j.sourceWorksiteCountryProof.contextParagraph,oracle.countryContext.paragraph);assert.equal(j.sourceWorksiteCountryProof.headquartersCountryDefaultUsed,false);assert.equal(j.sourceWorksiteCountryProof.exactWorksiteAddressVerified,false)}
 const held=audit.heldRecords[0];assert.deepEqual(held.model.tree,oracle.roles['602'].tree);assert.deepEqual(held.model,held.closingModel);assert.equal(held.country,null);assert.equal(held.sourceDetailComplete,false);assert.equal(held.sourceCountryScopeUnresolved,true);assert.equal(held.model.openPositions,5)
 assert.equal(audit.originalResponses.length,52);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.publisherProgramsExecuted,false);assert.equal(audit.applicationInteractions,0)
})
test('Finacus default Fetch transport uses the same declared public GETs and complete models',async()=>{const r=await replay({useDefaultTransport:true});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,19);assert.equal(r.calls.length,52)})
test('Finacus zero cap performs no IO or observation clock call and cannot certify an empty company',async()=>{const r=await replay({maxJobs:0,now:()=>{throw Error('unused clock')}});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.calls.length,0);assert.equal(r.jobs.length,0);assert.equal(readInventoryEvidence(r.jobs).status,'coverage-gap');assert.equal(readSourceObservationEvidence(r.jobs,'finacussolutions').observedRecordCount,0)})
test('Finacus positive output cap still closes every role including the held regional row',async()=>{let audit;const r=await replay({maxJobs:1,onAudit:a=>{audit=a}});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,1);assert.equal(r.calls.length,52);assert.equal(r.calls.filter(c=>c.url===detail('602')).length,2);assert.equal(audit.records.length,19);assert.equal(audit.heldRecords.length,1);assert.equal(readSourceObservationEvidence(r.jobs,'finacussolutions').observedRecordCount,20)})
for(const opts of [{maxJobs:-1},{maxJobs:1.2},{maxJobs:'1'},{maxJobs:NaN},{maxPages:1},{maxPages:0},{readTimeoutMs:15001},{sourceTimeoutMs:180001},{observerTimeoutMs:0},{timeoutMs:180001}])test('Finacus invalid caps or budgets fail before IO '+JSON.stringify(opts),async()=>{const r=await replay(opts);assert.equal(r.rejected,true);assert.ok(r.error instanceof RangeError);assert.equal(r.calls.length,0)})
test('Finacus an invalid observation clock fails before IO',async()=>{const r=await reject({now:()=> 'invalid'});assert.equal(r.calls.length,0)})
for(const reason of [Object.freeze({caller:'before'}),null,0,'cancel'])test('Finacus preserves exact pre-aborted caller reason '+String(reason),async()=>{const c=new AbortController();c.abort(reason);const r=await replay({signal:c.signal});assert.equal(r.rejected,true);assert.equal(r.error,reason);assert.equal(r.calls.length,0)})

for(const [label,change]of[
 ['wrong heading',s=>s.replace('<h3>Sales Coordinator','<h3>Another role')],
 ['zero positions',s=>s.replace('2 Position','0 Position')],
 ['negative positions',s=>s.replace('2 Position','-2 Position')],
 ['missing gender criterion',s=>s.replace(/<li><strong>Gender<\/strong>[^<]*<\/li>/,'')],
 ['duplicate metadata',s=>s.replace('<strong>Department</strong>','<strong>Gender</strong>')],
 ['unknown country metadata',s=>s.replace('<strong>Department</strong>','<strong>Country</strong>')],
 ['hidden full criteria',s=>s.replace('career-offset-content bullet-list singlepostcontent','career-offset-content bullet-list singlepostcontent" hidden="')],
 ['hidden added requirement',s=>append(s,'<p hidden>Mandatory licence.</p>')],
 ['inert requirement',s=>append(s,'<template><p>Mandatory licence.</p></template>')],
 ['unsupported requirement table',s=>append(s,'<table><tr><td>Mandatory licence.</td></tr></table>')],
 ['external requirements',s=>append(s,'<a href="https://unrelated.invalid/criteria.pdf">Full requirements</a>')],
 ['scripted requirement',s=>append(s,'<script>globalThis.__finacusProgramExecuted=true</script>')],
 ['stable filled notice',s=>append(s,'<p>This position has been filled.</p>')],
 ['stable closed notice',s=>append(s,'<p>This role is closed.</p>')],
 ['stable ended applications',s=>append(s,'<p>We are no longer accepting applications.</p>')],
 ['foreign employer assertion',s=>append(s,'<p>Employer: Another company</p>')],
 ['foreign country assertion',s=>append(s,'<p>Worksite country: Canada</p>')],
])test('Finacus rejects incomplete or conflicting '+label,async()=>{const r=await reject({change:roleChange('233',change)});assert.ok(r.calls.filter(c=>c.url.startsWith(home+'wp-admin/')).length<=2);assert.equal(globalThis.__finacusProgramExecuted,undefined)})
test('Finacus preserves inline qualifiers without inserting spaces inside authored words',async()=>{const r=await replay({change:roleChange('233',s=>append(s,'<p>Must hold a C<strong>PA</strong> licence.</p>'))});assert.equal(r.rejected,false,r.error?.message);assert.match(r.jobs[0].jobDescription,/Must hold a CPA licence\./)})
test('Finacus disagreement between native opening-count components is held',async()=>{await reject({change:roleChange('615',s=>s.replace('IMPS - 2, ATM Monitoring - 2','IMPS - 3, ATM Monitoring - 2'))})})
for(const [label,change]of[
 ['whole criteria',s=>append(s,'<p>Mandatory licence.</p>')],
 ['gender criterion',s=>s.replace('Female/ Male','Female')],
 ['experience',s=>s.replace('2+ years','3+ years')],
 ['opening count',s=>s.replace('2 Position','3 Position')],
 ['unknown native attribute',s=>s.replace('<h3>','<h3 class="changed">')],
])test('Finacus rejects closing-only '+label,async()=>{const r=await reject({change:roleChange('233',change,true)});assert.equal(r.calls.filter(c=>c.url===detail('233')).length,2)})
test('Finacus reconciles the held multi-region role too',async()=>{const r=await reject({change:roleChange('602',s=>append(s,'<p>New regional requirement.</p>'),true)});assert.equal(r.calls.filter(c=>c.url===detail('602')).length,2)})
for(const location of ['Toronto, Mumbai','Mumbai, Canada','Mumbai / Singapore','Delhi','Seepz','South Region',''])test('Finacus has no city-suffix or headquarters-country default for '+JSON.stringify(location),async()=>{
 const r=await replay({change:roleChange('233',s=>s.replace('<strong>Location</strong> : Mumbai','<strong>Location</strong> : '+location))})
 if(!location){assert.equal(r.rejected,true);return}
 assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,18);assert.ok(!r.jobs.some(j=>j.jobId==='233'));assert.equal(r.jobs.nativeCollectionEvidence.heldCountryRecords,2);assert.equal(r.jobs.nativeCollectionEvidence.heldRecords.find(j=>j.jobId==='233').country,null)
})
for(const [label,change]of[
 ['foreign city country',s=>s.replace('headquarters in Mumbai, India','headquarters in Mumbai, Canada')],
 ['inactive page',s=>'<template>'+s+'</template>'],
 ['hidden own relation',s=>s.replace('<p>From our headquarters','<p hidden>From our headquarters')],
 ['CSS-hidden own relation',s=>'<style>p{display:none}</style>'+s],
 ['shadowed country relation',s=>s.replace('</body>','<p>Our headquarters is in Mumbai, Canada.</p></body>')],
 ['relation in unrelated section',s=>s.replace('zoom-image-row','unbound-image-row')],
 ['employer identity',s=>s.replaceAll('Finacus Solutions Private Limited','Another Company Private Limited')],
])test('Finacus rejects '+label+' before role reads',async()=>{const r=await reject({change:p=>p.url===about?change(p.text):p.text});assert.equal(r.calls.filter(c=>c.url.startsWith(home+'wp-admin/')).length,0)})
test('Finacus closing own country context is read afresh',async()=>{const r=await reject({change:p=>p.url===about&&p.n===2?p.text.replace('headquarters in Mumbai, India','headquarters in Mumbai, Canada'):p.text});assert.equal(r.calls.filter(c=>c.url===about).length,2);assert.equal(r.calls.filter(c=>c.url===detail('233')).length,1)})
for(const [label,change]of[
 ['inactive corporate navigation',s=>'<template>'+s+'</template>'],
 ['foreign About handoff',s=>s.replaceAll(about,'https://unrelated.invalid/about/')],
 ['foreign careers handoff',s=>s.replaceAll(careers,'https://unrelated.invalid/careers/')],
])test('Finacus rejects '+label,async()=>{const r=await reject({change:p=>p.url===home?change(p.text):p.text});assert.equal(r.calls.length,1)})
test('Finacus closing corporate handoff is read afresh',async()=>{const r=await reject({change:p=>p.url===home&&p.n===2?p.text.replaceAll(careers,'https://unrelated.invalid/careers/'):p.text});assert.equal(r.calls.filter(c=>c.url===home).length,2)})
for(const [label,change]of[
 ['duplicate card',s=>s.replace('data-id="598"','data-id="233"')],
 ['hidden card',s=>s.replace('data-id="233"','hidden data-id="233"')],
 ['inert card copy',s=>s.replace('data-id="233"','inert data-id="233"')],
 ['card text mismatch',s=>s.replace('data-career-position="Sales Coordinator','data-career-position="Other role')],
 ['configuration mutation',s=>s.replace('var finacus_ajax_obj', 'finacus_ajax_obj.ajaxurl="https://unrelated.invalid/"; var finacus_ajax_obj')],
 ['duplicate JSON setting',s=>s.replace('{"ajaxurl":','{"ajaxurl":"https://unrelated.invalid/","ajaxurl":')],
])test('Finacus rejects '+label+' before role reads',async()=>{const r=await reject({change:p=>p.url===careers?change(p.text):p.text});assert.equal(r.calls.filter(c=>c.url.startsWith(home+'wp-admin/')).length,0)})
test('Finacus closing full card model is reconciled',async()=>{const r=await reject({change:p=>p.url===careers&&p.n===2?p.text.replace('class="btn-ca positionget"','class="btn-ca positionget changed"'):p.text});assert.equal(r.calls.filter(c=>c.url===careers).length,2)})
test('Finacus changed published client blocks role reads and is never executed',async()=>{const r=await reject({change:p=>p.url.includes('simple-ajax-careers-position.js')?p.text+';globalThis.__finacusProgramExecuted=true;':p.text});assert.equal(r.calls.filter(c=>c.url.startsWith(home+'wp-admin/')).length,0);assert.equal(globalThis.__finacusProgramExecuted,undefined)})
test('Finacus closing published client is verified afresh',async()=>{await reject({change:p=>p.url.includes('main.js?')&&p.n===2?p.text+'/*changed*/':p.text})})

for(const status of [403,404,429,500])test('Finacus stops on HTTP '+status+' without retry or alternate URL',async()=>{const r=await reject({responseChange:()=>({status})});assert.equal(r.calls.length,1)})
for(const [label,options]of[
 ['wrong response identity',{responseChange:()=>({finalURL:'https://unrelated.invalid/'})}],
 ['wrong MIME',{responseChange:()=>({contentType:'application/json'})}],
 ['wrong byte digest',{responseChange:()=>({bodySHA256:'0'.repeat(64)})}],
 ['invalid UTF8',{changeBytes:()=>Buffer.from([0xc3,0x28])}],
 ['NUL',{changeBytes:()=>Buffer.from('<p>\0</p>')}],
 ['empty body',{changeBytes:()=>Buffer.alloc(0)}],
 ['oversized bytes',{changeBytes:()=>Buffer.alloc(4*1024*1024+1,32)}],
])test('Finacus rejects original '+label,async()=>{const r=await reject(options);assert.equal(r.calls.length,1);assert.equal(r.error.nativeOriginalResponses.length,1)})
test('Finacus enforces its aggregate original byte budget',async()=>{const r=await reject({changeBytes:p=>p.url.startsWith(home+'wp-admin/')?Buffer.concat([p.bytes,Buffer.alloc(4*1024*1024-p.bytes.length,32)]):p.bytes});assert.match(r.error.message,/oversized/);assert.ok(r.calls.length<26)})
test('Finacus stalled reads terminate under the read budget',async()=>{let calls=0;const r=await reject({readTimeoutMs:20,fetchResponse:()=>{calls++;return new Promise(()=>{})}});assert.match(r.error.message,/read\/body deadline/);assert.equal(calls,1)})
test('Finacus source deadline covers uncooperative reads',async()=>{await reject({sourceTimeoutMs:20,fetchResponse:()=>new Promise(()=>{})})})
for(const [label,option]of[['read/body','readTimeoutMs'],['source','sourceTimeoutMs']])test('Finacus '+label+' deadline checks synchronous elapsed time',async t=>{
 const realNow=performance.now.bind(performance);let elapsed=0,calls=0;t.mock.method(performance,'now',()=>realNow()+elapsed)
 const r=await reject({[option]:20,fetchResponse:url=>{calls++;const p=packets.get(url);elapsed+=25;return{...p,bytes:Buffer.from(p.bodyBase64,'base64')}}});assert.match(r.error.message,new RegExp(label+' deadline'));assert.equal(calls,1)
})
test('Finacus observer deadline checks synchronous elapsed time',async t=>{const realNow=performance.now.bind(performance);let elapsed=0;t.mock.method(performance,'now',()=>realNow()+elapsed);const r=await reject({observerTimeoutMs:20,onAudit:()=>{elapsed+=25}});assert.match(r.error.message,/observer deadline/)})
for(const reason of [Object.freeze({caller:'pending'}),null,0,'pending stop'])test('Finacus cancellation settles an uncooperative read with exact reason '+String(reason),async()=>{const c=new AbortController();let calls=0;const r=await replay({signal:c.signal,fetchResponse:()=>{calls++;queueMicrotask(()=>c.abort(reason));return new Promise(()=>{})}});assert.equal(r.rejected,true);assert.equal(r.error,reason);assert.equal(calls,1)})
test('Finacus observers are awaited and receive detached whole models and originals',async()=>{let finished=false;const r=await replay({onAudit:async a=>{await Promise.resolve();a.records[0].nativeSourceRecord.metadata.Gender='mutated';a.heldRecords[0].model.metadata.Gender='mutated';a.originalResponses[0].bodyBase64='mutated';finished=true},onRecords:rows=>{rows[0].title='mutated'}});assert.equal(r.rejected,false,r.error?.message);assert.equal(finished,true);assert.equal(r.jobs[0].title,'Sales Coordinator');assert.equal(r.jobs[0].nativeSourceRecord.metadata.Gender,oracle.roles['233'].metadata.Gender);assert.equal(r.jobs.nativeCollectionEvidence.heldRecords[0].model.metadata.Gender,oracle.roles['602'].metadata.Gender)})
test('Finacus stalled observers are bounded',async()=>{const r=await reject({observerTimeoutMs:20,onAudit:()=>new Promise(()=>{})});assert.match(r.error.message,/observer deadline/)})
test('Finacus observer caller cancellation preserves a falsy reason',async()=>{const c=new AbortController(),r=await replay({signal:c.signal,onAudit:()=>{c.abort(0);return new Promise(()=>{})}});assert.equal(r.rejected,true);assert.equal(r.error,0)})
test('Finacus complete original responses survive registry decoration and are detached on read',async()=>{
 const{readFinacusOriginalResponses}=await import('../scraper/finacussolutions/nativeCurrent.js'),r=await replay();assert.equal(r.rejected,false,r.error?.message);const originals=readFinacusOriginalResponses(r.jobs);assert.equal(originals.length,52)
 for(const p of originals){assert.equal(p.originalBodyComplete,true);assert.equal(sha(Buffer.from(p.bodyBase64,'base64')),p.bodySHA256)}originals.pop();originals[0].headers.changed=true;assert.equal(readFinacusOriginalResponses(r.jobs).length,52);assert.equal(readFinacusOriginalResponses(r.jobs)[0].headers.changed,undefined)
})
test('Finacus cancels a stalled default response body at the read deadline',async()=>{let cancelled=false;const response=new Response(new ReadableStream({pull:()=>new Promise(()=>{}),cancel:()=>{cancelled=true}}),{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:home});const r=await reject({readTimeoutMs:20,fetchResponse:undefined,fetchImpl:async()=>response});assert.match(r.error.message,/deadline/);await new Promise(r=>setTimeout(r,0));assert.equal(cancelled,true)})
test('Finacus late default bodies are cancelled with the exact caller reason',async()=>{const c=new AbortController(),reason=Object.freeze({caller:'late'});let deliver,cancelled;const pending=replay({signal:c.signal,fetchResponse:undefined,fetchImpl:()=>new Promise(resolve=>{deliver=resolve;queueMicrotask(()=>c.abort(reason))})}),r=await pending;assert.equal(r.rejected,true);assert.equal(r.error,reason);const response=new Response(new ReadableStream({cancel:value=>{cancelled=value}}));Object.defineProperty(response,'url',{value:home});deliver(response);await new Promise(r=>setTimeout(r,0));assert.equal(cancelled,reason)})
test('Finacus cancels and releases the first oversized stream chunk',async()=>{let reads=0,cancelled=false,released=false;const r=await reject({fetchResponse:undefined,fetchImpl:async()=>({url:home,status:200,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:async()=>{reads++;return{done:false,value:new Uint8Array(4*1024*1024+1)}},cancel:()=>{cancelled=true},releaseLock:()=>{released=true}})}})});assert.match(r.error.message,/byte limit/);assert.equal(reads,1);assert.equal(cancelled,true);assert.equal(released,true)})
test('Finacus denied headers cancel stalled bodies and prevent queued role reads',async()=>{
 let roleReads=0,cancelled=false
 const r=await reject({readTimeoutMs:250,fetchResponse:undefined,fetchImpl:async url=>{const p=packets.get(url);assert.ok(p);if(url.startsWith(home+'wp-admin/'))roleReads++;const response=url===detail('233')?new Response(new ReadableStream({pull:()=>new Promise(()=>{}),cancel:()=>{cancelled=true}}),{status:403,headers:{'content-type':'text/html'}}):new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:url});return response}})
 assert.match(r.error.message,/HTTP 403/);assert.ok(roleReads<=2,'Only admitted in-flight readers may start');await new Promise(r=>setTimeout(r,0));assert.equal(cancelled,true)
})
test('Finacus legacy text compatibility remains discovery-only with unknown countries',async()=>{
 const r=await replay({fetchText:async()=>Buffer.from(packets.get(careers).bodyBase64,'base64').toString(),fetchDetailText:async id=>Buffer.from(packets.get(detail(id)).bodyBase64,'base64').toString()});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,20);assert.ok(r.jobs.every(j=>j.country===null&&j.sourceDetailComplete===false&&j.lifecycleCleanupAllowed===false));assert.equal(readInventoryEvidence(r.jobs).status,'discovery-only')
})
for(const notice of ['This position has been filled. Thank you for your interest.','Applications are closed. This role is no longer open. Please see other vacancies.'])test('Finacus review rejects a closure statement within a longer notice '+notice,async()=>{await reject({change:roleChange('233',s=>append(s,'<p>'+notice+'</p>'))})})
for(const statement of ['Work location: Toronto, Canada.','This position is based in Toronto, Canada.','Employer - Another Company','Work location'])test('Finacus review holds an explicit unreviewed placement or employer statement '+statement,async()=>{await reject({change:roleChange('233',s=>append(s,'<p>'+statement+'</p>'))})})
test('Finacus review retains a failed default network attempt with its upstream cause',async()=>{const cause=new TypeError('fetch failed: ECONNRESET'),r=await replay({fetchResponse:undefined,fetchImpl:async()=>{throw cause}});assert.equal(r.rejected,true);assert.match(r.error?.message,/Finacus native public GET failed/);assert.equal(r.error.cause,cause);assert.equal(r.error.nativeOriginalResponses.length,1);assert.equal(r.error.nativeOriginalResponses[0].requestedURL,home);assert.equal(r.error.nativeOriginalResponses[0].originalBodyComplete,false)})
test('Finacus own country context cannot ignore a non-paragraph conflicting country statement',async()=>{await reject({change:p=>p.url===about?p.text.replace('<p>From our headquarters','<h5>Headquarters country: Canada.</h5><p>From our headquarters'):p.text})})
