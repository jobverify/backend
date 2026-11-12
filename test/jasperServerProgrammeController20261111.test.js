import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {setTimeout as delay} from 'node:timers/promises'
import {readCurrentJasperProgramme,runCurrentJasperProgramme} from '../scraper/jasper/currentProgramme.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'

// Every replay uses historical openings with explicitly CONTROLLED reused
// closings. These tests are not current acquisitions or recovery evidence.
let HTTP=0
globalThis.fetch=()=>{HTTP++;throw Error('Jasper controller tests forbid HTTP')}
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/jasper-server-programme-originals-20261111.json.gz',import.meta.url))))
const sha=body=>createHash('sha256').update(body).digest('hex')
const C='https://www.jasper.ai/careers',B='https://jobs.ashbyhq.com/Jasper%20AI',A='https://api.ashbyhq.com/posting-api/job-board/Jasper%20AI'
const packets=()=>fixture.responses.map(r=>({...structuredClone(r.originalReceipt),body:Buffer.from(r.bodyBase64,'base64'),controlledEvidence:'Historical original opening replay; all reused closing bodies are controlled and not independently acquired.'}))
const replay=(rows,edit)=>{
 const calls=[],map=new Map(rows.map(row=>[row.requestedURL,row])),seen=new Map()
 return{calls,readPage:async(url,init)=>{const occurrence=(seen.get(url)??0)+1;seen.set(url,occurrence);calls.push({url,occurrence,maxBodyBytes:init.maxBodyBytes});assert.equal(init.method,'GET');assert.equal(init.cache,'no-store');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');const original=map.get(url);assert.ok(original,'Only an actual declared route may be read');const page={...structuredClone(original),body:Buffer.from(original.body)};return edit?.(page,url,occurrence,init,calls)??page}}
}

test('complete N7 controlled protocol closes every opening before a qualified finite result',async()=>{
 const rows=packets(),transport=replay(rows),result=await readCurrentJasperProgramme({readPage:transport.readPage})
 const urls=rows.map(r=>r.requestedURL),expected=[C,B,A,...urls.slice(3),...urls.slice(3).reverse(),A,B,C]
 assert.equal(transport.calls.length,20,'A pure opening-only result is not a complete current interval')
 assert.deepEqual(transport.calls.map(c=>c.url),expected)
 assert.equal(result.length,0)
 const inventory=readInventoryEvidence(result),observation=readSourceObservationEvidence(result,'jasper'),audit=result.nativeCollectionEvidence
 assert.equal(inventory.status,'complete-inventory');assert.equal(inventory.firstParty,true);assert.equal(inventory.listingComplete,true)
 assert.equal(inventory.reportedTotal,null);assert.equal(inventory.lifecycleCleanupAllowed,false)
 assert.equal(observation.recordKind,'vacancy-rows');assert.equal(observation.observedRecordCount,7);assert.equal(observation.observedVacancyCount,7)
 assert.equal(audit.source,'jasper');assert.equal(audit.archiveNativeCollectionEvidence,true)
 assert.equal(audit.requests,20);assert.equal(audit.nativeProgrammeRequests,20);assert.equal(audit.rawPages.length,20)
 assert.deepEqual(audit.nativePayload,JSON.parse(rows[2].body));assert.equal(audit.nativeRecords.length,7)
 assert.equal(audit.currentTransactionQualified,true);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.sourceBodiesQualified,false);assert.equal(audit.rendererConsumptionQualified,false)
 assert.equal(audit.totalPublicRequests,null);assert.equal(audit.companyGlobalScopeQualified,false)
 assert.equal(HTTP,0)
})

// Keep both public transports callable for the lifecycle controls added after
// the meaningful opening-only RED; a missing export is never that RED.
test('both controller entry points are callable without network',()=>{
 assert.equal(typeof readCurrentJasperProgramme,'function');assert.equal(typeof runCurrentJasperProgramme,'function');assert.equal(sha(Buffer.alloc(0)).length,64)
})

function changed(page,body){body=Buffer.from(body);return{...page,body,bodyBytes:body.length,bodySHA256:sha(body),consumedBodyBytes:body.length,controlledEvidence:'Synthetic altered historical packet, not an acquired publisher observation.'}}
function boot(page,edit){
 const html=page.body.toString(),match=/<script nonce="[^"]+">([\s\S]*?window\.__appData[\s\S]*?)<\/script>/.exec(html);assert.ok(match)
 const source=match[1],expression=parse(source,{ecmaVersion:'latest'}).body[0].expression,model=JSON.parse(source.slice(expression.right.start,expression.right.end));edit(model)
 return changed(page,html.replace(source,source.slice(0,expression.right.start)+JSON.stringify(model)+source.slice(expression.right.end)))
}
function apiEdit(page,edit){const model=JSON.parse(page.body);edit(model);return changed(page,JSON.stringify(model))}
function header(page,name,value){
 const headers={...page.headers},headerEntries=page.headerEntries.filter(([key])=>key!==name).map(pair=>[...pair])
 if(value===null)delete headers[name];else{headers[name]=value;headerEntries.push([name,value])}
 return{...page,headers,headerEntries}
}
function programme(N){
 const rows=packets(),original=JSON.parse(rows[2].body),first=original.jobs[0]
 if(N<=7){rows[2]=apiEdit(rows[2],a=>{a.jobs=a.jobs.slice(0,N)});const ids=new Set(original.jobs.slice(0,N).map(j=>j.id));rows[1]=boot(rows[1],b=>{b.jobBoard.jobPostings=b.jobBoard.jobPostings.filter(j=>ids.has(j.id))});return rows.slice(0,3+N)}
 const expanded=[]
 for(let n=1;n<=N-7;n++){
  const id='00000000-0000-4000-8000-'+String(n).padStart(12,'0'),job=structuredClone(first);job.id=id;job.jobUrl=B+'/'+id;job.applyUrl=job.jobUrl+'/application';expanded.push(job)
  const own=changed(rows[3],rows[3].body.toString().replaceAll(first.id,id));own.id=id;own.requestedURL=job.jobUrl;own.finalURL=job.jobUrl;rows.push(own)
 }
 rows[2]=apiEdit(rows[2],a=>{a.jobs.push(...expanded)})
 rows[1]=boot(rows[1],b=>{const template=b.jobBoard.jobPostings.find(j=>j.id===first.id);for(const job of expanded)b.jobBoard.jobPostings.push({...template,id:job.id})})
 return rows
}
async function hold(options,reason,execute=readCurrentJasperProgramme){
 let error;try{await execute(options)}catch(caught){error=caught}
 assert.ok(error,'The source proof must HOLD')
 if(reason)assert.ok(reason.test(error.reason??error.name),String(error.reason??error.name))
 if(error.nativeCollectionEvidence){assert.equal(error.nativeCollectionEvidence.currentTransactionQualified,false);assert.equal(error.nativeCollectionEvidence.lifecycleCleanupAllowed,false)}
 return error
}

