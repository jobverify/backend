import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261106/stantec-current.json.gz',import.meta.url)))),oracle=fixture.independentOracle,packets=new Map(fixture.packets.map(p=>[p.requestedURL,p])),sha=b=>createHash('sha256').update(b).digest('hex')
const provider=getScraperCatalog().find(p=>p.source==='stantec'),career='https://www.stantec.com/',corporate='https://www.stantec.com/en',search='https://prod-search-api.jobsyn.org/api/v1/solr/search',first=oracle.listingModels[0].jobs[0],roleBase='https://microsites.dejobs.org/stantec-jobs/data/',roleURL=roleBase+first.guid+'.json'
async function replay(options={}){
 const calls=[],seen=new Map()
 const fetchResponse=async(url,init={})=>{
  assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  if(url.startsWith(search))assert.deepEqual(init.headers,{Accept:'application/json','Content-Type':'application/json','X-Origin':'stantec.jobs'})
  const n=(seen.get(url)||0)+1;seen.set(url,n);calls.push({url,n});const p=packets.get(url);assert.ok(p,'Uncaptured or application/account URL: '+url)
  let text=Buffer.from(p.bodyBase64,'base64').toString('utf8')
  if(options.tiny&&url.startsWith(search)){
   const m=JSON.parse(text);for(const f of m.filters.country||[])if(f.display==='India')f.value=1
   if(new URL(url).searchParams.has('location')){m.jobs=m.jobs.slice(0,1);m.featured_jobs=[];m.pagination={has_more_pages:false,offset:0,page:1,page_size:50,total:1,total_pages:1}}
   text=JSON.stringify(m)
  }
  if(options.change)text=options.change({url,n,text,packet:p})
  const bytes=options.changeBytes?options.changeBytes({url,n,bytes:Buffer.from(text)}):Buffer.from(text)
  return{...p,bytes,bodySHA256:sha(bytes),...(options.responseChange?.({url,n})||{})}
 }
 const legacy=async url=>{
  calls.push({url,legacy:true});let p=packets.get(String(url)),hops=0;assert.ok(p,'Uncaptured legacy URL '+url)
  while([301,302].includes(p.status)){assert.ok(++hops<=5);p=packets.get(new URL(p.headers.location,p.requestedURL).href);assert.ok(p)}
  return{html:Buffer.from(p.bodyBase64,'base64').toString('utf8'),status:p.status,contentType:p.contentType,url:p.finalURL}
 }
 let jobs,error,rejected=false
 try{jobs=await createCatalogScraper(provider).run({now:()=>new Date('2026-11-06T18:00:00Z'),fetchResponse,fetchPage:legacy,fetchText:async url=>(await legacy(url)).html,...options,...(options.useDefaultTransport?{fetchResponse:undefined,fetchImpl:async(url,init)=>{const p=await fetchResponse(url,init),r=new Response(p.bytes,{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}}:{})})}catch(e){error=e;rejected=true}
 return{jobs,error,rejected,calls}
}
const mutateRole=(change,closingOnly=false)=>p=>{if(p.url!==roleURL||closingOnly&&p.n!==2)return p.text;const m=JSON.parse(p.text);change(m);return JSON.stringify(m)}
test('Stantec originals and independent whole models retain58 records, three talent pools and two multi-location ghosts',()=>{
 assert.equal(fixture.packets.length,80);assert.equal(oracle.nativeIndiaTotal,58);assert.equal(oracle.candidateVacancies,55);assert.equal(oracle.prospectiveIDs.length,3);assert.equal(oracle.ghostIDs.length,2)
 for(const p of fixture.packets){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(b.length,p.bodyBytes);assert.equal(sha(b),p.bodySHA256);assert.equal(p.method,'GET')}
 assert.equal(fixture.freshAcceptedClosingProofClaimed,false);assert.equal(oracle.corporateNavigation.careerItem.ctaLink.url,'https://stantec.jobs/')
})
test('Stantec registered native route closes58 whole models and returns55 India vacancies',async()=>{
 let audit;const r=await replay({onAudit:value=>{audit=value}});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,55);assert.equal(r.calls.length,158);assert.ok(r.calls.every(c=>!c.legacy))
 assert.equal(r.calls.filter(c=>c.url.startsWith(roleBase)).length,116);assert.equal(readInventoryEvidence(r.jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(r.jobs).listingComplete,false)
 assert.equal(readSourceObservationEvidence(r.jobs,'stantec').observedRecordCount,58);assert.equal(readSourceObservationEvidence(r.jobs,'stantec').observedVacancyCount,55)
 assert.equal(audit.heldRecords.length,3);assert.deepEqual(audit.heldRecords.map(r=>r.model.guid).sort(),[...oracle.prospectiveIDs].sort())
 for(const j of r.jobs){const o=oracle.roles[j.jobId];assert.ok(o&&!o.prospective);assert.equal(j.source,'stantec');assert.equal(j.companyName,'Stantec');assert.equal(j.country,'India');assert.equal(j.requisitionId,o.model.reqid);assert.equal(j.jobDescription,o.renderedText);assert.equal(j.sourceDescription,o.model.html_description);assert.deepEqual(j.nativeSourceRecord.detail,o.model);assert.deepEqual(j.nativeClosingRecord.detail,o.model);assert.equal(j.canonicalRoleURL,null);assert.equal(j.sourceUrl,roleBase+j.jobId+'.json');assert.equal(j.legalEmployer,null);assert.equal(j.firstEverPublication,null);assert.equal(j.applicationVisited,false);assert.equal(j.activeApplyVerified,false);assert.equal(j.sourceScopeComplete,false);assert.equal(j.lifecycleCleanupAllowed,false)}
 assert.ok(r.jobs.some(j=>j.title==='Talent Acquisition Sourcing Lead'))
})
test('Stantec default Fetch transport handles exact empty redirect bodies and the same complete models',async()=>{const r=await replay({useDefaultTransport:true});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,55);assert.equal(r.calls.length,158)})
test('Stantec retains both ghost worksites without declaring a unique city or remote status',async()=>{const r=await replay();assert.equal(r.rejected,false,r.error?.message);for(const id of oracle.ghostIDs){const j=r.jobs.find(j=>j.jobId===id);assert.ok(j);assert.equal(j.country,'India');assert.equal(j.location,'India');assert.equal(j.city,null);assert.equal(j.state,null);assert.equal(j.workplaceType,null);assert.deepEqual(j.nativeBodyWorksites,[oracle.roles[id].primaryLocation,...oracle.roles[id].otherLocations])}})
test('Stantec removes only the published literal metadata marker from display criteria',async()=>{const r=await replay();assert.equal(r.rejected,false,r.error?.message);const j=r.jobs.find(j=>j.jobId==='85EACBAEE85047EFA074A984BACDAE58');assert.ok(j.sourceDescription.includes('#additional'));assert.ok(!j.jobDescription.includes('#additional'));assert.equal(j.nativeRendererOmissions.length,1)})
test('Stantec zero cap performs no IO and never certifies an empty company',async()=>{const r=await replay({maxJobs:0});assert.equal(r.rejected,false);assert.equal(r.jobs.length,0);assert.equal(r.calls.length,0);assert.equal(readInventoryEvidence(r.jobs).status,'coverage-gap')})
test('Stantec a positive output cap still closes all58 models',async()=>{const r=await replay({maxJobs:1});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,1);assert.equal(r.calls.filter(c=>c.url.startsWith(roleBase)).length,116);assert.equal(readSourceObservationEvidence(r.jobs,'stantec').observedRecordCount,58)})
for(const options of [{maxJobs:-1},{maxJobs:1.5},{maxJobs:'2'},{maxJobs:NaN},{maxPages:1},{readTimeoutMs:15001},{sourceTimeoutMs:900001},{observerTimeoutMs:0}])test('Stantec rejects invalid caps/deadlines before IO '+JSON.stringify(options),async()=>{const r=await replay(options);assert.equal(r.rejected,true);assert.ok(r.error instanceof RangeError);assert.equal(r.calls.length,0)})
for(const reason of [Object.freeze({caller:'pre'}),null,0,'stop'])test('Stantec preserves exact pre-aborted reason '+String(reason),async()=>{const c=new AbortController();c.abort(reason);const r=await replay({signal:c.signal});assert.equal(r.rejected,true);assert.equal(r.error,reason);assert.equal(r.calls.length,0)})
for(const[label,change]of[
 ['country',d=>{d.country='Canada'}],['country alias',d=>{d.country_short='USA'}],['typed country',d=>{d.full_loc=d.full_loc.replace('country::India','country::Canada')}],
 ['employer',d=>{d.company='Another company'}],['board identity',d=>{d.company_canonical_microsite='https://unrelated.invalid/'}],['native ID',d=>{d.guid='0'.repeat(32)}],['requisition',d=>{d.reqid='other'}],
 ['expiry presence',d=>{d.deleted_at=null}],['missing criteria',d=>{d.html_description=''}],['future native date',d=>{d.date_new='2999-01-01T00:00:00Z'}],
 ['hidden extra requirement',d=>{d.html_description+='<p hidden>Mandatory licence.</p>'}],['unsupported extra requirement',d=>{d.html_description+='<table><tr><td>Country: Canada</td></tr></table>'}],
 ['body country conflict',d=>{d.html_description=d.html_description.replace('India | Pune','Canada | Toronto')}],['body requisition conflict',d=>{d.html_description=d.html_description.replace(d.reqid,'OTHER')}],
 ['supplemental assets',d=>{d.assets={requirements:'https://unrelated.invalid/requirements.pdf'}}],['unknown placement',d=>{d.location_info='Canada'}],
 ['additional marker with real criteria',d=>{d.html_description+='<p>#additional Mandatory foreign licence.</p>'}],['body employer conflict',d=>{d.html_description+='<p>Employer: Another company</p>'}],
])test('Stantec holds conflicting or incomplete '+label,async()=>{const r=await replay({tiny:true,change:mutateRole(change)});assert.equal(r.rejected,true);assert.match(String(r.error?.message),/Stantec native/);assert.equal(r.calls.filter(c=>c.url===roleURL).length,1)})
for(const[label,change]of[
 ['whole criteria',d=>{d.html_description+='<p>New required licence.</p>'}],['unknown field',d=>{d.newRequirement='Licence'}],['expiry',d=>{d.deleted_at=false}],['country',d=>{d.country='Canada'}],
])test('Stantec holds closing-only '+label,async()=>{const r=await replay({tiny:true,change:mutateRole(change,true)});assert.equal(r.rejected,true);assert.match(String(r.error?.message),/Stantec native/);assert.equal(r.calls.filter(c=>c.url===roleURL).length,2)})
test('Stantec duplicate JSON keys cannot overwrite country',async()=>{const r=await replay({tiny:true,change:p=>p.url===roleURL?p.text.replace('"country":','"country":"Canada","country":'):p.text});assert.equal(r.rejected,true);assert.match(r.error.message,/duplicate/)})
test('Stantec cannot use inactive corporate navigation',async()=>{const r=await replay({tiny:true,change:p=>p.url===corporate?'<template>'+p.text+'</template>':p.text});assert.equal(r.rejected,true);assert.equal(r.calls.filter(c=>c.url.startsWith(search)).length,0)})
test('Stantec disabled careers submenu does not establish the normal header handoff',async()=>{const r=await replay({tiny:true,change:p=>p.url===corporate?p.text.replaceAll('"disableSubmenu": "false"','"disableSubmenu": "true"'):p.text});assert.equal(r.rejected,true);assert.equal(r.calls.filter(c=>c.url.startsWith(search)).length,0)})
test('Stantec detached navigation copies cannot replace the managed header children',async()=>{const r=await replay({tiny:true,change:p=>p.url===corporate?p.text.replaceAll('global-header__children','unbound-children'):p.text});assert.equal(r.rejected,true);assert.equal(r.calls.filter(c=>c.url.startsWith(search)).length,0)})
test('Stantec current client hash changes prevent API reads',async()=>{const r=await replay({tiny:true,change:p=>p.url.endsWith('.js')?p.text+'/*changed*/':p.text});assert.equal(r.rejected,true);assert.equal(r.calls.filter(c=>c.url.startsWith(search)).length,0)})
test('Stantec inert India links cannot replace the published active country route',async()=>{const r=await replay({tiny:true,change:p=>p.url==='https://stantec.jobs/'?p.text.replaceAll('/locations/ind/jobs/','/locations/unbound/jobs/')+'<template><a href="/locations/ind/jobs/">India</a></template>':p.text});assert.equal(r.rejected,true);assert.equal(r.calls.filter(c=>c.url.startsWith(search)).length,0)})
test('Stantec pagination count drift prevents accepted roles',async()=>{const r=await replay({tiny:true,change:p=>{if(!p.url.startsWith(search)||!p.url.includes('location=ind')||p.n!==2)return p.text;const d=JSON.parse(p.text);d.pagination.total++;return JSON.stringify(d)}});assert.equal(r.rejected,true);assert.match(r.error.message,/Stantec native/)})
for(const status of [403,404,429,500])test('Stantec stops after HTTP '+status+' without retries',async()=>{const r=await replay({responseChange:()=>({status})});assert.equal(r.rejected,true);assert.equal(r.calls.length,1)})
test('Stantec refuses an undeclared redirect target',async()=>{const r=await replay({responseChange:p=>p.url===career?{headers:{location:'https://unrelated.invalid/','content-type':'text/html'}}:null});assert.equal(r.rejected,true);assert.equal(r.calls.length,1)})
test('Stantec rejects invalid original UTF-8',async()=>{const r=await replay({changeBytes:()=>Buffer.from([0xc3,0x28])});assert.equal(r.rejected,true);assert.equal(r.calls.length,1)})
test('Stantec checks the original body hash',async()=>{const r=await replay({responseChange:()=>({bodySHA256:'0'.repeat(64)})});assert.equal(r.rejected,true);assert.equal(r.calls.length,1)})
test('Stantec stalled reads are bounded',async()=>{let n=0;const r=await replay({readTimeoutMs:20,fetchResponse:()=>{n++;return new Promise(()=>{})}});assert.equal(r.rejected,true);assert.match(r.error.message,/deadline/);assert.equal(n,1)})
test('Stantec source deadline covers uncooperative acquisition',async()=>{const r=await replay({sourceTimeoutMs:20,fetchResponse:()=>new Promise(()=>{})});assert.equal(r.rejected,true);assert.match(r.error.message,/deadline/)})

