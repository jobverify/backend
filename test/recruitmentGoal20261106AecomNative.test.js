import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261106/aecom-current.json.gz',import.meta.url))))
const oracle=fixture.independentOracle,packets=fixture.packets,sha=b=>createHash('sha256').update(b).digest('hex')
const flowOracle=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261106/aecom-rendered-criteria.json.gz',import.meta.url))))
const career='https://aecom.com/careers/',search='https://prod-search-api.jobsyn.org/api/v1/solr/search',first=oracle.wholeRoleModels[0],roleURL='https://microsites.dejobs.org/aecom-jobs/data/'+first.guid+'.json'
const research=packets.filter(p=>p.cohort==='current-native-research'),byURL=new Map()
for(const p of packets.filter(p=>p.cohort!=='historical-failed-generic-route'))if(!byURL.has(p.requestedURL))byURL.set(p.requestedURL,p)
const catalog=getScraperCatalog(),providers=Object.fromEntries(['aecom','aecomindia'].map(source=>[source,catalog.find(p=>p.source===source)]))

async function replay(options={}){
 const calls=[],seen=new Map()
 const fetchResponse=async(url,init={})=>{
  assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const n=(seen.get(url)||0)+1;seen.set(url,n);calls.push({url,n})
  if(url.startsWith(search))assert.deepEqual(init.headers,{'Accept':'application/json','Content-Type':'application/json','X-Origin':'aecom.jobs'})
  const copies=research.filter(p=>p.requestedURL===url),p=copies[Math.min(n-1,copies.length-1)]||byURL.get(url)
  assert.ok(p,'No uncaptured or application request: '+url)
  let html=Buffer.from(p.bodyBase64,'base64').toString('utf8')
  if(options.tiny&&url.startsWith(search)){
   const d=JSON.parse(html)
   for(const f of d.filters.country||[])if(f.display==='India')f.value=1
   if(new URL(url).searchParams.has('location')){d.jobs=d.jobs.slice(0,1);d.featured_jobs=[];d.pagination={has_more_pages:false,offset:0,page:1,page_size:10,total:1,total_pages:1}}
   html=JSON.stringify(d)
  }
  if(options.change)html=options.change({url,n,html,packet:p})
  const bytes=options.changeBytes?options.changeBytes({url,n,bytes:Buffer.from(html)}):Buffer.from(html)
  return{...p,requestedURL:url,finalURL:url,html:bytes.toString('utf8'),bytes,bodyBytes:bytes.length,bodySHA256:sha(bytes)}
 }
 const legacy=async url=>{calls.push({url,legacy:true});const p=packets.find(p=>p.cohort==='historical-failed-generic-route'&&p.requestedURL===url)||byURL.get(url);assert.ok(p,'Uncaptured legacy request '+url);return Buffer.from(p.bodyBase64,'base64').toString('utf8')}
 let jobs,error,rejected=false
 try{jobs=await(options.scraper||createCatalogScraper(providers[options.source||'aecom'])).run({fetchResponse,fetchText:legacy,fetchJson:async url=>JSON.parse(await legacy(url)),fetchImpl:async url=>{const response=new Response(await legacy(String(url)),{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:String(url)});return response},...options,...(options.useDefaultTransport?{fetchResponse:undefined,fetchImpl:async(url,init)=>{const p=await fetchResponse(url,init),r=new Response(p.bytes,{status:p.status,headers:{'content-type':p.contentType}});Object.defineProperty(r,'url',{value:url});return r}}:{})})}catch(e){error=e;rejected=true}
 return{jobs,error,rejected,calls}
}

test('AECOM registered aliases report 760 observations as 380 unique native roles',async()=>{
 const {buildScraperAttemptDiagnostics}=await import('../scraper-support/runner.js');
 const {summarizeScraperRun}=await import('../scraper-support/utils/scraperRunSummary.js');
 const results=[];
 for(const source of ['aecom','aecomindia']){
  const r=await replay({source});assert.equal(r.rejected,false,r.error?.message);
  results.push({success:true,...buildScraperAttemptDiagnostics(r.jobs)});
 }
 const summary=summarizeScraperRun(results);
 assert.equal(summary.jobYield.observations,760);
 assert.equal(summary.jobYield.uniqueJobs,380);
 assert.equal(summary.jobYield.duplicateObservations,380);
 assert.equal(summary.jobYield.sourcesWithoutIdentityEvidence,0);
});