for(const N of [1,10])test('controlled dynamic N'+N+' derives the complete '+(6+2*N)+' read protocol',async()=>{
 const rows=programme(N),transport=replay(rows),result=await readCurrentJasperProgramme({readPage:transport.readPage}),audit=result.nativeCollectionEvidence
 assert.equal(audit.nativeRecords.length,N);assert.equal(audit.requests,6+2*N)
 assert.deepEqual(transport.calls.map(c=>c.url),[C,B,A,...rows.slice(3).map(r=>r.requestedURL),...rows.slice(3).map(r=>r.requestedURL).reverse(),A,B,C])
 assert.equal(readSourceObservationEvidence(result,'jasper').observedVacancyCount,N)
 assert.deepEqual(audit.nativePayload,JSON.parse(rows[2].body))
})

for(const N of [0,11])test('native N'+N+' cannot become an empty or selected subset protocol',async()=>{
 const transport=replay(programme(N)),error=await hold({readPage:transport.readPage},/membership/)
 assert.deepEqual(transport.calls.map(c=>c.url),[C,B]);assert.equal(error.nativeCollectionEvidence.currentTransactionQualified,false)
})

test('unknown full API models hold before any own or closing request',async()=>{
 const rows=programme(1);rows[2]=apiEdit(rows[2],a=>{a.jobs[0].newNativeCriterion='Unreviewed'})
 const transport=replay(rows),error=await hold({readPage:transport.readPage},/api-shape/)
 assert.deepEqual(transport.calls.map(c=>c.url),[C,B,A]);assert.equal(error.nativeCollectionEvidence.rawPages[2].bodySHA256,sha(rows[2].body))
})