for(const [label,option] of [['read/body','readTimeoutMs'],['source','sourceTimeoutMs']])test('Stantec '+label+' deadline checks elapsed time after a synchronous transport callback',async t=>{
 const realNow=performance.now.bind(performance);let elapsed=0,calls=0
 t.mock.method(performance,'now',()=>realNow()+elapsed)
 const r=await replay({tiny:true,[option]:20,fetchResponse:url=>{calls++;const p=packets.get(url);assert.ok(p);elapsed+=25;return{...p,bytes:Buffer.from(p.bodyBase64,'base64')}}})
 assert.equal(r.rejected,true);assert.match(r.error.message,new RegExp(label+' deadline'));assert.equal(calls,1)
})

test('Stantec observer deadline checks elapsed time after a synchronous observer callback',async t=>{
 const realNow=performance.now.bind(performance);let elapsed=0
 t.mock.method(performance,'now',()=>realNow()+elapsed)
 const r=await replay({tiny:true,observerTimeoutMs:20,onAudit:()=>{elapsed+=25}})
 assert.equal(r.rejected,true);assert.match(r.error.message,/observer deadline/)
})
test('Stantec cancellation settles an uncooperative read using the original caller reason',async()=>{const c=new AbortController(),reason=Object.freeze({caller:'pending'});let n=0;const r=await replay({signal:c.signal,fetchResponse:()=>{n++;queueMicrotask(()=>c.abort(reason));return new Promise(()=>{})}});assert.equal(r.rejected,true);assert.equal(r.error,reason);assert.equal(n,1)})
test('Stantec audit observer receives detached held records and criteria',async()=>{let seen=false;const r=await replay({onAudit:async audit=>{await Promise.resolve();audit.heldRecords[0].model.title='mutated';audit.records[0].nativeSourceRecord.detail.title='mutated';seen=true}});assert.equal(r.rejected,false,r.error?.message);assert.equal(seen,true);assert.equal(r.jobs[0].nativeSourceRecord.detail.title,first.title_exact)})
test('Stantec stalled observers are bounded',async()=>{const r=await replay({tiny:true,observerTimeoutMs:20,onAudit:()=>new Promise(()=>{})});assert.equal(r.rejected,true);assert.match(r.error.message,/deadline/)})
test('Stantec observer cancellation preserves the exact caller reason',async()=>{const c=new AbortController(),reason=Object.freeze({caller:'observer'});const r=await replay({tiny:true,signal:c.signal,onAudit:()=>{c.abort(reason);return new Promise(()=>{})}});assert.equal(r.rejected,true);assert.equal(r.error,reason)})
test('Stantec malformed bound template syntax retains original response evidence',async()=>{const r=await replay({tiny:true,change:p=>p.url===corporate?p.text.replace('"title": "careers"','"title": :'):p.text});assert.equal(r.rejected,true);assert.match(r.error.message,/Stantec native/);assert.equal(r.error.nativeOriginalResponses.length,5)})
test('Stantec dynamic template expressions are never evaluated',async()=>{const r=await replay({tiny:true,change:p=>p.url===corporate?p.text.replace('"title": "careers"','"title": globalThis.__stantecPublisherExecuted = true'):p.text});assert.equal(r.rejected,true);assert.equal(globalThis.__stantecPublisherExecuted,undefined);assert.match(r.error.message,/Stantec native/)})
test('Stantec duplicate bound template fields are rejected',async()=>{const r=await replay({tiny:true,change:p=>p.url===corporate?p.text.replace('"title": "careers"','"title":"other","title": "careers"'):p.text});assert.equal(r.rejected,true);assert.match(r.error.message,/duplicate/)})
test('Stantec whole model comparison preserves distinct rounded numeric lexemes',async()=>{const r=await replay({tiny:true,change:p=>p.url===roleURL?p.text.replace(/"audiences"\s*:\s*\[\s*1\s*,/,'"audiences":['+(p.n===1?'0.1000000000000000001':'0.1')+','):p.text});assert.equal(r.rejected,true);assert.match(r.error.message,/closing role whole model/)})
test('Stantec retains lossless unsafe index versions and valid date spelling aliases',async()=>{const r=await replay();assert.equal(r.rejected,false,r.error?.message);assert.deepEqual(r.jobs[0].nativeSourceRecord.listing._version_,oracle.listingModels[0].jobs[0]._version_);assert.equal(typeof r.jobs[0].nativeSourceRecord.listing._version_.nativeJSONNumberLexeme,'string');const spellings=r.jobs.filter(j=>j.nativeSourceRecord.listing.date_added!==j.nativeSourceRecord.detail.date_added),expected=Object.values(oracle.roles).filter(o=>!o.prospective&&o.listing.date_added!==o.model.date_added);assert.equal(spellings.length,expected.length);assert.equal(expected.length,3)})
test('Stantec native criteria remain as complete originals after registry decoration',async()=>{const r=await replay();assert.equal(r.rejected,false,r.error?.message);const{readStantecOriginalResponses}=await import('../scraper/stantec.workday/nativeCurrent.js');const originals=readStantecOriginalResponses(r.jobs);assert.equal(originals.length,158);assert.equal(originals.filter(p=>p.bodyBytes===0).length,4);for(const p of originals){assert.equal(p.originalBodyComplete,true);assert.equal(sha(Buffer.from(p.bodyBase64,'base64')),p.bodySHA256)}originals.pop();originals[0].headers.changed=true;assert.equal(readStantecOriginalResponses(r.jobs).length,158);assert.equal(readStantecOriginalResponses(r.jobs)[0].headers.changed,undefined)})
test('Stantec pending default bodies are cancelled when their read deadline expires',async()=>{let cancelled=false;const response=new Response(new ReadableStream({pull:()=>new Promise(()=>{}),cancel:()=>{cancelled=true}}),{status:302,headers:{location:'https://www.stantec.com/content/stantec/en.html'}});Object.defineProperty(response,'url',{value:career});const r=await replay({readTimeoutMs:20,fetchResponse:undefined,fetchImpl:async()=>response});assert.equal(r.rejected,true);assert.match(r.error.message,/deadline/);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(cancelled,true)})
test('Stantec late default response bodies preserve the exact caller cancellation reason',async()=>{const c=new AbortController(),reason=Object.freeze({caller:'late'});let deliver,cancelled;const pending=replay({signal:c.signal,fetchResponse:undefined,fetchImpl:()=>new Promise(resolve=>{deliver=resolve;queueMicrotask(()=>c.abort(reason))})});const r=await pending;assert.equal(r.rejected,true);assert.equal(r.error,reason);const response=new Response(new ReadableStream({cancel:value=>{cancelled=value}}));Object.defineProperty(response,'url',{value:career});deliver(response);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(cancelled,reason)})
test('Stantec cancels and releases a reader after its first oversized chunk',async()=>{let reads=0,cancelled=false,released=false;const r=await replay({fetchResponse:undefined,fetchImpl:async()=>({url:career,status:302,headers:new Headers({location:'https://www.stantec.com/content/stantec/en.html'}),body:{getReader:()=>({read:async()=>{reads++;return{done:false,value:new Uint8Array(4*1024*1024+1)}},cancel:()=>{cancelled=true},releaseLock:()=>{released=true}})}})});assert.equal(r.rejected,true);assert.match(r.error.message,/byte limit/);assert.equal(reads,1);assert.equal(cancelled,true);assert.equal(released,true)})

const insertComponentChild=(html,component,child,careersOnly=false)=>{
 const end=careersOnly?html.indexOf('"title": "careers"'):html.length
 const marker='data-react-component="'+component+'"',start=careersOnly?html.lastIndexOf(marker,end):html.indexOf(marker)
 assert.ok(start>=0);const offset=html.indexOf('>',start)+1;assert.ok(offset>start)
 return html.slice(0,offset)+child+html.slice(offset)
}
for(const [name,component,child,careersOnly]of[
 ['header HTML authorMode override','GlobalHeader','<template data-react-html-prop="authorMode">true</template>',false],
 ['earlier descendant JSON props','GlobalHeader','<div><template type="application/json">{"authorMode":true}</template></div>',false],
 ['careers NavigationItem HTML title override','NavigationItem','<template data-react-html-prop="title">unbound</template>',true],
])test('Stantec review rejects effective '+name,async()=>{
 const r=await replay({tiny:true,change:p=>p.url===corporate?insertComponentChild(p.text,component,child,careersOnly):p.text})
 assert.equal(r.rejected,true);assert.match(r.error.message,/Stantec native/);assert.equal(r.calls.filter(c=>c.url.startsWith(search)).length,0)
})
for(const [name,opening]of[['nonexecuting JSON carrier','<script type="application/json">'],['external-script inline carrier','<script src="https://unrelated.invalid/config.js">']])test('Stantec review rejects '+name,async()=>{
 const r=await replay({tiny:true,change:p=>{
  if(p.url!=='https://stantec.jobs/')return p.text
  const marker=p.text.indexOf('window.__NUXT__.config='),start=p.text.lastIndexOf('<script',marker),end=p.text.indexOf('>',start)
  assert.ok(marker>0&&start>=0&&end>start)
  return p.text.slice(0,start)+opening+p.text.slice(end+1)
 }})
 assert.equal(r.rejected,true);assert.match(r.error.message,/Stantec native/);assert.equal(r.calls.filter(c=>c.url.startsWith(search)).length,0)
})
test('Stantec review rejects ignored subsequent publisher config mutations',async()=>{
 const r=await replay({tiny:true,change:p=>{
  if(p.url!=='https://stantec.jobs/')return p.text
  const marker=p.text.indexOf('window.__NUXT__.config='),end=p.text.indexOf('</script>',marker);assert.ok(marker>0&&end>marker)
  return p.text.slice(0,end)+';window.__NUXT__.config.public["x-origin"]="unrelated.invalid";'+p.text.slice(end)
 }})
 assert.equal(r.rejected,true);assert.match(r.error.message,/Stantec native/);assert.equal(r.calls.filter(c=>c.url.startsWith(search)).length,0)
})
test('Stantec review holds a stable explicit filled-position notice in whole native criteria',async()=>{
 const r=await replay({tiny:true,change:mutateRole(d=>{d.html_description+='<p>This position has been filled.</p>'})})
 assert.equal(r.rejected,true);assert.match(r.error.message,/Stantec native/)
})
test('Stantec review stops on denied role headers before a stalled body or queued role reads',async()=>{
 let roleReads=0,cancelled=false
 const r=await replay({readTimeoutMs:250,fetchResponse:undefined,fetchImpl:async url=>{
  const p=packets.get(url);assert.ok(p)
  if(url.startsWith(roleBase))roleReads++
  const response=url===roleURL?new Response(new ReadableStream({pull:()=>new Promise(()=>{}),cancel:()=>{cancelled=true}}),{status:403,headers:{'content-type':'text/html'}}):new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers})
  Object.defineProperty(response,'url',{value:url});return response
 }})
 assert.equal(r.rejected,true);assert.match(r.error.message,/HTTP 403/);assert.ok(roleReads<=4,'Only in-flight role reads may have started: '+roleReads)
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(cancelled,true)
})
