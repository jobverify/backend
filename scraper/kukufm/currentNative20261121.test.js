import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
import {gunzipSync} from 'node:zlib'
import {run} from './nativeData20261115.js'
import {readKukuBoard,readKukuProtocol} from './currentProtocol20261121.js'
import {readKukuRole,nativeKukuPageURL} from './currentNative20261121.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
const prefix=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-declared-prefix-20261121.json.gz',import.meta.url))))
const realFetch=globalThis.fetch;globalThis.fetch=()=>Promise.reject(Error('Network disabled in source-original tests'));process.on('exit',()=>{globalThis.fetch=realFetch})
function response(r,bytes=Buffer.from(r.bodyBase64,'base64')){return Object.defineProperty(new Response(bytes,{status:r.status,headers:r.headers}),'url',{value:r.finalURL})}
test('Kuku actual current board and three declared programmes reach their currently consumed company listing without whole-byte pins',async t=>{
 let clock=0;t.mock.method(performance,'now',()=>clock)
 const queue=structuredClone(prefix.responses),calls=[],listing='https://api.pyjamahr.com/api/career/jobs/?company_uuid=8B92017E1E&page=1&is_careers_page=true',reason=Object.freeze({boundary:'unread current native listing'})
 try{await run({now:prefix.observedAt,fetchImpl:async(url,init)=>{clock+=600;calls.push(url);assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');if(url===listing)throw reason;const r=queue.shift();assert.ok(r,'Only current native declared prefix may be read');assert.equal(url,r.requestedURL);return response(r)}})}catch(error){assert.equal(error,reason)}
 assert.equal(queue.length,0);assert.equal(calls.at(-1),listing)
})
export {prefix,response}

const sourcePrefix=()=>({board:readKukuBoard(Buffer.from(prefix.responses[0].bodyBase64,'base64').toString()),responses:prefix.responses.slice(1).map(r=>({url:r.requestedURL,body:Buffer.from(r.bodyBase64,'base64').toString()}))})
function changeProgram(responses,fragment,replacement){const matches=responses.filter(r=>r.body.includes(fragment));assert.equal(matches.length,1,'Unique actual native programme');assert.equal(matches[0].body.split(fragment).length,2,'Unique actual native statement');matches[0].body=matches[0].body.replace(fragment,replacement)}
test('Kuku actual active route/native client/query/detail/card declarations bind without executing downloaded JavaScript',()=>{const p=sourcePrefix(),r=readKukuProtocol(p.board,p.responses);assert.equal(r.apiOrigin,'https://api.pyjamahr.com');assert.equal(r.downloadedJavaScriptExecuted,false);assert.equal(r.routeModuleID,51485);assert.equal(r.httpClientModuleID,29437)})
for(const[label,old,next]of[
 ['consumed API origin','baseURL:"https://api.pyjamahr.com",timeout:3e4','baseURL:"https://other.example",timeout:3e4'],
 ['consumed UUID input','encodeURIComponent(e.company_uuid.trim())','encodeURIComponent("OTHER")'],
 ['consumed router query','(0,g.bG)((0,g.$E)(fe,n,xe,ye,L,O,R,F))','(0,g.bG)((0,g.$E)({company_uuid:"OTHER"},n,xe,ye,L,O,R,F))'],
 ['HTTP instance export','t.Z=c},65881','t.Z=otherClient},65881'],
 ['HTTP client auth options','baseURL:"https://api.pyjamahr.com",timeout:3e4','baseURL:"https://api.pyjamahr.com",auth:{username:"other"},timeout:3e4'],
 ['native apply query constant','APPLY_NOW:"apply_now"','APPLY_NOW:"foreign_apply"'],
 ['native account query extension','u&&(c+="&query=".concat(u)),c},ee=','u&&(c+="&query=".concat(u)),c+="&company_uuid=OTHER",c},ee='],
 ['native apply account value','.concat(ae[Y.w.UUID],"&")','.concat("OTHER","&")'],
 ['dormant bootstrap with an unconsumed registration literal','return t=72469,e(e.s=t);var t','if(false){t=72469}return t=1,e(e.s=t);var t'],
 ['dormant GET helper','V=function(e){return $.Z.get("".concat(e)).then((function(e){return e.data})).catch((function(e){(0,w.$)(e)}))}','V=function(e){function unused(){return $.Z.get("".concat(e)).then((function(e){return e.data})).catch((function(e){(0,w.$)(e)}))}return null}'],
 ['uninvoked nested listing consumer','(0,g.bG)((0,g.$E)(fe,n,xe,ye,L,O,R,F))','(function unusedListing(){return (0,g.bG)((0,g.$E)(fe,n,xe,ye,L,O,R,F))})'],
 ['disconnected active native card renderer','itemContent:function(e){return(0,Z.jsx)(ft.Z,','itemContent:function(e){return(0,Z.jsx)("div",'],
 ['local consumer shadow','var t,n,i,r,o=arguments;return a().wrap','var g={bG:other,$E:other},t,n,i,r,o=arguments;return a().wrap'],
 ['native role ID query key','we="".concat(Y._.CAREER,"?").concat(Y.w.COMPANY,"=").concat(f,"&").concat(Y.w.JOB_ID','we="".concat(Y._.CAREER,"?").concat(Y.w.COMPANY,"=").concat(f,"&").concat(Y.w.OTHER'],
 ['route programme registration','push(["/careers",function(){return n(51485)}])','push(["/other",function(){return n(51485)}])']
])test('Kuku '+label+' mutation cannot be replaced by unconsumed source literals',()=>{const p=sourcePrefix();changeProgram(p.responses,old,next);assert.throws(()=>readKukuProtocol(p.board,p.responses),/Kuku FM current native contract/)})
test('Kuku unrelated whole-document text may change while exact authored employer and programme declarations stay bound',()=>{const html=Buffer.from(prefix.responses[0].bodyBase64,'base64').toString(),r=readKukuBoard(html.replace('</body>','<footer>Updated public footer text</footer></body>'));assert.equal(r.company.uuid,'8B92017E1E');assert.equal(r.programs.length,3)})
export {sourcePrefix,changeProgram}

const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-data-20261116.json.gz',import.meta.url)))),profile=JSON.parse(fs.readFileSync(new URL('./reviewedNativeData20261115.json',import.meta.url))),selected=new Set(profile.reviewedSelectedRoles.map(r=>r.id)),rows=profile.listingPages.flatMap(p=>p.reviewedCompleteNativePage.results).filter(r=>selected.has(r.id))
function transaction(t,edit=()=>{}){
 let clock=0;t.mock.method(performance,'now',()=>clock)
 const queue=[]
 for(const phase of['opening','closing']){
  queue.push(...structuredClone(prefix.responses))
  queue.push({requestedURL:'https://api.pyjamahr.com/api/career/jobs/?company_uuid=8B92017E1E&page=1&is_careers_page=true',finalURL:'https://api.pyjamahr.com/api/career/jobs/?company_uuid=8B92017E1E&page=1&is_careers_page=true',status:200,headers:{'content-type':'application/json'},bodyBase64:Buffer.from(JSON.stringify({count:6,next:null,previous:null,results:rows})).toString('base64')})
  for(const row of rows){const r=historical.entities.find(r=>r.phase===phase&&r.requestedURL===profile.reviewedSelectedRoles.find(r=>r.id===row.id).nativeLandingURL);assert.ok(r,'A genuine whole historical role SSR original is required');queue.push({...structuredClone(r),bodyBase64:r.rawBodyBase64})}
 }
 edit(queue);const calls=[]
 return {queue,calls,fetchImpl:async(url,init)=>{clock+=600;const r=queue.shift();assert.ok(r,'Only controlled mixed-date originals permitted');assert.equal(url,r.requestedURL);assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');calls.push(url);return response(r)}}
}
function ssrEdit(queue,index,change){const r=queue[index],html=Buffer.from(r.bodyBase64,'base64').toString(),marker='<script id="__NEXT_DATA__" type="application/json">',start=html.indexOf(marker)+marker.length,end=html.indexOf('</script>',start),model=JSON.parse(html.slice(start,end));assert.ok(start>=marker.length);change(model);r.bodyBase64=Buffer.from(html.slice(0,start)+JSON.stringify(model)+html.slice(end)).toString('base64')}
function pageEdit(queue,index,change){const r=queue[index],model=JSON.parse(Buffer.from(r.bodyBase64,'base64'));change(model);r.bodyBase64=Buffer.from(JSON.stringify(model)).toString('base64')}
test('Kuku controlled mixed-date six-role transaction retains every complete old SSR/DTO/question and current native programme; this is not a physical current count',async t=>{
 const r=transaction(t),provider=getScraperCatalog().find(p=>p.source==='kukufm'),jobs=await createCatalogScraper(provider).run({fetchImpl:r.fetchImpl,now:prefix.observedAt})
 assert.equal(r.queue.length,0);assert.equal(r.calls.length,22);assert.equal(jobs.length,6)
 const a=jobs.nativeCollectionEvidence;assert.equal(a.observedVacancyCount,6);assert.equal(a.wholeNativeRoleModelsClosingReconciled,true);assert.equal(a.companyGlobalTotal,null);assert.equal(a.companyIndiaTotal,null);assert.equal(a.lifecycleCleanupAllowed,false)
 for(const j of jobs){assert.equal(j.requisitionId,null);assert.equal(j.postingDate,null);assert.equal(j.country,'India');assert.equal(j.activeApplyVerified,false);assert.equal(j.applyUrl,j.sourceUrl+'&apply_now=true');assert.equal(j.closingDate,j.sourceNativeRecord.valid_through);assert.deepEqual(j.sourceNativeQuestions,j.sourceNativeRecord.job_screening_questions);for(const q of j.sourceNativeQuestions)assert.ok(j.jobDescription.includes(q.question))}
})
test('Kuku native next/previous query ordering stays literal and all extra/duplicate account parameters are rejected',()=>{assert.equal(nativeKukuPageURL('https://api.pyjamahr.com/api/career/jobs/?company_uuid=8B92017E1E&is_careers_page=true&page=2',2),true);for(const value of['https://api.pyjamahr.com/api/career/jobs/?company_uuid=8B92017E1E&page=2&is_careers_page=true&search=India','https://api.pyjamahr.com/api/career/jobs/?company_uuid=8B92017E1E&company_uuid=OTHER&page=2&is_careers_page=true'])assert.equal(nativeKukuPageURL(value,2),false)})
for(const[label,mutation,expectedHold]of[
 ['missing raw role country',(m,p)=>{m.props.pageProps.job.country=null;p.results[0].country=null},'native-explicit-role-country-unqualified'],
 ['conflicting explicit role country',(m,p)=>{m.props.pageProps.job.country='United States';p.results[0].country='United States'},'native-country/workplace-conflict'],
 ['new authored native criteria field',m=>{m.props.pageProps.job.additionalRequirements='A mandatory new professional licence'},'unreviewed-native-role-fields'],
 ['native expiry',m=>{m.props.pageProps.job.valid_through='2026-11-20T14:48:52.115237+05:30'},'explicit-native-valid-through-expired']
])test('Kuku '+label+' stays as a full held record without withholding other complete roles',async t=>{
 const r=transaction(t,q=>{for(const start of[0,11]){let page;pageEdit(q,start+4,p=>{page=p});ssrEdit(q,start+5,m=>{mutation(m,page)});q[start+4].bodyBase64=Buffer.from(JSON.stringify(page)).toString('base64')}}),jobs=await run({fetchImpl:r.fetchImpl,now:prefix.observedAt}),m=jobs.nativeCollectionEvidence.nativeOpening.models[0]
 assert.equal(jobs.length,5);assert.equal(m.sourceRoleQualified,false);assert.ok(m.qualificationHolds.some(s=>s.startsWith(expectedHold)));assert.ok(m.nativeSourceRecord.description.length>100)
})
test('Kuku complete changed closing criteria preserve both versions and never claim reconciliation',async t=>{const r=transaction(t,q=>ssrEdit(q,16,m=>{m.props.pageProps.job.description+='<p>A mandatory new professional licence is required.</p>'}));await assert.rejects(run({fetchImpl:r.fetchImpl,now:prefix.observedAt}),e=>{const a=e.recruitmentObservations;assert.equal(a.wholeNativeRoleModelsClosingReconciled,false);assert.equal(a.nativeOpening.models.length,6);assert.equal(a.nativeClosing.models.length,6);assert.notEqual(a.nativeOpening.models[0].nativeSourceRecord.description,a.nativeClosing.models[0].nativeSourceRecord.description);return /models changed at closing/.test(e.message)})})
test('Kuku native employer conflict rejects before any job escapes, retaining failed original HTML',async t=>{const r=transaction(t,q=>ssrEdit(q,5,m=>{m.props.pageProps.companyDetails.name='Other Employer'}));await assert.rejects(run({fetchImpl:r.fetchImpl,now:prefix.observedAt}),e=>{assert.equal(e.recruitmentObservations.wholeNativeRoleModelsClosingReconciled,false);assert.ok(e.recruitmentObservations.rawPublisherResponses.at(-1).body.includes('Other Employer'));return /employer/.test(e.message)})})
for(const reason of[Object.freeze({owner:'opaque caller'}),null]){
 test('Kuku exact pre-abort '+String(reason),async()=>{const c=new AbortController();c.abort(reason);await assert.rejects(run({signal:c.signal}),e=>e===reason)})
 test('Kuku final success audit exact caller '+String(reason),async t=>{const c=new AbortController(),r=transaction(t);await assert.rejects(run({fetchImpl:r.fetchImpl,now:prefix.observedAt,signal:c.signal,onAudit(){c.abort(reason)}}),e=>e===reason)})
 test('Kuku error audit exact caller '+String(reason),async t=>{const c=new AbortController(),original=Error('Observed native read failure'),define=Object.defineProperty;t.mock.method(Object,'defineProperty',(object,key,value)=>{const result=define(object,key,value);if(object===original&&key==='recruitmentObservations')c.abort(reason);return result});await assert.rejects(run({signal:c.signal,fetchImpl:async()=>{throw original}}),e=>e===reason)})
}
test('Kuku body-only transport cannot certify current native records',async()=>{await assert.rejects(run({fetchPage:async()=>''}),/original HTTP Response/i)})
test('Kuku native HTTP403 takes priority before a stalled entity can consume source time',async()=>{let reads=0,cancelled=false;const stream=new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}});await assert.rejects(run({sourceTimeoutMs:1000,fetchImpl:async url=>{reads++;return Object.defineProperty(new Response(stream,{status:403,headers:{'content-type':'text/html'}}),'url',{value:url})}}),e=>{assert.equal(e.status,403);const receipts=e.recruitmentObservations.nativeReads.flatMap(r=>r.receipts);assert.equal(receipts[0].status,403);assert.equal(receipts[0].bodyComplete,false);return true});assert.equal(reads,1);assert.equal(cancelled,true)})

function rawEdit(queue,index,change){const r=queue[index],old=Buffer.from(r.bodyBase64,'base64').toString(),next=change(old);assert.notEqual(next,old);r.bodyBase64=Buffer.from(next).toString('base64')}
for(const[label,change,reason]of[
 ['explicit foreign head employer',s=>s.replace(/<title>[^<]*<\/title>/,'<title>Other Employer</title>'),'native-authored-role-head-identity-conflict'],
 ['new authoritative native role schema',s=>s.replace('</head>','<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'JobPosting',title:'Other Role',hiringOrganization:{name:'Other Employer'}})+'</script></head>'),'unreviewed-native-structured-role-criteria']
])test('Kuku '+label+' is retained as an individual qualification hold',async t=>{const r=transaction(t,q=>{for(const index of[5,16])rawEdit(q,index,change)}),jobs=await run({fetchImpl:r.fetchImpl,now:prefix.observedAt}),m=jobs.nativeCollectionEvidence.nativeOpening.models[0];assert.equal(jobs.length,5);assert.equal(m.sourceRoleQualified,false);assert.ok(m.qualificationHolds.includes(reason))})

const currentPhysicalPrefix=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-prefix-20261121.json.gz',import.meta.url))))
test('Kuku actual six-original current prefix accepts its literal implicit-first-page backward link and reaches only the unread next page',async t=>{
 let clock=0;t.mock.method(performance,'now',()=>clock)
 const queue=structuredClone(currentPhysicalPrefix.responses),calls=[],next='https://api.pyjamahr.com/api/career/jobs/?company_uuid=8B92017E1E&is_careers_page=true&page=3',reason=Object.freeze({boundary:'current page3 is unread; inventory remains incomplete'})
 await assert.rejects(run({now:currentPhysicalPrefix.observedAt,fetchImpl:async(url,init)=>{clock+=600;calls.push(url);assert.equal(init.method,'GET');if(url===next)throw reason;const r=queue.shift();assert.ok(r,'Only six genuine current originals may be replayed');assert.equal(url,r.requestedURL);return response(r)}}),e=>e===reason)
 assert.equal(queue.length,0);assert.equal(calls.length,7);assert.equal(calls.at(-1),next)
})
test('Kuku implicit first-page notation is restricted to an exact native backward link, never a missing forward page or account parameter',()=>{
 const first='https://api.pyjamahr.com/api/career/jobs/?company_uuid=8B92017E1E&is_careers_page=true'
 assert.equal(nativeKukuPageURL(first,1),false);assert.equal(nativeKukuPageURL(first,1,2),true);assert.equal(nativeKukuPageURL(first,2,2),false);assert.equal(nativeKukuPageURL(first,1,3),false);assert.equal(nativeKukuPageURL(first,1,1),false)
 for(const bad of[first+'&company_uuid=OTHER',first+'&page=',first+'&page=0',first+'&query=India',first.replace('8B92017E1E','OTHER'),first.replace('is_careers_page=true','is_careers_page=false')])assert.equal(nativeKukuPageURL(bad,1,2),false)
})

const nativeRolePrefix=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-role-prefix-20261121.json.gz',import.meta.url))))
const decodeSSR=r=>JSON.parse(Buffer.from(r.bodyBase64,'base64').toString().match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)[1])
const actualListingRows=nativeRolePrefix.responses.filter(r=>r.requestedURL.startsWith('https://api.pyjamahr.com/')).flatMap(r=>JSON.parse(Buffer.from(r.bodyBase64,'base64')).results)
const actualRolePackets=[nativeRolePrefix.responses[10],nativeRolePrefix.responses.at(-1)],actualRoleModels=actualRolePackets.map(decodeSSR),actualPairRows=actualRoleModels.map(m=>actualListingRows.find(r=>r.id===m.props.pageProps.job.id))
test('Kuku actual406460 full authored criteria are qualified while its exact native expiry remains held',()=>{
 const r=actualRolePackets[1],m=actualRoleModels[1],j=m.props.pageProps.job,result=readKukuRole(Buffer.from(r.bodyBase64,'base64').toString(),actualPairRows[1],m.props.pageProps.companyDetails,nativeRolePrefix.observedAt)
 assert.equal(j.id,406460);assert.ok(j.description.length>4000);assert.equal(result.sourceRoleQualified,false);assert.deepEqual(result.qualificationHolds,['explicit-native-valid-through-expired']);assert.equal(result.sourceNativeCriteriaComplete,true);assert.equal(result.sourceNativeValidThrough,'2026-11-15T12:51:29.418451+05:30');assert.deepEqual(result.nativeSourceRecord,j);assert.deepEqual(result.nativeSSRModel,m);assert.ok(result.sourceDescription.includes('Who We\'re Looking For'));assert.ok(result.sourceDescription.includes(j.job_screening_questions[0].question));assert.equal(result.nativeCountryRaw,'India');assert.equal(result.sourcePostingDatePublished,false);assert.equal(result.sourceNativeCreatedAt,j.created_at)
})
function currentTwoRoleTransaction(t,edit=()=>{}){
 let clock=0;t.mock.method(performance,'now',()=>clock);const queue=[]
 for(const phase of['opening','closing']){queue.push(...structuredClone(nativeRolePrefix.responses.slice(0,4)));const url='https://api.pyjamahr.com/api/career/jobs/?company_uuid=8B92017E1E&page=1&is_careers_page=true';queue.push({requestedURL:url,finalURL:url,status:200,headers:{'content-type':'application/json'},bodyBase64:Buffer.from(JSON.stringify({count:2,next:null,previous:null,results:actualPairRows})).toString('base64')});queue.push(...structuredClone(actualRolePackets))}
 edit(queue);return{queue,fetchImpl:async(url,init)=>{clock+=600;const r=queue.shift();assert.ok(r,'Only controlled two-role originals permitted');assert.equal(url,r.requestedURL);assert.equal(init.method,'GET');return response(r)}}
}
test('Kuku controlled two-role replay holds truly empty criteria individually while retaining every raw field and the other current complete role',async t=>{
 const r=currentTwoRoleTransaction(t,q=>{for(const i of[6,13])ssrEdit(q,i,m=>{m.props.pageProps.job.description=''})}),jobs=await run({fetchImpl:r.fetchImpl,now:nativeRolePrefix.observedAt}),a=jobs.nativeCollectionEvidence,held=a.nativeOpening.models[1]
 assert.equal(r.queue.length,0);assert.equal(jobs.length,1);assert.equal(held.id,406460);assert.equal(held.sourceRoleQualified,false);assert.equal(held.sourceNativeCriteriaComplete,false);assert.ok(held.qualificationHolds.includes('native-substantive-authored-role-criteria-unqualified'));assert.equal(held.nativeCountryRaw,'India');assert.equal(held.nativeSourceRecord.description,'');assert.equal(a.nativeClosing.models[1].nativeSourceRecord.description,'');assert.deepEqual(held.nativeSourceRecord.job_screening_questions,actualRoleModels[1].props.pageProps.job.job_screening_questions);assert.equal(a.wholeNativeRoleModelsClosingReconciled,true);assert.equal(a.lifecycleCleanupAllowed,false)
})
test('Kuku controlled closing complete-to-empty criteria drift keeps both full current native models and never claims reconciliation',async t=>{
 const r=currentTwoRoleTransaction(t,q=>ssrEdit(q,13,m=>{m.props.pageProps.job.description=''}))
 await assert.rejects(run({fetchImpl:r.fetchImpl,now:nativeRolePrefix.observedAt}),e=>{const a=e.recruitmentObservations;assert.equal(a.wholeNativeRoleModelsClosingReconciled,false);assert.equal(a.nativeOpening.models[1].nativeSourceRecord.description,actualRoleModels[1].props.pageProps.job.description);assert.equal(a.nativeClosing.models[1].nativeSourceRecord.description,'');assert.equal(a.nativeClosing.models[1].sourceRoleQualified,false);assert.ok(a.rawPublisherResponses.some(r=>r.phase==='closing'&&r.body.includes('406460')));return /models changed at closing/.test(e.message)})
})
test('Kuku exact55-original registered prefix continues beyond the wrongly rejected complete406460 role to its next unread detail',async t=>{
 let clock=0;t.mock.method(performance,'now',()=>clock);const queue=structuredClone(nativeRolePrefix.responses),calls=[],reason=Object.freeze({abortRetries:true,source:'kukufm',boundary:'next detail remains unread; no closing/current total claimed'})
 await assert.rejects(createCatalogScraper(getScraperCatalog().find(p=>p.source==='kukufm')).run({now:nativeRolePrefix.observedAt,fetchImpl:async(url,init)=>{clock+=600;calls.push(url);if(!queue.length)throw reason;const r=queue.shift();assert.equal(url,r.requestedURL);assert.equal(init.method,'GET');return response(r)}}),e=>e===reason)
 assert.equal(queue.length,0);assert.equal(calls.length,56)
})

test('Kuku current public factory can be imported first in a clean process and preserves exact pre-abort without physical reads',()=>{
 const url=new URL('./currentNative20261121.js',import.meta.url).href,program=`import assert from 'node:assert/strict';let calls=0;globalThis.fetch=()=>{calls++;throw Error('No network')};const {createCurrentKukuFMScraper}=await import(${JSON.stringify(url)});const c=new AbortController(),reason=Object.freeze({caller:'exact'});c.abort(reason);await assert.rejects(createCurrentKukuFMScraper().run({signal:c.signal}),e=>e===reason);assert.equal(calls,0);`
 const r=spawnSync(process.execPath,['--input-type=module','-e',program],{encoding:'utf8'});assert.equal(r.status,0,r.stderr)
})