test('coherent unknown authored work scope holds at complete opening reconciliation before closing',async()=>{
 const rows=programme(1)
 for(const i of [2,3]){assert.ok(rows[i].body.toString().includes('within the continental US'));rows[i]=changed(rows[i],rows[i].body.toString().replaceAll('within the continental US','around the world'))}
 const transport=replay(rows),error=await hold({readPage:transport.readPage},/criteria-family/)
 assert.equal(transport.calls.length,4);assert.ok(error.nativeCollectionEvidence.rawPages.every(r=>r.phase.startsWith('opening-')))
})

test('full native audit retains exact entities, original clocks, all criteria and immutable ownership',async()=>{
 const rows=programme(1),transport=replay(rows),result=await readCurrentJasperProgramme({readPage:transport.readPage}),audit=result.nativeCollectionEvidence
 assert.ok(Object.isFrozen(audit));assert.ok(Object.isFrozen(audit.rawPages[0]));assert.ok(Object.isFrozen(audit.nativePayload))
 const originals=new Map(rows.map(r=>[r.requestedURL,r]))
 for(const raw of audit.rawPages){const original=originals.get(raw.requestedURL);assert.equal(raw.bodyBase64,original.body.toString('base64'));assert.equal(raw.bodySHA256,sha(original.body));assert.deepEqual(raw.headers,original.headers);assert.deepEqual(raw.headerEntries,original.headerEntries);for(const field of ['requestedAt','responseAt','completedAt'])assert.equal(raw[field],original[field])}
 const first=audit.nativeRecords[0]
 assert.match(first.originalApplicationLimitHTML,/2 times in 60 days/);assert.match(first.originalApplicationLimitHTML,/within 30 days/)
 assert.equal(first.originalPosting.shouldAskForTextingConsent,true);assert.equal(first.originalPosting.candidateTextingPrivacyPolicyUrl,'https://legal.jasper.ai/#candidate-notice')
 assert.match(first.originalAPIHTML,/\$250,000 OTE/);assert.equal(first.primaryWorkCountry,'USA');assert.equal(first.firstPublication,null)
 rows[0].body.fill(0);assert.notEqual(audit.rawPages[0].bodyBase64,rows[0].body.toString('base64'))
 assert.throws(()=>{audit.nativePayload.jobs.pop()},TypeError)
 assert.equal(audit.aggregateBytes,rows.reduce((n,r)=>n+r.body.length,0)*2)
 assert.equal(audit.retainedBytes,audit.aggregateBytes)
})

test('all source openings precede even the first own closing',async()=>{
 const rows=packets(),transport=replay(rows,(_page,_url,occurrence,_init,calls)=>{if(occurrence===2)assert.equal(new Set(calls.map(c=>c.url)).size,rows.length)})
 await readCurrentJasperProgramme({readPage:transport.readPage});assert.equal(transport.calls.length,20)
})