test('AECOM originals and independent full-model oracle retain all native research bodies',()=>{
 assert.equal(packets.length,475);assert.equal(oracle.reportedIndiaTotal,380)
 assert.equal(oracle.wholeRoleModels.length,380);assert.equal(oracle.openingListingModels.length,380);assert.equal(oracle.closingListingModels.length,380)
 for(const p of packets){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(b.length,p.bodyBytes);assert.equal(sha(b),p.bodySHA256);assert.equal(p.method,'GET');assert.equal(p.body,null);assert.equal(p.status,200)}
 assert.equal(fixture.diagnosticResearchOnly,true);assert.equal(fixture.freshAcceptedClosingProofClaimed,false)
})

for(const source of ['aecom','aecomindia'])test('AECOM registered '+source+' reads all 380 own postings and independently closes every model',async()=>{
 const r=await replay({source});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,380)
 assert.ok(r.calls.every(c=>!c.legacy));assert.equal(r.calls.filter(c=>c.url.includes('/aecom-jobs/data/')).length,760)
 assert.equal(r.calls.filter(c=>c.url.startsWith(search)&&new URL(c.url).searchParams.has('location')).length,76)
 const evidence=readInventoryEvidence(r.jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false)
 assert.equal(readSourceObservationEvidence(r.jobs,source).observedRecordCount,380)
 for(let i=0;i<380;i++){
  const j=r.jobs[i],o=oracle.wholeRoleModels[i]
  assert.equal(j.jobId,o.guid);assert.equal(j.requisitionId,o.model.reqid);assert.equal(j.companyName,'AECOM');assert.equal(j.country,'India');assert.equal(j.source,source)
  assert.equal(j.sourceDescription,o.model.html_description);assert.equal(sha(o.model.html_description),flowOracle.rows[o.guid].htmlSHA256);assert.equal(j.jobDescription,flowOracle.rows[o.guid].text)
  assert.deepEqual(j.nativeSourceRecord.detail,o.model);assert.deepEqual(j.nativeClosingRecord.detail,o.model)
  assert.deepEqual(j.nativeSourceRecord.listing,oracle.openingListingModels[i]);assert.deepEqual(j.nativeClosingRecord.listing,oracle.closingListingModels[i])
  assert.equal(j.nativeCriteriaComplete,true);assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeGeographyQualified,true)
  assert.equal(j.sourceScopeComplete,false);assert.equal(j.sourceListingComplete,false);assert.equal(j.lifecycleCleanupAllowed,false)
  assert.equal(j.canonicalRoleURL,null);assert.equal(j.legalEmployer,null);assert.equal(j.firstEverPublication,null);assert.equal(j.applicationVisited,false)
  assert.equal(j.nativeSourceRecord.detail.is_posted,false);assert.equal(j.nativePublicationEvidence.indexPostedFlagMeaning,null)
 }
 assert.equal(providers.aecomindia.aliasOfSource,'aecom')
})

test('AECOM zero cap performs no IO and never proves an empty company',async()=>{const r=await replay({maxJobs:0});assert.equal(r.rejected,false);assert.equal(r.jobs.length,0);assert.equal(r.calls.length,0);assert.equal(readInventoryEvidence(r.jobs).status,'coverage-gap')})
for(const maxJobs of [-1,1.5,'2',NaN])test('AECOM rejects invalid job cap '+String(maxJobs)+' before IO',async()=>{const r=await replay({maxJobs});assert.equal(r.rejected,true);assert.ok(r.error instanceof RangeError);assert.equal(r.calls.length,0)})
test('AECOM finite page cap cannot silently truncate proof',async()=>{const r=await replay({maxPages:1});assert.equal(r.rejected,true);assert.equal(r.calls.length,0)})
test('AECOM positive result cap still closes all 380 native roles',async()=>{const r=await replay({maxJobs:1});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,1);assert.equal(r.calls.filter(c=>c.url.includes('/aecom-jobs/data/')).length,760);assert.equal(readSourceObservationEvidence(r.jobs,'aecom').observedRecordCount,380)})
for(const reason of [Object.freeze({caller:'pre'}),null,0,'stop'])test('AECOM preserves exact pre-aborted reason '+String(reason),async()=>{const c=new AbortController();c.abort(reason);const r=await replay({signal:c.signal});assert.equal(r.rejected,true);assert.equal(r.error,reason);assert.equal(r.calls.length,0)})
test('AECOM cancellation settles an uncooperative read and prevents subsequent reads',async()=>{const c=new AbortController(),reason=Object.freeze({caller:'native'});let calls=0;const r=await replay({signal:c.signal,fetchResponse:()=>{calls++;queueMicrotask(()=>c.abort(reason));return new Promise(()=>{})}});assert.equal(r.rejected,true);assert.equal(r.error,reason);assert.equal(calls,1)})

