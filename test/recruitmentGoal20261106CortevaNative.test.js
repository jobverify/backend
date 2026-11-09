import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {readCortevaOriginalResponses} from '../scraper/corteva.workday/nativeCurrent.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261106/corteva-current.json.gz',import.meta.url))))
const oracle=fixture.independentOracle,sha=b=>createHash('sha256').update(b).digest('hex'),packets=new Map(fixture.packets.map(p=>[p.requestedURL,p]))
const career='https://careers.corteva.com/',board='https://apply.corteva.com/careers',search='https://apply.corteva.com/api/pcsx/search?',id=oracle.IndiaRoleIDs[0],api='https://apply.corteva.com/api/pcsx/position_details?position_id='+id+'&domain=corteva.com&hl=en',canonical=oracle.roles[id].canonical
const provider=getScraperCatalog().find(p=>p.source==='corteva')
async function replay(options={}){
 const calls=[],seen=new Map()
 const fetchResponse=async(url,init={})=>{
  assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const n=(seen.get(url)||0)+1;seen.set(url,n);calls.push({url,n})
  const p=packets.get(url);assert.ok(p,'Uncaptured or candidate/account URL: '+url)
  let body=Buffer.from(p.bodyBase64,'base64')
  if(options.change)body=Buffer.from(options.change({url,n,text:body.toString('utf8'),packet:p}))
  if(options.changeBytes)body=options.changeBytes({url,n,bytes:body})
  return{...p,bytes:body,bodySHA256:sha(body),...(options.responseChange?.({url,n})||{})}
 }
 const legacy=async url=>{calls.push({url,legacy:true});const p=packets.get(String(url));assert.ok(p,'Uncaptured legacy GET '+url);return Buffer.from(p.bodyBase64,'base64').toString('utf8')}
 let jobs,error,rejected=false
 try{jobs=await createCatalogScraper(provider).run({now:()=>new Date('2026-11-06T16:40:00Z'),fetchResponse,fetchText:legacy,fetchPage:async url=>({html:await legacy(url),status:packets.get(url).status,contentType:packets.get(url).contentType,url:packets.get(url).finalURL}),fetchJson:async url=>JSON.parse(await legacy(url)),...options,...(options.useDefaultTransport?{fetchResponse:undefined,fetchImpl:async(url,init)=>{const p=await fetchResponse(url,init),r=new Response(p.bytes,{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}}:{})})}catch(e){error=e;rejected=true}
 return{jobs,error,rejected,calls}
}
const mutateRole=(change,closingOnly=false)=>p=>{if(p.url!==api||closingOnly&&p.n!==2)return p.text;const m=JSON.parse(p.text);change(m);return JSON.stringify(m)}
test('Corteva exact originals retain an independent two-role full-description oracle',()=>{
 assert.equal(fixture.packets.length,14);assert.equal(oracle.reportedGlobalSearchCount,42);assert.deepEqual(oracle.IndiaRoleIDs,['893398508613','893398131893'])
 for(const p of fixture.packets){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(b.length,p.bodyBytes);assert.equal(sha(b),p.bodySHA256);assert.equal(p.method,'GET')}
 assert.equal(fixture.freshAcceptedClosingProofClaimed,false)
})
test('Corteva registered native route reconciles both full India roles and all five worldwide pages',async()=>{
 const r=await replay();assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,2);assert.equal(r.calls.length,26);assert.ok(r.calls.every(c=>!c.legacy))
 assert.equal(r.calls.filter(c=>c.url.startsWith(search)).length,10)
 assert.equal(readInventoryEvidence(r.jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(r.jobs).listingComplete,false)
 assert.equal(readSourceObservationEvidence(r.jobs,'corteva').observedRecordCount,2)
 for(const j of r.jobs){const o=oracle.roles[j.jobId];assert.ok(o);assert.equal(j.country,'India');assert.equal(j.companyName,'Corteva');assert.equal(j.requisitionId,o.listing.atsJobId);assert.equal(j.jobDescription,o.renderedText);assert.equal(j.sourceDescription,o.envelope.data.jobDescription);assert.equal(j.canonicalRoleURL,o.canonical);assert.equal(j.sourceUrl,o.canonical);assert.deepEqual(j.nativeSourceRecord.detail,o.envelope);assert.deepEqual(j.nativeClosingRecord.detail,o.envelope);assert.equal(j.sourceScopeComplete,false);assert.equal(j.lifecycleCleanupAllowed,false);assert.equal(j.legalEmployer,null);assert.equal(j.firstEverPublication,null);assert.equal(j.applicationVisited,false);assert.equal(j.activeApplyVerified,false)}
})
test('Corteva uses the default Fetch transport with the same retained model proof',async()=>{const r=await replay({useDefaultTransport:true});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,2);assert.equal(r.calls.length,26)})
test('Corteva zero result cap performs no IO and does not certify an empty company',async()=>{const r=await replay({maxJobs:0});assert.equal(r.rejected,false);assert.equal(r.jobs.length,0);assert.equal(r.calls.length,0);assert.equal(readInventoryEvidence(r.jobs).status,'coverage-gap')})
test('Corteva positive cap still closes every role and reports the two observations',async()=>{const r=await replay({maxJobs:1});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,1);assert.equal(r.calls.length,26);assert.equal(readSourceObservationEvidence(r.jobs,'corteva').observedRecordCount,2)})
for(const options of [{maxJobs:-1},{maxJobs:1.5},{maxJobs:'2'},{maxJobs:NaN},{maxPages:1},{readTimeoutMs:15001},{sourceTimeoutMs:900001},{observerTimeoutMs:0}])test('Corteva rejects invalid caps/deadlines before IO '+JSON.stringify(options),async()=>{const r=await replay(options);assert.equal(r.rejected,true);assert.ok(r.error instanceof RangeError);assert.equal(r.calls.length,0)})
for(const reason of [Object.freeze({caller:'pre'}),null,0,'stop'])test('Corteva preserves exact pre-aborted reason '+String(reason),async()=>{const c=new AbortController();c.abort(reason);const r=await replay({signal:c.signal});assert.equal(r.rejected,true);assert.equal(r.error,reason);assert.equal(r.calls.length,0)})
for(const[label,change]of[
 ['country',m=>{m.data.locations=['Toronto, Ontario, Canada']}],['standardized country',m=>{m.data.standardizedLocations=['Hyderabad, TS, US']}],
 ['location alias',m=>{m.data.location='Toronto, Ontario, Canada'}],['custom location alias',m=>{m.data.efcustomTextLocation=['Toronto, Ontario, Canada']}],
 ['additional worksite',m=>{m.data.efcustomTextAdditionalLocation=['Canada']}],['ID',m=>{m.data.id+=1}],['requisition',m=>{m.data.atsJobId='other'}],
 ['unsafe ID',m=>{m.data.id=9007199254740992}],['missing full criteria',m=>{m.data.jobDescription=''}],['fallback role',m=>{m.metadata={isFallback:true}}],
 ['closed role',m=>{m.data.positionUserActions.applyAction.status='closed'}],['future publication',m=>{m.data.postedTs=99999999999}],
 ['conflicting employer',m=>{m.data.employer='Different employer'}],['canonical origin',m=>{m.data.publicUrl='https://unrelated.invalid/jobs/'+id}],
 ['talent pool',m=>{m.data.name='Future opportunities talent pool'}],['hidden criteria',m=>{m.data.jobDescription+='<p hidden>Mandatory licence</p>'}],
 ['unsupported criteria',m=>{m.data.jobDescription+='<table><tr><td>Mandatory country: Canada</td></tr></table>'}],
 ['criteria country conflict',m=>{m.data.jobDescription+='<p>Workplace country: Canada</p>'}],['criteria employer conflict',m=>{m.data.jobDescription+='<p>Employer: Different employer</p>'}],
])test('Corteva holds conflicting or incomplete '+label,async()=>{const r=await replay({change:mutateRole(change)});assert.equal(r.rejected,true);assert.match(String(r.error?.message),/Corteva native/);assert.equal(r.calls.filter(c=>c.url===api).length,1)})
for(const[label,change]of[
 ['full criteria',m=>{m.data.jobDescription+='<p>New mandatory licence.</p>'}],['unknown field',m=>{m.data.newRequirement='Licence'}],['own country',m=>{m.data.locations=['Toronto, Ontario, Canada']}],['role deletion',m=>{m.data.deleted_at=null}],
])test('Corteva holds closing-only '+label,async()=>{const r=await replay({change:mutateRole(change,true)});assert.equal(r.rejected,true);assert.match(String(r.error?.message),/Corteva native/);assert.equal(r.calls.filter(c=>c.url===api).length,2)})
test('Corteva distinguishes Indianapolis from India',async()=>{const r=await replay();assert.equal(r.rejected,false,r.error?.message);assert.deepEqual(r.jobs.map(j=>j.jobId),oracle.IndiaRoleIDs);assert.ok(r.jobs.every(j=>j.location==='Hyderabad, Telangana, India'))})
test('Corteva duplicate JSON keys cannot overwrite native country',async()=>{const r=await replay({change:p=>p.url===api?p.text.replace('"locations":','"locations":["Canada"],"locations":'):p.text});assert.equal(r.rejected,true);assert.match(r.error.message,/duplicate/)})
test('Corteva retains legitimate replacement characters in valid UTF-8 criteria',async()=>{const r=await replay({change:p=>mutatePage(m=>{m.description+=' Publisher text \uFFFD retained.'})({...p,text:mutateRole(m=>{m.data.jobDescription+='<p>Publisher text \uFFFD retained.</p>'})(p)})});assert.equal(r.rejected,false,r.error?.message);assert.ok(r.jobs[0].sourceDescription.includes('\uFFFD'));assert.equal(r.jobs[0].jobDescription,oracle.roles[id].renderedText+' Publisher text \uFFFD retained.')})
test('Corteva closing listing count change prevents role acceptance',async()=>{const r=await replay({change:p=>{if(!p.url.startsWith(search)||p.n!==2)return p.text;const m=JSON.parse(p.text);m.data.count++;return JSON.stringify(m)}});assert.equal(r.rejected,true);assert.match(r.error.message,/Corteva native/)})
test('Corteva missing declared corporate handoff prevents board reads',async()=>{const r=await replay({change:p=>p.url===career?p.text.replaceAll('https://apply.corteva.com','https://unrelated.invalid'):p.text});assert.equal(r.rejected,true);assert.equal(r.calls.length,1)})
test('Corteva inactive corporate handoff cannot qualify',async()=>{const r=await replay({change:p=>p.url===career?'<template>'+p.text+'</template>':p.text});assert.equal(r.rejected,true);assert.equal(r.calls.length,1)})
test('Corteva changed published client prevents API reads',async()=>{const r=await replay({change:p=>p.url.endsWith('.js')?p.text+'/*changed*/':p.text});assert.equal(r.rejected,true);assert.equal(r.calls.filter(c=>c.url.startsWith(search)).length,0)})
test('Corteva conflicting canonical role URL prevents closing reads',async()=>{const r=await replay({change:p=>p.url===canonical?p.text.replaceAll('https://apply.corteva.com/careers/job/'+id,'https://unrelated.invalid/'+id):p.text});assert.equal(r.rejected,true);assert.equal(r.calls.filter(c=>c.url===career).length,1)})
const mutatePage=(change,closingOnly=false)=>p=>{
 if(p.url!==canonical||closingOnly&&p.n!==2)return p.text
 return p.text.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,(all,a,s,b)=>{const m=JSON.parse(s);change(m);return a+JSON.stringify(m)+b})
}
for(const[label,change]of[
 ['structured employer',m=>{m.hiringOrganization.name='Different employer'}],['structured country',m=>{m.jobLocation.address.addressCountry.name='US'}],
 ['structured criteria',m=>{m.description+=' Additional mandatory licence.'}],['structured expiry',m=>{m.validThrough='2026-01-01T00:00:00'}],['structured title',m=>{m.title='Different role'}],
])test('Corteva reconciles own role-page '+label,async()=>{const r=await replay({change:mutatePage(change)});assert.equal(r.rejected,true);assert.match(r.error.message,/Corteva native/);assert.equal(r.calls.filter(c=>c.url===career).length,1)})
test('Corteva holds closing-only own role-page criteria changes',async()=>{const r=await replay({change:mutatePage(m=>{m.description+=' New required licence.'},true)});assert.equal(r.rejected,true);assert.match(r.error.message,/Corteva native/)})
test('Corteva holds supplemental custom role content until its full rendering is supported',async()=>{const r=await replay({change:mutateRole(m=>{m.data.positionExtraDetails.customContent=[{country:'Canada'}]})});assert.equal(r.rejected,true);assert.match(r.error.message,/Corteva native/)})
for(const status of [403,404,429,500])test('Corteva stops after HTTP '+status+' without retry or alternate host',async()=>{const r=await replay({responseChange:p=>p.url===career?{status}:null});assert.equal(r.rejected,true);assert.equal(r.calls.length,1)})
test('Corteva rejects unexpected final URL',async()=>{const r=await replay({responseChange:()=>({finalURL:'https://unrelated.invalid/'})});assert.equal(r.rejected,true);assert.equal(r.calls.length,1)})
test('Corteva rejects invalid original UTF-8',async()=>{const r=await replay({changeBytes:()=>Buffer.from([0xc3,0x28])});assert.equal(r.rejected,true);assert.equal(r.calls.length,1)})
test('Corteva rejects wrong JSON content type',async()=>{const r=await replay({responseChange:p=>p.url===api?{contentType:'text/html'}:null});assert.equal(r.rejected,true);assert.match(r.error.message,/MIME/)})
test('Corteva checks original byte hash',async()=>{const r=await replay({responseChange:()=>({bodySHA256:'0'.repeat(64)})});assert.equal(r.rejected,true);assert.equal(r.calls.length,1)})
test('Corteva abort settles an uncooperative original callback and starts no later read',async()=>{const c=new AbortController(),reason=Object.freeze({caller:'pending'});let n=0;const r=await replay({signal:c.signal,fetchResponse:()=>{n++;queueMicrotask(()=>c.abort(reason));return new Promise(()=>{})}});assert.equal(r.rejected,true);assert.equal(r.error,reason);assert.equal(n,1)})
test('Corteva deadline bounds uncooperative acquisition',async()=>{let n=0;const r=await replay({readTimeoutMs:20,fetchResponse:()=>{n++;return new Promise(()=>{})}});assert.equal(r.rejected,true);assert.match(r.error.message,/deadline/);assert.equal(n,1)})
test('Corteva source deadline bounds uncooperative acquisition',async()=>{const r=await replay({sourceTimeoutMs:20,fetchResponse:()=>new Promise(()=>{})});assert.equal(r.rejected,true);assert.match(r.error.message,/deadline/)})
test('Corteva observer receives detached records and is awaited',async()=>{let called=false;const r=await replay({onRecords:async rows=>{await Promise.resolve();rows[0].nativeSourceRecord.detail.data.name='mutated';called=true}});assert.equal(r.rejected,false,r.error?.message);assert.equal(called,true);assert.equal(r.jobs[0].title,oracle.roles[id].listing.name);assert.equal(r.jobs[0].nativeSourceRecord.detail.data.name,oracle.roles[id].listing.name)})
test('Corteva stalled audit observer is bounded',async()=>{const r=await replay({observerTimeoutMs:20,onAudit:()=>new Promise(()=>{})});assert.equal(r.rejected,true);assert.match(r.error.message,/deadline/)})
test('Corteva preserves exact observer cancellation reason',async()=>{const c=new AbortController(),reason=Object.freeze({caller:'observer'});const r=await replay({signal:c.signal,onAudit:()=>{c.abort(reason);return new Promise(()=>{})}});assert.equal(r.rejected,true);assert.equal(r.error,reason)})
test('Corteva retains exact original bytes with detached metadata after registry decoration',async()=>{const r=await replay();assert.equal(r.rejected,false,r.error?.message);const originals=readCortevaOriginalResponses(r.jobs);assert.equal(originals.length,26);for(const p of originals){assert.equal(p.originalBodyComplete,true);assert.equal(sha(Buffer.from(p.bodyBase64,'base64')),p.bodySHA256)}originals[0].headers.changed=true;originals.pop();assert.equal(readCortevaOriginalResponses(r.jobs).length,26);assert.equal(readCortevaOriginalResponses(r.jobs)[0].headers.changed,undefined)})
test('Corteva retains completed denial bytes without retry',async()=>{const r=await replay({responseChange:()=>({status:403})});assert.equal(r.rejected,true);assert.equal(r.error.nativeOriginalResponses.length,1);assert.equal(r.error.nativeOriginalResponses[0].status,403);assert.equal(r.error.nativeOriginalResponses[0].originalBodyComplete,true)})
test('Corteva lossless closing comparison detects different rounded numeric lexemes',async()=>{const r=await replay({change:p=>p.url.startsWith(search)?p.text.replace(/"solrScore"\s*:\s*null/,'"solrScore":'+(p.n===1?'0.1000000000000000001':'0.1')):p.text});assert.equal(r.rejected,true);assert.match(r.error.message,/closing whole worldwide search/)})
test('Corteva bounds a stalled default response body and disposes its reader',async()=>{let cancelled=false;const response=new Response(new ReadableStream({pull:()=>new Promise(()=>{}),cancel:()=>{cancelled=true}}),{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:career});const r=await replay({readTimeoutMs:20,fetchResponse:undefined,fetchImpl:async()=>response});assert.equal(r.rejected,true);assert.match(r.error.message,/deadline/);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(cancelled,true)})
test('Corteva cancels late default response bodies using the unchanged caller reason',async()=>{const c=new AbortController(),reason=Object.freeze({caller:'late-body'});let deliver,cancelledWith;const pending=replay({signal:c.signal,fetchResponse:undefined,fetchImpl:()=>new Promise(resolve=>{deliver=resolve;queueMicrotask(()=>c.abort(reason))})});const r=await pending;assert.equal(r.rejected,true);assert.equal(r.error,reason);const response=new Response(new ReadableStream({cancel:value=>{cancelledWith=value}}));Object.defineProperty(response,'url',{value:career});deliver(response);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(cancelledWith,reason)})
test('Corteva hard stream limit stops an oversized chunk and releases its reader',async()=>{let reads=0,cancelled=false,released=false;const r=await replay({fetchResponse:undefined,fetchImpl:async()=>({url:career,status:200,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:async()=>{reads++;return{done:false,value:new Uint8Array(4*1024*1024+1)}},cancel:()=>{cancelled=true},releaseLock:()=>{released=true}})}})});assert.equal(r.rejected,true);assert.match(r.error.message,/byte limit/);assert.equal(cancelled,true);assert.equal(released,true);assert.equal(reads,1)})
test('Corteva historical replay uses its captured observation clock after wall-clock expiry',async()=>{const original=Date.now;let r;Date.now=()=>new Date('2027-06-01T00:00:00Z').getTime();try{r=await replay()}finally{Date.now=original}assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,2)})
test('Corteva expired roles are held at the supplied observation time',async()=>{const r=await replay({now:()=>new Date('2027-06-01T00:00:00Z')});assert.equal(r.rejected,true);assert.match(r.error.message,/validity calendar/)})