for(const [label,edit]of [
 ['earlier own changes after later acquisition',page=>changed(page,page.body.toString().replaceAll('2+ years','20+ years'))],
 ['unqualified dependency declaration byte changes',page=>{const source=page.body.toString(),match=/frontend_non_user\/([a-f0-9]{40})\//.exec(source);assert.ok(match);return changed(page,source.replaceAll(match[1],'0'.repeat(40)))}]
])test('whole closing guard holds '+label,async()=>{
 const rows=programme(1),own=rows[3].requestedURL,transport=replay(rows,(page,url,n)=>url===own&&n===2?edit(page):page)
 const error=await hold({readPage:transport.readPage},/closing/);assert.equal(error.nativeCollectionEvidence.rawPages.at(-1).phase,'closing-O')
})

test('native API closing array order or even JSON whitespace may not normalize',async()=>{
 for(const change of [p=>changed(p,p.body.toString()+' '),p=>apiEdit(p,a=>a.jobs.reverse())]){
  const transport=replay(packets(),(page,url,n)=>url===A&&n===2?change(page):page)
  const error=await hold({readPage:transport.readPage},/closing/);assert.equal(error.nativeCollectionEvidence.rawPages.at(-1).requestedURL,A)
 }
})

test('a separately known initial own policy still must equal its exact opening policy when closing',async()=>{
 const rows=programme(1),all=packets(),firstNonce=/<meta name="csp-nonce" id="csp-nonce" content="([^"]+)"/.exec(rows[3].body.toString())
 assert.ok(firstNonce)
 const alternate=all[4].headers['content-security-policy'],otherNonce=/'nonce-([^']+)'/.exec(alternate);assert.ok(otherNonce)
 const replacement=alternate.replace(otherNonce[1],firstNonce[1]);assert.notEqual(replacement,rows[3].headers['content-security-policy'])
 const transport=replay(rows,(page,url,n)=>url===rows[3].requestedURL&&n===2?header(page,'content-security-policy',replacement):page)
 const error=await hold({readPage:transport.readPage},/closing/)
 assert.equal(error.nativeCollectionEvidence.rawPages.at(-1).bodySHA256,sha(rows[3].body))
})

for(const name of ['cf-mitigated','cf-chl-out','www-authenticate','refresh','content-disposition','permissions-policy','document-policy'])
 test('initial security holds unreviewed '+name+' before a closing can qualify',async()=>{
  const transport=replay(programme(1),(page,url)=>url===C?header(page,name,name==='refresh'?'0;url=https://unreviewed.example/':'controlled'):page)
  const error=await hold({readPage:transport.readPage},/security/)
  assert.equal(transport.calls.length,1);assert.equal(error.nativeCollectionEvidence.rawPages[0].headers[name],name==='refresh'?'0;url=https://unreviewed.example/':'controlled')
 })

for(const [label,edit,reason]of [
 ['status',p=>({...p,status:403}),/response/],['redirect',p=>({...p,status:302,finalURL:'https://unreviewed.example/'}),/route|response/],
 ['missing finalURL',p=>{delete p.finalURL;return p},/route|response/],['missing original response clock',p=>{delete p.responseAt;return p},/response/],
 ['incomplete',p=>({...p,bodyComplete:false}),/body/],['prefix',p=>({...p,decodedPrefixOnly:true}),/response/],
 ['unfinished',p=>({...p,streamDone:false}),/response/],['error',p=>({...p,error:{message:'controlled incomplete'}}),/response/],
 ['wrong original hash',p=>({...p,bodySHA256:'0'.repeat(64)}),/response/],
 ['UTF16 declaration',p=>header(p,'content-type','text/html; charset=utf-16le'),/encoding/],
 ['unknown CSP',p=>header(p,'content-security-policy',"script-src 'none'"),/security/],
 ['header views disagree',p=>({...p,headerEntries:p.headerEntries.slice(1)}),/headers/],
 ['invalid UTF8',p=>changed(p,Buffer.from([0xff,0xfe])),/encoding/]
])test('flat original response '+label+' is held without another read',async()=>{
 const transport=replay(programme(1),(page,url)=>url===C?edit(page):page),error=await hold({readPage:transport.readPage},reason)
 assert.equal(transport.calls.length,1)
 if(label==='missing original response clock')assert.equal(Object.hasOwn(error.nativeCollectionEvidence.rawPages[0].originalResponse,'responseAt'),false)
})

for(const [field,value]of [['maxRequests',7],['maxRequests',27],['maxResponseBytes',4194305],['maxAggregateBytes',25165825],['sourceTimeoutMs',120001],['requestTimeoutMs',20001]])
 test('downward '+field+' bound rejects '+value+' before reads',async()=>{let calls=0;await hold({[field]:value,readPage:()=>{calls++}},/bounds/);assert.equal(calls,0)})
for(const field of ['profile','skipBoard','sourceInput','account','source','fetchJson'])
 test('fixed programme rejects caller '+field+' authority',async()=>{let calls=0;await hold({[field]:'unreviewed',readPage:()=>{calls++}},/options/);assert.equal(calls,0)})