const mutateRole=(change,closingOnly=false)=>p=>{if(p.url!==roleURL||closingOnly&&p.n!==2)return p.html;const d=JSON.parse(p.html);change(d);return JSON.stringify(d)}
for(const [label,change]of [
 ['own country',d=>{d.country='Canada'}],['own employer',d=>{d.company='Different employer'}],
 ['own guid',d=>{d.guid='0'.repeat(32)}],['own requisition',d=>{d.reqid='REF-other'}],
 ['native expiry',d=>{d.deleted_at=null}],['missing criteria',d=>{d.html_description=''}],
 ['future date',d=>{d.date_new='2999-01-01T00:00:00Z'}],
 ['hidden new requirement',d=>{d.html_description+='<p hidden>Mandatory licence.</p>'}],
 ['unsupported requirement',d=>{d.html_description+='<x-requirement>Mandatory licence.</x-requirement>'}],
 ['table country conflict',d=>{d.html_description+='<table><tr><th>Country</th><td>Canada</td></tr></table>'}],
 ['explicit employer conflict',d=>{d.html_description+='<p>Employer: Different employer</p>'}],
 ['explicit assignment conflict',d=>{d.html_description+='<p>Mandatory work assignment: Canada</p>'}],
])test('AECOM cannot qualify conflicting or incomplete '+label,async()=>{const r=await replay({tiny:true,change:mutateRole(change)});assert.equal(r.rejected,true);assert.match(String(r.error?.message),/AECOM native/);assert.equal(r.calls.filter(c=>c.url===roleURL).length,1)})

for(const [label,change]of [
 ['criteria',d=>{d.html_description+='<p>New mandatory certification.</p>'}],
 ['unknown full-model field',d=>{d.additional_requirement={licence:'Required'}}],
 ['requisition',d=>{d.reqid='REF-other'}],['expiry',d=>{d.deleted_at='2026-11-06'}],
 ['publication',d=>{d.date_new='2026-11-05T00:00:00Z'}]
])test('AECOM closing-only '+label+' change invalidates reconciliation',async()=>{const r=await replay({tiny:true,change:mutateRole(change,true)});assert.equal(r.rejected,true);assert.match(String(r.error?.message),/AECOM native.*(?:closing|changed|differs|expiry)/i)})

