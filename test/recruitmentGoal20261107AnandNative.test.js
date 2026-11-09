import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {readAnandOriginalResponses} from '../scraper/anandengineeringproductspvtltd/nativeCurrent.js'
import {transport} from '../scraper/anandengineeringproductspvtltd/currentTransport.js'
import {document,originalInner} from '../scraper/anandengineeringproductspvtltd/currentHtml.js'
import {normalizeScrapedJob} from '../scraper-support/utils/normalizeScrapedJob.js'
import {filterIndiaJobs} from '../scraper-support/utils/indiaLocationFilter.js'
import {analyzePublishableJobs} from '../scraper-support/utils/publishableJobMetrics.js'
import {buildJobDerivedFields} from '../src/utils/jobDerivedFields.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261107/anand-current.json.gz',import.meta.url)))),oracle=fixture.independentOracle,packets=new Map(fixture.packets.map(p=>[p.requestedURL,p])),provider=getScraperCatalog().find(p=>p.source==='anandengineeringproductspvtltd'),sha=b=>createHash('sha256').update(b).digest('hex')
async function replay(options={}){
 const calls=[],seen=new Map();let jobs,error,audit,rejected=false
 const body=(url,legacy)=>{const p=packets.get(url);assert.ok(p,'Only exact native retained declarations: '+url);const n=(seen.get(url)||0)+1;seen.set(url,n);calls.push({url,n,legacy});const text=Buffer.from(p.bodyBase64,'base64').toString('utf8'),changed=options.change?.({url,n,text})??text,bytes=options.changeBytes?.({url,n,bytes:Buffer.from(changed)})||Buffer.from(changed);return{...p,bytes,bodySHA256:sha(bytes),...(options.responseChange?.({url,n})||{})}}
 const fetchText=async url=>body(url,true).bytes.toString('utf8'),fetchResponse=async(url,init={})=>{assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');return body(url,false)}
 const fetchImpl=async(url,init)=>{const p=await fetchResponse(url,init),response=new Response(p.bytes,{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.finalURL});return response}
 try{jobs=await createCatalogScraper(provider).run({fetchText,fetchResponse,now:()=>new Date('2026-11-07T00:00:00Z'),onAudit:value=>{audit=value},...options,...(options.useDefaultTransport?{fetchResponse:undefined,fetchImpl}:{})})}catch(e){error=e;rejected=true}
 return{jobs,error,rejected,audit,calls}
}
test('Anand original oracle retains every current role, complete criteria region and declared CMS body',()=>{
 assert.equal(fixture.packets.length,74);assert.equal(oracle.observedRoles,34);assert.equal(oracle.observedListingPages,5);assert.equal(oracle.countryPublishedInRoleLabels,0);assert.equal(oracle.formalRequisitionsPublished,0);assert.equal(fixture.freshClosingProofClaimed,false)
 for(const p of fixture.packets){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(b.length,p.bodyBytes);assert.equal(sha(b),p.bodySHA256)}
 for(const o of oracle.roles){assert.equal(String(o.nativeCMSRecord.id),o.postID);assert.equal(o.nativeCMSRecord.status,'publish');assert.equal(o.country,null);assert.equal(o.formalRequisition,null);assert.ok(o.criteriaText.includes('Job Description'));assert.equal(o.nativeCMSRecord.meta._acf_changed,false);assert.deepEqual(o.nativeCMSRecord.acf,[])}
})
const first=oracle.roles[0]
const alterJSONLD=(html,type,edit)=>html.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script\s*>)/gi,(whole,start,text,end)=>{const m=JSON.parse(text);for(const value of m['@graph']||[m])if(value['@type']===type)edit(value);return start+JSON.stringify(m)+end})
const appendCriteria=(html,value)=>{assert.equal(html.split(first.criteriaHTML).length,2);return html.replace(first.criteriaHTML,first.criteriaHTML+value)}
const alterCMS=edit=>p=>{if(p.url!==first.jsonURL)return p.text;const m=JSON.parse(p.text);edit(m);return JSON.stringify(m)}
for(const [label,attribute]of[['absent',''],['empty',' data-next-page=""']])test('Anand review requires an exact '+label+' nonterminal continuation before native closing proof',async()=>{
 const r=await replay({maxJobs:1,change:p=>p.url==='https://anandengg.in/open-positions/'?p.text.replace(/\sdata-next-page="[^"]*"/,attribute):p.text});assert.equal(r.rejected,true);assert.match(r.error?.message,/continuation|terminal|pagination/);assert.equal(r.calls.length,2);assert.equal(r.audit,undefined)
})
for(const status of ['private','unsupported'])test('Anand review rejects a card with publish and conflicting '+status+' status',async()=>{
 const r=await replay({change:p=>p.url==='https://anandengg.in/open-positions/'?p.text.replace('status-publish','status-publish status-'+status):p.text});assert.equal(r.rejected,true);assert.match(r.error?.message,/status|publishing/);assert.equal(r.calls.length,2)
})
test('Anand review retains a complete literal comment containing a closing-tag lookalike',()=>{
 const html='<div id="criteria"><p>Mandatory licence.</p><!-- </div> --></div>',node=document(html).nodes(n=>n.attrs.id==='criteria')[0];assert.equal(originalInner(html,node),'<p>Mandatory licence.</p><!-- </div> -->')
})
for(const [label,extra]of[['comment','<!-- </div> -->'],['raw script','<script>const template = "</div>";</script>']])for(const legacy of [false,true])test('Anand review '+(legacy?'legacy':'native')+' criteria preserve '+label+' tag lookalikes and following requirements',async()=>{
 const addition='<p>Mandatory licence before lookalike.</p>'+extra+'<p>Mandatory permit after lookalike.</p>',r=await replay({...(legacy?{fetchResponse:undefined}:{}),change:p=>p.url===first.url?appendCriteria(p.text,addition):p.text});assert.equal(r.rejected,false,r.error?.message);const job=r.jobs.find(j=>j.jobId===first.postID);if(!legacy)assert.ok(job.sourceDescription.includes(addition));assert.match(job.jobDescription,/Mandatory permit after lookalike\./);assert.equal(job.sourceDetailComplete,false)
})
for(const [label,extra]of[['table','<table><tr><td>Mandatory</td><td>CPA certification</td></tr></table>'],['definition list','<dl><dt>Mandatory</dt><dd>CPA certification</dd></dl>']])for(const legacy of [false,true])test('Anand review '+(legacy?'legacy':'native')+' '+label+' boundaries preserve complete words and inline fragments',async()=>{
 const addition=extra+'<p>Mandatory C<strong>PA</strong> qualification.</p>',r=await replay({...(legacy?{fetchResponse:undefined}:{}),change:p=>p.url===first.url?appendCriteria(p.text,addition):p.text});assert.equal(r.rejected,false,r.error?.message);const job=r.jobs.find(j=>j.jobId===first.postID);assert.match(job.jobDescription,/Mandatory CPA certification/);assert.match(job.jobDescription,/Mandatory CPA qualification/);if(!legacy)assert.ok(job.sourceDescription.includes(addition))
})
for(const [label,extra]of[['inline country','<span>Country: Canada</span>'],['split inline location','<span>Work</span><span> location:</span> Toronto, Canada.']])test('Anand cannot label a newly published '+label+' as missing native workplace',async()=>{const r=await replay({change:p=>p.url===first.url?appendCriteria(p.text,extra):p.text});assert.equal(r.rejected,true);assert.match(r.error?.message,/workplace|country/i)})
test('Anand rejects a contradictory CMS class-list publishing ID',async()=>{const r=await replay({change:alterCMS(m=>{m.class_list=m.class_list.map(v=>v==='post-'+first.postID?'post-999999':v)})});assert.equal(r.rejected,true);assert.match(r.error?.message,/identity|class|post/i)})
test('Anand rejects a contradictory CMS class-list publication status',async()=>{const r=await replay({change:alterCMS(m=>{m.class_list=m.class_list.map(v=>v==='status-publish'?'status-private':v)})});assert.equal(r.rejected,true);assert.match(r.error?.message,/status|class|publish/i)})
test('Anand rejects own structured page identity pointing to another published role',async()=>{const r=await replay({change:p=>p.url===first.url?alterJSONLD(p.text,'WebPage',m=>{m.url='https://anandengg.in/job-opening/another-role/'}):p.text});assert.equal(r.rejected,true);assert.match(r.error?.message,/page|identity|canonical/i)})
test('Anand rejects CMS SEO canonical contradicting the own role',async()=>{const r=await replay({change:alterCMS(m=>{m.yoast_head_json.canonical='https://anandengg.in/job-opening/another-role/'})});assert.equal(r.rejected,true);assert.match(r.error?.message,/canonical|identity|page/i)})
test('Anand registered native route preserves whole role and CMS models without fabricated requisitions or India qualification',async()=>{
 const r=await replay();assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,34)
 for(let i=0;i<r.jobs.length;i++){const j=r.jobs[i],o=oracle.roles[i];assert.equal(j.requisitionId,null,'CMS post ID is not a requisition');assert.equal(j.jobId,o.postID);assert.equal(j.nativeIdentity.kind,'wordpress-publishing-post-id-and-own-canonical');assert.equal(j.canonicalRoleURL,o.canonicalURL);assert.equal(j.country,null);assert.equal(j.location,null);assert.equal(j.nativeCountryScopeUnresolved,true);assert.equal(j.sourceDetailComplete,false);assert.equal(j.fullNativeAuthoredCriteriaAvailable,true);assert.equal(j.nativeCriteriaVisibilityQualified,false);assert.equal(j.nativeHiringOrganization,null);assert.deepEqual(j.nativePublisherOrganization,o.nativeOrganization);assert.equal(j.postingDate,null);assert.equal(j.closingDate,null);assert.equal(j.firstEverPublication,null);assert.equal(j.sourceDescription,o.criteriaHTML);assert.equal(j.jobDescription,o.criteriaText);assert.deepEqual(j.nativeSourceRecord.nativeCMSRecord,o.nativeCMSRecord);assert.deepEqual(j.nativeClosingRecord.nativeCMSRecord,o.nativeCMSRecord);assert.deepEqual(j.nativeSourceRecord.criteriaTree,o.criteriaTree);assert.deepEqual(j.nativeSourceRecord.nativeRoleScopeTree,o.nativeRoleScopeTree);assert.equal(j.nativeModelClosingReconciled,true);assert.equal(j.sourceScopeComplete,false);assert.equal(j.lifecycleCleanupAllowed,false);assert.equal(j.applicationVisited,false)}
 assert.equal(r.calls.length,148);assert.ok(r.calls.every(c=>!c.legacy));assert.equal(r.audit.nativeObservedRecords,34);assert.equal(r.audit.qualifiedIndiaRecords,0);assert.equal(r.audit.heldRecords.length,34);assert.equal(readInventoryEvidence(r.jobs).status,'coverage-gap');assert.equal(readSourceObservationEvidence(r.jobs,provider.source).observedRecordCount,34)
})
test('Anand zero job cap performs no public reads or observation-clock calls and cannot certify empty inventory',async()=>{const r=await replay({maxJobs:0,now:()=>{throw Error('clock must remain unused')}});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.calls.length,0);assert.equal(r.jobs.length,0);assert.equal(readInventoryEvidence(r.jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(r.jobs).listingComplete,false)})
test('Anand positive cap returns one observation only after every complete opening and closing role/CMS model',async()=>{const r=await replay({maxJobs:1});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,1);assert.equal(r.calls.length,148);assert.equal(r.audit.records.length,34);assert.equal(readSourceObservationEvidence(r.jobs,provider.source).observedRecordCount,34)})
test('Anand exact opaque caller pre-abort reason is preserved before IO',async()=>{const c=new AbortController();c.abort(0);const r=await replay({signal:c.signal});assert.equal(r.rejected,true);assert.equal(r.error,0);assert.equal(r.calls.length,0)})
test('Anand whole criteria retain requirements after a nested div and inline word fragments',async()=>{
 const first=oracle.roles[0],extra='<div><p>Mandatory C<strong>PA</strong> certification.</p></div><p>Mandatory permit after nested block.</p>',r=await replay({change:p=>p.url===first.url?p.text.replace(/(<h3\b[^>]*>\s*(?:<strong>)?Job Description(?:<\/strong>)?\s*<\/h3>)/i,'$1'+extra):p.text});assert.equal(r.rejected,false,r.error?.message);const j=r.jobs.find(j=>j.jobId===first.postID);assert.ok(j);assert.match(j.jobDescription,/Mandatory permit after nested block\./);assert.match(j.jobDescription,/Mandatory CPA certification\./);assert.ok(j.sourceDescription.includes(extra))
})
test('Anand explicit text compatibility also retains requirements after nested containers without inventing native completeness',async()=>{
 const first=oracle.roles[0],extra='<div><p>Mandatory C<strong>PA</strong> certification.</p></div><p>Mandatory permit after nested block.</p>',r=await replay({fetchResponse:undefined,change:p=>p.url===first.url?p.text.replace(/(<h3\b[^>]*>\s*(?:<strong>)?Job Description(?:<\/strong>)?\s*<\/h3>)/i,'$1'+extra):p.text});assert.equal(r.rejected,false,r.error?.message);const j=r.jobs.find(j=>j.jobId===first.postID);assert.ok(j);assert.match(j.jobDescription,/Mandatory permit after nested block\./);assert.match(j.jobDescription,/Mandatory CPA certification\./);assert.equal(j.requisitionId,null);assert.equal(j.sourceDetailComplete,false)
})
test('Anand default Fetch transport preserves all148 complete originals without application or publisher-program execution',async()=>{const r=await replay({useDefaultTransport:true});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs.length,34);assert.equal(r.calls.length,148);assert.equal(r.audit.publisherProgramsExecuted,false);assert.equal(r.audit.applicationInteractions,0);assert.equal(r.audit.originalResponses.length,148)})
test('Anand current normalized and publishable consumers cannot donate India from configuration or the PMP certifier',async()=>{const r=await replay();assert.equal(r.rejected,false,r.error?.message);const normalized=r.jobs.map(j=>normalizeScrapedJob(j,provider));assert.equal(normalized.length,34);assert.ok(normalized.every(j=>j.country===null&&j.location===null&&buildJobDerivedFields(j).isPublicIndia===false));assert.equal(filterIndiaJobs(normalized).length,0);assert.equal(analyzePublishableJobs(normalized).eligibleJobs.length,0);assert.match(r.jobs.find(j=>j.jobId==='991553').jobDescription,/PMI- India/)})
test('Anand zero page cap performs no IO or clock call and leaves inventory unverified',async()=>{const r=await replay({maxPages:0,now:()=>{throw Error('unused clock')}});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.calls.length,0);assert.equal(r.jobs.length,0);assert.equal(readInventoryEvidence(r.jobs).status,'coverage-gap')})
test('Anand insufficient page cap stops at the declaration without returning a truncated source',async()=>{const r=await replay({maxPages:4});assert.equal(r.rejected,true);assert.match(r.error?.message,/page limit/);assert.equal(r.calls.length,2);assert.equal(r.jobs,undefined)})
for(const options of [{maxJobs:-1},{maxJobs:'1'},{maxJobs:1.5},{maxPages:-1},{maxPages:NaN},{readTimeoutMs:15001},{sourceTimeoutMs:300001},{observerTimeoutMs:0},{now:()=> 'invalid'},{onAudit:'bad'}])test('Anand invalid execution options fail before IO '+JSON.stringify(options),async()=>{const r=await replay(options);assert.equal(r.rejected,true);assert.equal(r.calls.length,0)})
for(const reason of [null,Object.freeze({caller:'stop'}),'cancelled'])test('Anand preserves opaque pre-abort '+String(reason),async()=>{const c=new AbortController();c.abort(reason);const r=await replay({signal:c.signal});assert.equal(r.rejected,true);assert.equal(r.error,reason);assert.equal(r.calls.length,0)})
const rejection=async options=>{const r=await replay(options);assert.equal(r.rejected,true);assert.match(r.error?.message,/Anand native/);return r}
for(const [label,edit]of[
 ['wrong post ID',m=>{m.id=123}],['wrong post type',m=>{m.type='page'}],['private post',m=>{m.status='private'}],['another canonical link',m=>{m.link='https://anandengg.in/job-opening/another-role/'}],['wrong post title',m=>{m.title.rendered='Another role'}],['new country metadata',m=>{m.meta.country='India'}],['new ACF workplace',m=>{m.acf={workCountry:'India'}}],['another CMS publisher',m=>{m.yoast_head_json.schema['@graph'].find(g=>g['@type']==='Organization').name='Another company'}],
])test('Anand whole native CMS rejects '+label,async()=>{await rejection({change:alterCMS(edit)})})
for(const [label,edit]of[
 ['off-domain canonical',s=>s.replace('rel="canonical" href="'+first.url,'rel="canonical" href="https://another.invalid/role/')],
 ['wrong visible title',s=>s.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/,'$1Another role$2')],
 ['another role publisher',s=>alterJSONLD(s,'Organization',m=>{m.name='Another company'})],
 ['unreviewed structured hiring fields',s=>s.replace('</head>','<script type="application/ld+json">{"@type":"JobPosting","jobLocation":{"addressCountry":"India"}}</script></head>')],
 ['guessed native JSON counterpart',s=>s.replace(first.jsonURL,first.jsonURL+'?context=edit')],
])test('Anand published role rejects '+label,async()=>{await rejection({change:p=>p.url===first.url?edit(p.text):p.text})})
for(const [label,change]of[
 ['complete criteria',p=>p.url===first.url?appendCriteria(p.text,'<p>Additional mandatory licence.</p>'):p.text],
 ['complete CMS metadata',p=>{if(p.url!==first.jsonURL)return p.text;const m=JSON.parse(p.text);m.guid.rendered+='-changed';return JSON.stringify(m)}],
 ['publisher program/style declaration',p=>p.url===first.url?p.text.replace('</head>','<link rel="STYLESHEET" href="https://anandengg.in/changed.css"></head>'):p.text],
 ['current role cohort',p=>p.url==='https://anandengg.in/open-positions/'?p.text.replace(/post-991698\b/g,'post-999999'):p.text],
])test('Anand output cap cannot mask closing '+label+' changes',async()=>{const r=await rejection({maxJobs:1,change:p=>p.n===2?change(p):p.text});assert.match(r.error.message,/closing|identity|differs/);assert.ok(r.calls.length>74)})
for(const [label,delta]of[
 ['HTTP403',{status:403}],['HTTP500',{status:500}],['wrong response URL',{finalURL:'https://another.invalid/'}],['wrong MIME',{contentType:'application/octet-stream'}],['bad byte hash',{bodySHA256:'0'.repeat(64)}],
])test('Anand original response rejects '+label+' without later admission',async()=>{const r=await rejection({responseChange:p=>p.url==='https://anandengg.in/'?delta:{}});assert.equal(r.calls.length,1);assert.equal(r.jobs,undefined)})
for(const [label,bytes]of[['invalid UTF8',Buffer.from([0xc0,0xaf])],['NUL body',Buffer.from('<p>\u0000</p>')],['oversized original',Buffer.alloc(4*1024*1024+1,32)]])test('Anand exact byte decoder rejects '+label,async()=>{const r=await rejection({changeBytes:p=>p.url==='https://anandengg.in/'?bytes:p.bytes});assert.equal(r.calls.length,1)})
test('Anand uncooperative byte adapters obey the per-read deadline',async()=>{const r=await rejection({readTimeoutMs:20,fetchResponse:()=>new Promise(()=>{})});assert.match(r.error.message,/read\/body deadline/);assert.equal(r.jobs,undefined)})
test('Anand synchronous adapter stalls cannot escape the monotonic read deadline',async()=>{const p=packets.get('https://anandengg.in/'),r=await rejection({readTimeoutMs:20,fetchResponse:async()=>{const end=performance.now()+30;while(performance.now()<end){};return{...p,bytes:Buffer.from(p.bodyBase64,'base64')}}});assert.match(r.error.message,/read\/body deadline/)})
test('Anand complete source deadline stops an uncooperative adapter',async()=>{const r=await rejection({readTimeoutMs:200,sourceTimeoutMs:20,fetchResponse:()=>new Promise(()=>{})});assert.match(r.error.message,/source deadline/)})
for(const reason of [0,null,Object.freeze({caller:'opaque'})])test('Anand in-flight cancellation preserves '+String(reason),async()=>{const c=new AbortController();let admitted;const ready=new Promise(resolve=>{admitted=resolve});const pending=replay({signal:c.signal,fetchResponse:()=>{admitted();return new Promise(()=>{})}});await ready;c.abort(reason);const r=await pending;assert.equal(r.rejected,true);assert.equal(r.error,reason)})
test('Anand ordinary public read errors retain their cause and original attempt',async()=>{const cause=Error('network lost'),r=await rejection({fetchResponse:async()=>{throw cause}});assert.equal(r.error.cause,cause);assert.equal(r.error.nativeOriginalResponses.length,1);assert.match(r.error.nativeOriginalResponses[0].error,/public GET/);assert.equal(r.error.nativeOriginalResponses[0].originalBodyComplete,false)})
test('Anand observer records and original bodies are detached from returned and sealed source data',async()=>{let audit;const r=await replay({onAudit:value=>{audit=value;value.records[0].jobId='tampered';value.originalResponses[0].bodyBase64='tampered'},onRecords:rows=>{rows[0].title='tampered'}});assert.equal(r.rejected,false,r.error?.message);assert.equal(r.jobs[0].jobId,first.postID);assert.equal(r.jobs[0].title,first.title);assert.equal(audit.records.length,34);const originals=readAnandOriginalResponses(r.jobs);assert.equal(originals.length,148);assert.equal(sha(Buffer.from(originals[0].bodyBase64,'base64')),originals[0].bodySHA256);originals[0].bodyBase64='changed';assert.notEqual(readAnandOriginalResponses(r.jobs)[0].bodyBase64,'changed')})
test('Anand stalled observers are bounded and cannot return unwitnessed output',async()=>{const r=await rejection({observerTimeoutMs:20,onAudit:()=>new Promise(()=>{})});assert.match(r.error.message,/observer deadline/);assert.equal(r.jobs,undefined)})
test('Anand zero cap preserves original evidence through registry decoration',async()=>{const r=await replay({maxJobs:0});assert.equal(r.rejected,false);assert.deepEqual(readAnandOriginalResponses(r.jobs),[]);assert.equal(readSourceObservationEvidence(r.jobs,provider.source).observedRecordCount,0)})
test('Anand request admission refuses a257th public read and later attempts',async()=>{let calls=0;const bytes=Buffer.from('<p>ok</p>'),io=transport({fetchResponse:async url=>{calls++;return{status:200,finalURL:url,contentType:'text/html',headers:{'content-type':'text/html'},bytes,bodySHA256:sha(bytes)}}});try{for(let i=0;i<256;i++)await io.read('https://anandengg.in/');await assert.rejects(io.read('https://anandengg.in/'),/excessive public request/);await assert.rejects(io.read('https://anandengg.in/'),/excessive public request/);assert.equal(calls,256)}finally{io.control.dispose()}})
test('Anand invalid default MIME headers cancel unread bodies before their stall',async()=>{
 let reads=0,cancelled=0
 const fetchImpl=async url=>({status:200,url,headers:new Headers({'content-type':'application/octet-stream'}),body:{
  cancel:async()=>{cancelled++},
  getReader(){return{read(){reads++;return new Promise(()=>{})},cancel:async()=>{cancelled++},releaseLock(){}}},
 }})
 const r=await rejection({fetchResponse:undefined,readTimeoutMs:40,fetchImpl});assert.match(r.error.message,/MIME/);assert.equal(reads,0);assert.equal(cancelled,1)
})
test('Anand complete closing renderer metadata includes inline style-element attributes',async()=>{const r=await rejection({change:p=>p.url===first.url&&p.n===2?p.text.replace('<style','<style media="print"'):p.text});assert.match(r.error.message,/closing/)})
test('Anand cannot claim full authored criteria while ignoring a stable extra native widget outside the known column',async()=>{
 const needle=first.criteriaHTML+'</div>',r=await replay({change:p=>{if(p.url!==first.url)return p.text;assert.equal(p.text.split(needle).length,2);return p.text.replace(needle,needle+'<div><p>Mandatory licence in an additional native widget.</p></div>')}});assert.equal(r.rejected,true);assert.match(r.error?.message,/criteria|template|unreviewed/)
})
test('Anand pending default bodies are cancelled and released at the read deadline',async()=>{
 let cancel=0,release=0
 const fetchImpl=async url=>({status:200,url,headers:new Headers({'content-type':'text/html'}),body:{
  getReader(){return{read:()=>new Promise(()=>{}),cancel:async()=>{cancel++},releaseLock(){release++}}},
  cancel:async()=>{cancel++},
 }})
 const r=await rejection({fetchResponse:undefined,readTimeoutMs:30,fetchImpl});assert.match(r.error.message,/read\/body deadline/);assert.equal(cancel,1);assert.equal(release,1)
})
test('Anand late default headers transfer body ownership after opaque caller cancellation',async()=>{const c=new AbortController();let resolve,started,cancelReason,cancelled;const ready=new Promise(r=>{started=r}),disposed=new Promise(r=>{cancelled=r});const pending=replay({fetchResponse:undefined,signal:c.signal,fetchImpl:()=>new Promise(r=>{resolve=r;started()})});await ready;c.abort(0);const outcome=await pending;assert.equal(outcome.rejected,true);assert.equal(outcome.error,0);resolve({status:200,url:'https://anandengg.in/',headers:new Headers({'content-type':'text/html'}),body:{cancel:async reason=>{cancelReason=reason;cancelled()}}});await disposed;assert.equal(cancelReason,0)})
test('Anand first oversized default stream chunk is cancelled without another read',async()=>{
 let reads=0,cancel=0,release=0
 const fetchImpl=async url=>({status:200,url,headers:new Headers({'content-type':'text/html'}),body:{
  getReader(){return{read:async()=>{reads++;return{done:false,value:new Uint8Array(4*1024*1024+1)}},cancel:async()=>{cancel++},releaseLock(){release++}}},
 }})
 const r=await rejection({fetchResponse:undefined,fetchImpl});assert.match(r.error.message,/byte limit|oversized/);assert.equal(reads,1);assert.equal(cancel,1);assert.equal(release,1)
})
test('Anand denied default headers dispose stalled bodies without advancing the source',async()=>{let calls=0,reads=0,cancel=0;const r=await rejection({fetchResponse:undefined,fetchImpl:async url=>{calls++;return{status:403,url,headers:new Headers({'content-type':'text/html'}),body:{cancel:async()=>{cancel++},getReader(){reads++;throw Error('Denied body must stay unread')}}}}});assert.match(r.error.message,/HTTP 403/);assert.equal(calls,1);assert.equal(reads,0);assert.equal(cancel,1)})