test('N7 request reserve stops after the board before API or own acquisition',async()=>{
 const transport=replay(packets()),error=await hold({readPage:transport.readPage,maxRequests:19},/bounds/)
 assert.deepEqual(transport.calls.map(c=>c.url),[C,B]);assert.equal(error.nativeCollectionEvidence.requests,2)
})
test('complete known byte reserve succeeds exactly and fails one byte short before closing',async()=>{
 const rows=programme(1),sum=rows.reduce((n,r)=>n+r.body.length,0)*2,exact=replay(rows)
 const result=await readCurrentJasperProgramme({readPage:exact.readPage,maxAggregateBytes:sum});assert.equal(result.nativeCollectionEvidence.aggregateBytes,sum)
 assert.equal(exact.calls[3].maxBodyBytes,rows[3].body.length)
 const short=replay(rows),error=await hold({readPage:short.readPage,maxAggregateBytes:sum-1},/body|bounds/)
 assert.equal(short.calls.length,4);assert.ok(error.nativeCollectionEvidence.rawPages.every(r=>r.phase.startsWith('opening-')))
 assert.equal(error.nativeCollectionEvidence.rawPages.at(-1).discardedOverflowBytes,1)
})
test('an intrinsic oversize returned entity retains its bounded prefix and true consumed count',async()=>{
 const rows=programme(1),transport=replay(rows),error=await hold({readPage:transport.readPage,maxResponseBytes:128},/body/),raw=error.nativeCollectionEvidence.rawPages[0]
 assert.equal(raw.bodyBytes,128);assert.equal(raw.bodyBase64,rows[0].body.subarray(0,128).toString('base64'))
 assert.equal(raw.consumedBodyBytes,rows[0].body.length);assert.equal(raw.discardedOverflowBytes,rows[0].body.length-128)
 assert.equal(error.nativeCollectionEvidence.aggregateBytes,rows[0].body.length);assert.equal(error.nativeCollectionEvidence.retainedBytes,128)
})

test('metadata getters/proxy traps and byte conversion hooks confer no authority',async()=>{
 let calls=0
 const trap=replay(programme(1),page=>new Proxy(page,{ownKeys(){calls++;throw Error('No trap')}}));await hold({readPage:trap.readPage},/response/);assert.equal(calls,0)
 const accessor=replay(programme(1),page=>{Object.defineProperty(page,'headers',{get(){calls++;return{}},enumerable:true});return page});await hold({readPage:accessor.readPage},/options/);assert.equal(calls,0)
 const intrinsic=replay(programme(1),page=>{Object.defineProperty(page.body,'valueOf',{value:()=>{calls++;return 4}});Object.defineProperty(page.body,Symbol.iterator,{value:function*(){calls++;yield 0}});return page})
 const result=await readCurrentJasperProgramme({readPage:intrinsic.readPage});assert.equal(result.nativeCollectionEvidence.requests,8);assert.equal(calls,0)
})