test('AECOM changed published client cannot authorize guessed endpoints',async()=>{const r=await replay({tiny:true,change:p=>p.url.endsWith('/Bt1tVEIW.js')?p.html+'\n// changed contract':p.html});assert.equal(r.rejected,true);assert.equal(r.calls.some(c=>c.url.startsWith(search)),false)})
test('AECOM duplicate GUIDs and inconsistent page arithmetic cannot prove a complete listing',async()=>{for(const kind of ['duplicate','pagination','facet']){const r=await replay({tiny:true,change:p=>{if(!p.url.startsWith(search))return p.html;const d=JSON.parse(p.html);if(kind==='facet'&&!new URL(p.url).searchParams.has('location'))d.filters.country.find(f=>f.display==='India').value=2;else if(new URL(p.url).searchParams.has('location')){if(kind==='duplicate')d.jobs.push(d.jobs[0]);if(kind==='pagination')d.pagination.offset=10}return JSON.stringify(d)}});assert.equal(r.rejected,true,kind)}})
test('AECOM closing listing preserves every non-ranking field',async()=>{const r=await replay({tiny:true,change:p=>{if(!p.url.includes('location=ind')||p.n!==2)return p.html;const d=JSON.parse(p.html);d.jobs[0].other='New mandatory field';return JSON.stringify(d)}});assert.equal(r.rejected,true);assert.match(r.error.message,/closing.*changed/i)})
test('AECOM whole JSON models preserve unsafe numeric lexemes and reject duplicate keys',async()=>{const {parseNativeJSON}=await import('../scraper/aecom.workday/nativeJSON.js');assert.deepEqual(parseNativeJSON('{"a":1881095226451296256,"b":1.4023439,"c":1e2,"d":-0,"n":7}'),{a:{nativeJSONNumberLexeme:'1881095226451296256'},b:{nativeJSONNumberLexeme:'1.4023439'},c:{nativeJSONNumberLexeme:'1e2'},d:{nativeJSONNumberLexeme:'-0'},n:7});for(const value of ['{"x":1,"x":2}','{"x":1,"\\u0078":2}','{"a":NaN}','{"a":1,}','({"a":1})'])assert.throws(()=>parseNativeJSON(value));const p=parseNativeJSON('{"__proto__":{"value":1}}');assert.equal(Object.hasOwn(p,'__proto__'),true);assert.equal(Object.getPrototypeOf(p),Object.prototype)})
test('AECOM audit and records callbacks receive detached complete models',async()=>{let audit=0,records=0;const r=await replay({tiny:true,onAudit:async a=>{audit++;a.records[0].nativeSourceRecord.detail.reqid='observer mutation'},onRecords:async rows=>{records++;rows[0].nativeSourceRecord.detail.html_description='observer mutation'}});assert.equal(r.rejected,false,r.error?.message);assert.equal(audit,1);assert.equal(records,1);assert.equal(r.jobs[0].nativeSourceRecord.detail.reqid,first.model.reqid);assert.equal(r.jobs[0].sourceDescription,first.model.html_description)})
test('AECOM audit rejection and cancellation prevent later observer invocation',async()=>{for(const cancel of [false,true]){let records=0;const c=new AbortController(),reason=Object.freeze({caller:'observer'});const r=await replay({tiny:true,signal:c.signal,onAudit:()=>{if(cancel){queueMicrotask(()=>c.abort(reason));return new Promise(()=>{})}throw reason},onRecords:()=>{records++}});assert.equal(r.rejected,true);assert.equal(r.error,reason);assert.equal(records,0)}})
test('AECOM source stops after unavailable responses without retry or fallback',async()=>{for(const status of [401,403,429,500]){let reads=0;const r=await replay({fetchResponse:async url=>{reads++;return{requestedURL:url,finalURL:url,status,html:'Unavailable',bytes:Buffer.from('Unavailable'),contentType:'text/html'}}});assert.equal(r.rejected,true);assert.match(r.error.message,/HTTP/);assert.equal(reads,1)}})
test('AECOM factory undefined preserves zero cap while null removes it',async()=>{const {createAecomScraper}=await import('../scraper/aecom.workday/nativeCurrent.js');const scraper=createAecomScraper({source:'aecom',maxJobs:0}),empty=await replay({scraper,maxJobs:undefined});assert.equal(empty.rejected,false);assert.equal(empty.calls.length,0);const all=await replay({scraper,maxJobs:null,tiny:true});assert.equal(all.rejected,false,all.error?.message);assert.equal(all.jobs.length,1)})
test('AECOM queued cancellation prevents even the first callback',async()=>{const c=new AbortController(),reason=Object.freeze({caller:'queued'});let reads=0;const pending=replay({signal:c.signal,fetchResponse:()=>{reads++;return new Promise(()=>{})}});c.abort(reason);const r=await pending;assert.equal(r.error,reason);assert.equal(reads,0)})
test('AECOM read and observer deadlines settle uncooperative promises',async()=>{let reads=0;const stalled=await replay({readTimeoutMs:20,fetchResponse:()=>{reads++;return new Promise(()=>{})}});assert.equal(stalled.rejected,true);assert.match(stalled.error.message,/read\/body deadline/);assert.equal(reads,1);let records=0;const observer=await replay({tiny:true,observerTimeoutMs:20,onAudit:()=>new Promise(()=>{}),onRecords:()=>{records++}});assert.equal(observer.rejected,true);assert.match(observer.error.message,/audit observer deadline/);assert.equal(records,0)})
test('AECOM body stream uses the same bounded stop gate',async()=>{let reads=0,cancelled=0;const r=await replay({fetchResponse:undefined,readTimeoutMs:20,fetchImpl:async url=>{reads++;return{status:200,url,headers:new Headers({'content-type':'text/html'}),body:{cancel:()=>{cancelled++;return Promise.resolve()},async *[Symbol.asyncIterator](){yield Buffer.from('<html>');await new Promise(()=>{})}}}}});assert.equal(r.rejected,true);assert.match(r.error.message,/read\/body deadline/);assert.equal(reads,1);assert.equal(cancelled,1)})
test('AECOM opaque or fractional numeric objects cannot masquerade as pagination counts',async()=>{for(const page of [{nativeJSONNumberLexeme:'1.0'},1.0001,9007199254740992]){const r=await replay({tiny:true,change:p=>{if(!p.url.includes('location=ind'))return p.html;const d=JSON.parse(p.html);d.pagination.page=page;return JSON.stringify(d)}});assert.equal(r.rejected,true);assert.match(r.error.message,/pagination|reserved numeric/)}})