function fetchResponse(page,{prefixBytes,stalled=false,readError=false,late}={}){
 let reads=0,cancels=0,releases=0,pending
 const body=Buffer.from(page.body),first=prefixBytes===undefined?body:body.subarray(0,prefixBytes)
 const reader={read(){reads++;if(reads===1)return Promise.resolve({done:false,value:first});if(stalled)return new Promise(resolve=>{pending=resolve;late?.()});if(readError)throw Error('Controlled explicit read error');return Promise.resolve({done:true})},cancel(){cancels++;return stalled?new Promise(()=>{}):Promise.resolve()},releaseLock(){releases++}}
 return{response:{url:page.finalURL,status:page.status,headers:new Headers(page.headers),body:{getReader(){return reader},cancel(){cancels++;return Promise.resolve()}}},counts:()=>({reads,cancels,releases}),resolveLate:()=>pending?.({done:false,value:Buffer.from('late-unqualified-bytes')})}
}
const fakeFetch=rows=>{const map=new Map(rows.map(r=>[r.requestedURL,r])),calls=[];return{calls,fetchImpl:async(url,init)=>{calls.push(url);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');assert.equal(init.method,'GET');assert.ok(!Object.keys(init.headers).some(n=>/cookie|auth/i.test(n)));const p=map.get(url);assert.ok(p);return fetchResponse(p).response}}}
test('raw streaming Fetch adapter captures actual view/clocks and follows only the exact eight GETs',async()=>{
 const rows=programme(1),transport=fakeFetch(rows),result=await runCurrentJasperProgramme({fetchImpl:transport.fetchImpl,requestIntervalMs:0}),audit=result.nativeCollectionEvidence
 assert.equal(transport.calls.length,8)
 for(const raw of audit.rawPages){assert.equal(raw.source,'jasper');assert.ok(Array.isArray(raw.headerEntries));assert.ok(raw.requestedAt<=raw.responseAt&&raw.responseAt<=raw.completedAt);assert.equal(raw.originalResponse.streamDone,true);assert.equal(raw.originalResponse.decodedPrefixOnly,false);assert.equal(raw.originalResponse.error,null)}
 assert.equal(audit.aggregateBytes,rows.reduce((n,r)=>n+r.body.length,0)*2)
})

for(const cause of ['parent','request','source','explicit-error'])test(cause+' interruption after128 bytes retains original evidence before settlement and cannot mutate late',async()=>{
 const row=packets()[0],parent=new AbortController(),fixtureResponse=fetchResponse(row,{prefixBytes:128,stalled:cause!=='explicit-error',readError:cause==='explicit-error',late:cause==='parent'?()=>queueMicrotask(()=>parent.abort(new DOMException('Controlled parent cancellation','AbortError'))):undefined})
 const options={fetchImpl:async()=>fixtureResponse.response,requestIntervalMs:0,signal:parent.signal,sourceTimeoutMs:cause==='source'?25:1000,requestTimeoutMs:cause==='request'?25:1000}
 const error=await hold(options,cause==='explicit-error'?undefined:/AbortError|TimeoutError/,runCurrentJasperProgramme),audit=error.nativeCollectionEvidence,raw=audit.rawPages[0]
 assert.equal(raw.bodyBytes,128);assert.equal(raw.bodySHA256,sha(row.body.subarray(0,128)));assert.equal(raw.bodyBase64,row.body.subarray(0,128).toString('base64'))
 assert.equal(raw.status,200);assert.equal(raw.finalURL,C);assert.deepEqual(raw.headers,Object.fromEntries(new Headers(row.headers)))
 assert.deepEqual(raw.headerEntries,[...new Headers(row.headers)]);assert.equal(raw.bodyComplete,false);assert.equal(raw.streamDone,false);assert.equal(raw.decodedPrefixOnly,true)
 assert.equal(audit.aggregateBytes,128);assert.equal(audit.retainedBytes,128);assert.equal(audit.requests,1);assert.ok(Object.isFrozen(audit));assert.ok(Object.isFrozen(raw))
 assert.equal(fixtureResponse.counts().cancels,1);assert.equal(fixtureResponse.counts().releases,1)
 const snapshot=JSON.stringify(audit);fixtureResponse.resolveLate();await delay(5);assert.equal(JSON.stringify(audit),snapshot);assert.equal(fixtureResponse.counts().cancels,1)
})

test('stream overflow retains only bounded bytes but accounts for every consumed decoded byte once',async()=>{
 const row=packets()[0],stream=fetchResponse(row,{prefixBytes:256}),error=await hold({fetchImpl:async()=>stream.response,requestIntervalMs:0,maxResponseBytes:128},/body/,runCurrentJasperProgramme),audit=error.nativeCollectionEvidence,raw=audit.rawPages[0]
 assert.equal(raw.bodyBytes,128);assert.equal(raw.consumedBodyBytes,256);assert.equal(raw.discardedOverflowBytes,128);assert.equal(audit.aggregateBytes,256);assert.equal(audit.retainedBytes,128)
 assert.equal(stream.counts().cancels,1);assert.equal(stream.counts().releases,1)
})
test('uncooperative Fetch is bounded and a late response is canceled without changing held audit',async()=>{
 let resolve;const late=fetchResponse(packets()[0]),error=await hold({fetchImpl:()=>new Promise(r=>{resolve=r}),requestIntervalMs:0,sourceTimeoutMs:25},/TimeoutError/,runCurrentJasperProgramme),before=JSON.stringify(error.nativeCollectionEvidence)
 assert.equal(error.nativeCollectionEvidence.aggregateBytes,0);assert.equal(error.nativeCollectionEvidence.rawPages[0].status,undefined)
 resolve(late.response);await delay(5);assert.equal(late.counts().cancels,1);assert.equal(JSON.stringify(error.nativeCollectionEvidence),before)
})

test('pre-abort invokes neither raw reader nor Fetch',async()=>{
 const parent=new AbortController(),reason=Error('Controlled preabort');parent.abort(reason);let calls=0
 assert.equal(await hold({signal:parent.signal,readPage:()=>{calls++}}),reason)
 assert.equal(await hold({signal:parent.signal,fetchImpl:()=>{calls++}},undefined,runCurrentJasperProgramme),reason);assert.equal(calls,0)
})
test('uncooperative raw reader is bounded by remaining source time',async()=>{
 let calls=0;const error=await hold({readPage:()=>{calls++;return new Promise(()=>{})},sourceTimeoutMs:25},/TimeoutError/)
 assert.equal(calls,1);assert.equal(error.nativeCollectionEvidence.rawPages.length,1);assert.equal(error.nativeCollectionEvidence.aggregateBytes,0)
})
const busy=milliseconds=>{const end=performance.now()+milliseconds;while(performance.now()<end){/* Controlled CPU work without yielding to timers. */}}
test('CPU-only work cannot starve the one-millisecond outer source bound into success',async()=>{
 const transport=replay(programme(1),page=>{busy(3);return page}),error=await hold({readPage:transport.readPage,sourceTimeoutMs:1},/TimeoutError/)
 assert.ok(transport.calls.length<=1);assert.equal(error.nativeCollectionEvidence.currentTransactionQualified,false)
})
test('CPU-only raw completion cannot outrun the one-millisecond complete request bound',async()=>{
 const rows=programme(1),transport=replay(rows,page=>{busy(3);return page}),error=await hold({readPage:transport.readPage,sourceTimeoutMs:1000,requestTimeoutMs:1},/TimeoutError/)
 assert.equal(transport.calls.length,1);assert.equal(error.nativeCollectionEvidence.rawPages[0].bodyBytes,rows[0].body.length)
})

test('observer sees a full independent audit and cannot mutate native payload or originals',async()=>{
 const rows=programme(1),transport=replay(rows);let observed=0
 const result=await readCurrentJasperProgramme({readPage:transport.readPage,onAudit:audit=>{observed++;assert.equal(audit.requests,8);assert.equal(audit.rawPages.length,8);assert.equal(audit.aggregateBytes,rows.reduce((n,r)=>n+r.body.length,0)*2);audit.nativePayload.jobs.length=0;audit.rawPages.length=0}})
 assert.equal(observed,1);assert.equal(result.nativeCollectionEvidence.nativePayload.jobs.length,1);assert.equal(result.nativeCollectionEvidence.rawPages.length,8)
})
test('observer rejection preserves all full acquired originals and never releases a zero',async()=>{
 const transport=replay(programme(1)),reason=Error('Controlled audit rejection'),error=await hold({readPage:transport.readPage,onAudit:()=>{throw reason}})
 assert.equal(error,reason);assert.equal(error.nativeCollectionEvidence.rawPages.length,8);assert.equal(error.nativeCollectionEvidence.openingClosingEquality.length,4)
})
test('uncooperative observer and final caller abort both hold within the same outer budget',async()=>{
 const parent=new AbortController(),transport=replay(programme(1));let observed=0
 const error=await hold({readPage:transport.readPage,signal:parent.signal,sourceTimeoutMs:5000,onAudit:()=>{observed++;setTimeout(()=>parent.abort(new DOMException('Controlled final observer abort','AbortError')),5);return new Promise(()=>{})}},/AbortError/)
 assert.equal(observed,1);assert.equal(error.nativeCollectionEvidence.rawPages.length,8)
})
test('CPU-heavy observer must still meet the one remaining source deadline',async()=>{
 const transport=replay(programme(1));let observed=0
 const error=await hold({readPage:transport.readPage,sourceTimeoutMs:1500,onAudit:()=>{observed++;busy(1505)}},/TimeoutError/)
 assert.equal(observed,1);assert.equal(error.nativeCollectionEvidence.rawPages.length,8)
})