for(const [label,change]of [
 ['typed country',d=>{d.full_loc=d.full_loc_exact=d.full_loc.replace('country::India','country::Canada')}],
 ['country slab',d=>{d.country_slab=d.country_slab_exact='can/jobs::Canada'}],
 ['company slab',d=>{d.company_slab=d.company_slab_exact='different-employer/careers::Different employer'}],
 ['extra worksite',d=>{d.all_locations=['Toronto, Canada']}],
 ['opaque location info',d=>{d.location_info={country:'Canada'}}],
])test('AECOM review: stable '+label+' contradiction stays unqualified',async()=>{const r=await replay({tiny:true,change:mutateRole(change)});assert.equal(r.rejected,true);assert.match(r.error.message,/AECOM native/)})
for(const html of ['<p><strong>Country:</strong></p><p>Canada</p>','<p>Coun<strong>try</strong>: Canada</p>','<p><strong>Employer:</strong></p><p>Different employer</p>','<p>Country:</p>','<p>Legal <em>employer</em>:</p><p>Different employer</p>'])test('AECOM review: rendered label/value flow is reconciled '+html,async()=>{const r=await replay({tiny:true,change:mutateRole(d=>{d.html_description+=html})});assert.equal(r.rejected,true);assert.match(r.error.message,/criteria.*(?:country|employer|declaration)/)})
test('AECOM review: inline flow and split native India label/value remain readable',async()=>{const html='<p>Coun<strong>try</strong>:</p><p>India</p><p>Employer:</p><p>AECOM</p>',r=await replay({tiny:true,change:mutateRole(d=>{d.html_description+=html})});assert.equal(r.rejected,false,r.error?.message);assert.match(r.jobs[0].nativeRenderedCriteriaText,/Country: India Employer: AECOM$/);assert.match(r.jobs[0].jobDescription,/Country: India Employer: AECOM$/)})
test('AECOM review: numeric scalars cannot collide with publisher objects at closing',async()=>{const r=await replay({tiny:true,change:p=>p.url===roleURL?p.html.replace(/}\s*$/,p.n===1?',"reviewMetadata":9007199254740993}':',"reviewMetadata":{"nativeJSONNumberLexeme":"9007199254740993"}}'):p.html});assert.equal(r.rejected,true);assert.match(r.error.message,/numeric|closing/)})
test('AECOM review: unknown closing envelope requirement is not ignored',async()=>{const r=await replay({tiny:true,change:p=>{if(!p.url.includes('location=ind')||p.n!==2)return p.html;const d=JSON.parse(p.html);d.reviewRequirement={country:'Canada',licence:'Required'};return JSON.stringify(d)}});assert.equal(r.rejected,true);assert.match(r.error.message,/closing.*envelope/)})
test('AECOM review: only reviewed request/ranking envelope fields may change',async()=>{const r=await replay({tiny:true,change:p=>{if(!p.url.includes('location=ind')||p.n!==2)return p.html;const d=JSON.parse(p.html);d.meta.request_country='CA';d.meta.request_id='technical-request';d.jobs[0].score=1.22;d.jobs[0]._version_=17;return JSON.stringify(d)}});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs[0].country,'India');assert.equal(r.jobs[0].sourceWorksiteCountryProof.requestCountryUsed,false)})
test('AECOM review: read and observer budget ceilings reject excessive overrides before IO',async()=>{for(const key of ['readTimeoutMs','observerTimeoutMs']){const r=await replay({[key]:900000,maxJobs:0});assert.equal(r.rejected,true);assert.ok(r.error instanceof RangeError);assert.equal(r.calls.length,0)}})
test('AECOM review: a locked native stream is cancelled and its reader released',async()=>{let cancelled=0,body;const r=await replay({fetchResponse:undefined,readTimeoutMs:20,fetchImpl:async url=>{body=new ReadableStream({start(c){c.enqueue(Buffer.from('<html>'))},cancel(){cancelled++}});return{status:200,url,headers:new Headers({'content-type':'text/html'}),body}}});await new Promise(resolve=>setTimeout(resolve,10));assert.equal(r.rejected,true);assert.equal(cancelled,1);assert.equal(body.locked,false)})
test('AECOM review: a response arriving after caller stop is disposed',async()=>{const c=new AbortController(),reason=Object.freeze({caller:'late'});let cancelled=0;const r=await replay({signal:c.signal,fetchResponse:undefined,fetchImpl:url=>new Promise(resolve=>{queueMicrotask(()=>c.abort(reason));setTimeout(()=>resolve({status:200,url,headers:new Headers({'content-type':'text/html'}),body:{cancel:()=>{cancelled++;return Promise.resolve()}}}),20)})});assert.equal(r.error,reason);await new Promise(resolve=>setTimeout(resolve,40));assert.equal(cancelled,1)})
test('AECOM review: default registered transport retains every original in audit and ordinary evidence',async()=>{let audit;const r=await replay({tiny:true,useDefaultTransport:true,onAudit:a=>{audit=a}});assert.equal(r.rejected,false,r.error?.message);assert.equal(audit.originalResponses?.length,r.calls.length);const {readAecomOriginalResponses}=await import('../scraper/aecom.workday/nativeCurrent.js'),originals=readAecomOriginalResponses(r.jobs);assert.equal(originals.length,r.calls.length);for(const p of originals){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(sha(b),p.bodySHA256);assert.equal(b.length,p.bodyBytes);assert.equal(p.method,'GET');assert.equal(p.body,null)}originals[0].bodyBase64='mutation';assert.notEqual(readAecomOriginalResponses(r.jobs)[0].bodyBase64,'mutation');assert.deepEqual(audit.originalResponses,readAecomOriginalResponses(r.jobs))})
test('AECOM review: malformed UTF-8 is rejected before criteria can qualify',async()=>{const r=await replay({tiny:true,change:mutateRole(d=>{d.html_description+='<p>Mandatory licence: REVIEW_UTF8</p>'}),changeBytes:p=>{if(p.url!==roleURL)return p.bytes;const b=Buffer.from(p.bytes),at=b.indexOf('REVIEW_UTF8');assert.ok(at>=0);b[at]=255;return b}});assert.equal(r.rejected,true);assert.match(r.error.message,/UTF-8|encoded data/)})
test('AECOM review: current genuine U+FFFD source characters are retained',async()=>{const r=await replay({tiny:true,change:mutateRole(d=>{d.html_description+='<p>Mandatory literal: \uFFFD</p>'})});assert.equal(r.rejected,false,r.error?.message);assert.ok(r.jobs[0].sourceDescription.endsWith('<p>Mandatory literal: \uFFFD</p>'))})
test('AECOM review: an unreviewed public API override is held before source API reads',async()=>{const r=await replay({tiny:true,change:p=>p.url==='https://aecom.jobs/'?p.html.replace('public:{','public:{"api-url":"https://different.example/api/",'):p.html});assert.equal(r.rejected,true);assert.equal(r.calls.some(c=>c.url.startsWith(search)),false)})
