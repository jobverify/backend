import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {parseBoundedProgram,parseRemoteLiteral} from '../../scraper-support/utils/remoteScriptData.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const headerVariants=JSON.parse(fs.readFileSync(new URL('./fixtures/current-header-variants-20261115.json',import.meta.url)))
export const ROLE='https://careers.nike.com/lead-software-engineer-itc/job/R-97392'
export const APPLY='https://nike.wd1.myworkdayjobs.com/nke/job/Karnataka-India/Lead-Software-Engineer--ITC_R-97392/apply'
export async function replayCurrent(t,{change,options={}}={}){
 const requests=[],counts=new Map()
 const fetchImpl=async(value,init={})=>{
  const url=String(value),original=fixture.packets.find(p=>p.url===url)
  assert.ok(original,'Uncaptured public request '+url)
  const packet={...structuredClone(original),body:Buffer.from(original.bodyBase64,'base64').toString()},pass=(counts.get(url)??0)+1
  counts.set(url,pass);requests.push({url,method:init.method??'GET',body:init.body,headers:init.headers})
  change?.(packet,{pass,number:requests.length})
  const response=new Response(packet.body,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 return{jobs:await run({fetchImpl,requestIntervalMs:0,now:()=> '2026-11-15T12:40:00.000Z',...options}),requests,counts}
}
test('genuine native packet bytes remain intact',()=>{
 assert.equal(fixture.packets.length,43)
 for(const p of fixture.packets)assert.equal(createHash('sha256').update(Buffer.from(p.bodyBase64,'base64')).digest('hex'),p.bodySHA256)
})
test('registered source recovers full own India role and retains every observed native row',async t=>{
 const {jobs,requests,counts}=await replayCurrent(t)
 assert.equal(jobs.length,1,'Genuine current typed-India NIKE role R-97392 must be recovered')
 const [job]=jobs
 assert.equal(job.jobId,'R-97392');assert.equal(job.source,'nike');assert.equal(job.country,'India')
 assert.equal(job.nativeLegalEmployer,'NIKE India Technology Center Private Limited')
 assert.equal(job.city,'Karnataka');assert.equal(job.title,'Lead Software Engineer, ITC')
 assert.ok(job.jobDescription.includes('7+ years of experience'))
 assert.ok(job.jobDescription.includes('NIKE, Inc. is a growth company'))
 assert.ok(job.jobDescription.includes('Transparency is key.'))
 const wholeOwner=job.jobDescription.split('\n\n')[0]
 assert.equal(wholeOwner.length,fixture.qualification.ordinaryAnonymousRole.normalizedWholeOwnerCharacters)
 assert.equal(createHash('sha256').update(wholeOwner).digest('hex'),fixture.qualification.ordinaryAnonymousRole.normalizedWholeOwnerSHA256)
 assert.equal(job.closingDate,null);assert.equal(job.remoteStatus,null)
 assert.equal(job.applyUrl,APPLY);assert.equal(job.sourceDetailComplete,true)
 assert.equal(job.sourceScopeComplete,false);assert.equal(job.sourceListingComplete,false)
 assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceRenderedApplicationQualified,false)
 assert.equal(jobs.nativeCollectionEvidence.openingRows.length,100)
 assert.equal(jobs.nativeCollectionEvidence.closingRows.length,100)
 assert.equal(jobs.nativeCollectionEvidence.applicationSubmissions,0)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(counts.get(ROLE),2);assert.equal(counts.get(APPLY),2)
 assert.ok(requests.every(r=>r.method==='GET'&&r.body===undefined))
})
const atBody=(body,value)=>body.replace(/(<body\b[^>]*>)/,'$1'+value)
const atOwner=(body,value)=>body.replace('<article id="job-details">','<article id="job-details">'+value)
const stateChange=(packet,change)=>{
 const d=readNativeDocument(packet.body),s=d.nodes(n=>n.tag==='script'&&n.raw?.includes('__PRELOAD_STATE__'))[0]
 const a=parseBoundedProgram(s.raw).body[0].expression.right,state=parseRemoteLiteral(s.raw.slice(a.start,a.end));change(state)
 packet.body=packet.body.replace(s.raw,s.raw.slice(0,a.start)+JSON.stringify(state)+s.raw.slice(a.end))
}
const schemaChange=(packet,change)=>{
 const d=readNativeDocument(packet.body),s=d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0],value=parseRemoteLiteral(s.raw);change(value)
 packet.body=packet.body.replace(s.raw,JSON.stringify(value))
}
test('existing public HTML User-Agent and Accept are preserved',async t=>{
 const {requests}=await replayCurrent(t)
 for(const r of requests){assert.equal(r.headers['User-Agent'],'Mozilla/5.0 (compatible; Jobverify Nike scraper)');if(!fixture.packets.find(p=>p.url===r.url)?.kind.match(/script|stylesheet/))assert.equal(r.headers.Accept,'text/html,application/xhtml+xml')}
})
for(const notice of ['This job is not available.','This position is currently unavailable.','This position has now been filled.','Hiring for this role has ended.','Applications are closed.'])for(const closingOnly of [false,true])test('current whole-body closure rejects '+notice+(closingOnly?' on closing only':''),async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:(p,{pass})=>{if(p.url===ROLE&&(!closingOnly||pass===2))p.body=atBody(p.body,'<p>'+notice+'</p>')}}),/availability|closed|unavailable/)
})
for(const tag of ['template','noscript','div hidden','div style="display:none"'])test('isolated definite inactive closure notice preserves the positive: '+tag,async t=>{
 const {jobs}=await replayCurrent(t,{change:p=>{if(p.url===ROLE)p.body=atOwner(p.body,'<'+tag+'><p>Applications are closed.</p></'+tag.split(' ')[0]+'>')}});assert.equal(jobs.length,1)
})
for(const url of [ROLE,APPLY])for(const closingOnly of [false,true])test('public own and ATS closing notices hold '+url+(closingOnly?' closing only':''),async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:(p,{pass})=>{if(p.url===url&&(!closingOnly||pass===2))p.body=atBody(p.body,'<p>This job is not available.</p>')}}),/availability|closed|unavailable/)
})
for(const value of ['<section itemprop="qualifications">Applicants must hold a cryptography doctorate.</section>','<meta itemprop="qualifications" content="Applicants must hold a cryptography doctorate.">','<data itemprop="qualifications" value="Applicants must hold a cryptography doctorate."></data>','<link itemprop="qualifications" href="https://careers.nike.com/mandatory-qualification">','<input name="requiredQualification" required value="Applicants must hold a cryptography doctorate.">','<input type="hidden" name="requiredQualification" required value="Applicants must hold a cryptography doctorate.">'])for(const closingOnly of [false,true])test('unknown authored owner criteria/control carrier holds '+value.split('>')[0]+(closingOnly?' closing only':''),async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:(p,{pass})=>{if(p.url===ROLE&&(!closingOnly||pass===2))p.body=atOwner(p.body,value)}}),/owner|context|property|attribute|criteria|structure/)
})
for(const closingOnly of [false,true])test('new authored role criteria outside owner holds'+(closingOnly?' closing only':''),async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:(p,{pass})=>{if(p.url===ROLE&&(!closingOnly||pass===2))p.body=atBody(p.body,'<p>Applicants must hold a cryptography doctorate.</p>')}}),/context|owner|attribute/)
})
for(const change of [
 p=>{p.body=p.body.replace('window.__PRELOAD_STATE__ =','window["__PRELOAD_STATE__"] =')},
 p=>{p.body=p.body.replace('window.__BUILD__ =', 'window.__PRELOAD_STATE__={}; window.__BUILD__ =')},
 p=>{p.body=p.body.replace('window.__BUILD__ =', 'globalThis["__PRELOAD_STATE__"]={}; window.__BUILD__ =')},
 p=>{p.body=p.body.replace(/<script>(\s*window\.__PRELOAD_STATE__)/,'<script type="application/json">$1')},
 p=>{p.body=p.body.replace(/<script>(\s*window\.__PRELOAD_STATE__)/,'<script src="">$1')},
 p=>{p.body=p.body.replace(/<script>(\s*window\.__PRELOAD_STATE__)/,'<script nomodule>$1')},
 p=>{p.body=p.body.replace('"jobSearch":','"jobSearch":{},"job\\u0053earch":')},
 p=>{p.body=p.body.replace('</body>','<script>window.self["__PRELOAD_STATE__"]={}</script></body>')}
])test('unsupported/inert/duplicate current state or additional current program holds '+String(change).slice(0,90),async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url===ROLE)change(p)}}),/preload|state|program|duplicate|decoded/)
})
for(const change of [
 p=>{p.body=p.body.replace('href="/job-detail.css?v=0.7.36"','href="/job-detail.css?v=0.7.36" media="print"')},
 p=>{p.body=p.body.replace('href="/job-detail.css?v=0.7.36"','href="/job-detail.css?v=0.7.36" disabled')},
 p=>{p.body=p.body.replace('</head>','<style>#job-details{display:none!important}</style></head>')},
 p=>{p.body=p.body.replace('<body class="core job-details page-job-details">','<body class="core job-details page-job-details" hidden>')},
 p=>{p.body=p.body.replace('<article id="job-details">','<article id="job-details" aria-hidden="true">')},
 p=>{p.body=p.body.replace('class="button button-primary-light button-lg apply-button"','class="button button-primary-light button-lg apply-button" disabled aria-disabled="true"')}
])test('changed owner/style/application execution authority holds '+String(change).slice(0,90),async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url===ROLE)change(p)}}),/style|title|owner|context|attribute|application|program/)
})
for(const [label,change] of [
 ['own country conflict',s=>{s.jobLocation[0].address.addressCountry='US'}],
 ['own extra foreign location',s=>{s.jobLocation.push({...structuredClone(s.jobLocation[0]),address:{...s.jobLocation[0].address,addressCountry:'US'}})}],
 ['own identifier conflict',s=>{s.identifier.value='R-999999'}],
 ['own employer conflict',s=>{s.hiringOrganization.name='Converse'}],
 ['own new nontext criterion',s=>{s.qualifications='Applicants must hold a cryptography doctorate.'}],
 ['impossible native calendar',s=>{s.datePosted='2026-09-31T10:17:16.016437+00:00'}],
 ['future native publication',s=>{s.datePosted='2027-11-13T10:17:16.016437+00:00'}],
 ['description truncated',s=>{s.description='<p>WHO YOU WILL WORK WITH: Java.</p>'}]
])test(label+' holds full source',async t=>{await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url===ROLE)schemaChange(p,change)}}),/country|location|identity|employer|fields|calendar|date|publication|criteria|description/)} )
for(const [label,change] of [
 ['ATS country conflict',s=>{s.jobLocation.address.addressCountry='United States'}],
 ['ATS legal employer conflict',s=>{s.hiringOrganization.name='Converse India Private Limited'}],
 ['ATS native ID conflict',s=>{s.identifier.value='R-999999'}],
 ['ATS incomplete description',s=>{s.description='<p>Software engineering role.</p>'}],
 ['ATS new full qualification field',s=>{s.qualifications='Applicants must hold a cryptography doctorate.'}]
])test(label+' holds',async t=>{await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url===APPLY)schemaChange(p,change)}}),/country|identity|employer|fields|criteria|description|structure/)} )
for(const closingOnly of [false,true])test('ATS-only additional authored paragraph is '+(closingOnly?'closing compared':'retained whole'),async t=>{
 const change=(p,{pass})=>{if(p.url===APPLY&&(!closingOnly||pass===2)){schemaChange(p,s=>{s.description=s.description.replace('Transparency is key.','Transparency is key. Applicants must hold a cryptography doctorate.')});p.body=p.body.replace('Transparency is key.&quot;','Transparency is key. Applicants must hold a cryptography doctorate.&quot;').replace('Transparency is key.">','Transparency is key. Applicants must hold a cryptography doctorate.">')}}
 if(closingOnly)await assert.rejects(()=>replayCurrent(t,{change}),/closing/)
 else{const {jobs}=await replayCurrent(t,{change});assert.ok(jobs[0].jobDescription.includes('Applicants must hold a cryptography doctorate.'))}
})
for(const [label,change] of [
 ['native India with missing country',s=>{s.jobSearch.jobs.find(r=>r.requisitionID==='R-97392').locations[0].country=''}],
 ['native mixed India/foreign country',s=>{const r=s.jobSearch.jobs.find(r=>r.requisitionID==='R-97392');r.locations.push({...r.locations[0],country:'United States',countryAbbr:'US'})}],
 ['native legal employer ambiguous',s=>{s.jobSearch.jobs.find(r=>r.requisitionID==='R-97392').customFields.find(f=>f.cfKey==='cf_company').value='NIKE Global Services'}],
 ['native other brand',s=>{s.jobSearch.jobs.find(r=>r.requisitionID==='R-97392').brandName='CONVERSE'}]
])test(label+' remains held without zero success',async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url==='https://careers.nike.com/jobs/page/4')stateChange(p,change)}}),/zero authority/)
})
for(const [label,change] of [
 ['duplicate resolved-foreign model identity',s=>{s.jobSearch.jobs[1]=structuredClone(s.jobSearch.jobs[0])}],
 ['foreign role URL unrelated origin',s=>{s.jobSearch.jobs[0].originalURL='https://unrelated.example/job/R-97410'}],
 ['foreign Apply URL unrelated account',s=>{s.jobSearch.jobs[0].applyURL=s.jobSearch.jobs[0].applyURL.replace('nike.wd1','unrelated.wd1')}]
])test(label+' rejects before any country pruning',async t=>{await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url==='https://careers.nike.com/jobs')stateChange(p,change)}}),/identity|mismatch/)} )
for(const [label,change] of [
 ['HTTP denial',p=>{p.status=403}],['wrong MIME',p=>{p.headers['content-type']='application/json'}],['changed final URL',p=>{p.finalURL='https://unrelated.example/'}],['native stylesheet bytes changed',p=>{p.body+='\n/* changed */'}]
])test(label+' fails closed',async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(label.includes('stylesheet')?p.kind==='stylesheet':p.url===ROLE)change(p)}}),/HTTP|MIME|bytes/)
})
for(const reason of ['opaque-caller-cancellation',Object.freeze({reason:'frozen-caller-cancellation'})])test('opaque caller abort identity is preserved '+String(reason),async t=>{
 const controller=new AbortController()
 await assert.rejects(()=>replayCurrent(t,{options:{signal:controller.signal},change:p=>{if(p.url===ROLE)controller.abort(reason)}}),e=>e===reason)
})
test('opaque cancellation during a blocked native body read cancels and releases the reader',async t=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:'stream-cancel'});let cancelled,released=false
 const fetchImpl=async url=>({status:200,url,headers:new Headers({'content-type':'text/html'}),body:{cancel(){},getReader(){return{
  read(){queueMicrotask(()=>controller.abort(reason));return new Promise(()=>{})},cancel(value){cancelled=value},releaseLock(){released=true},
 }}}})
 await assert.rejects(()=>run({fetchImpl,signal:controller.signal,requestIntervalMs:0}),e=>e===reason)
 assert.equal(cancelled,reason);assert.equal(released,true)
})
for(const [name,chunk] of [['non-byte native chunk','not bytes'],['oversized native byte chunk',new Uint8Array(4_000_001)]])test(name+' is cancelled before parsing',async t=>{
 let cancelled=false,released=false
 const fetchImpl=async url=>({status:200,url,headers:new Headers({'content-type':'text/html'}),body:{cancel(){},getReader(){return{read:async()=>({done:false,value:chunk}),cancel(){cancelled=true},releaseLock(){released=true}}}}})
 await assert.rejects(()=>run({fetchImpl,requestIntervalMs:0}),/chunk|byte bound/)
 assert.equal(cancelled,true);assert.equal(released,true)
})
test('source deadline bounds a transport that ignores its abort signal',async()=>{
 const started=performance.now(),fetchImpl=()=>new Promise(()=>{})
 await assert.rejects(()=>run({fetchImpl,requestIntervalMs:0,sourceDeadlineMs:20}),/source deadline/)
 assert.ok(performance.now()-started<2000)
})
test('a response arriving after caller cancellation is disposed without publication',async()=>{
 const controller=new AbortController(),reason='late-fetch-caller-cancel';let resolveFetch,cancelled
 const pending=new Promise(resolve=>{resolveFetch=resolve}),fetchImpl=()=>pending
 const result=run({fetchImpl,signal:controller.signal,requestIntervalMs:0})
 await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
 await assert.rejects(()=>result,e=>e===reason)
 resolveFetch({status:200,url:'https://careers.nike.com/jobs',headers:new Headers({'content-type':'text/html'}),body:{cancel(value){cancelled=value}}})
 await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,reason)
})
test('a changed whole client dependency is held even when the SSR native role remains complete',async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url==='https://careers.nike.com/jobModule.js?v=0.1.9')p.body+='\nwindow.__PRELOAD_STATE__={};'}}),/client|bytes/)
})
for(const attribute of ['alt','title','value','aria-label'])test('unknown current owner non-text value '+attribute+' cannot silently disappear',async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url===ROLE)p.body=p.body.replace('<article id="job-details">','<article id="job-details" '+attribute+'="Applicants must hold a cryptography doctorate.">')}}),/attribute|owner|context/)
})
test('role search-state zero is never accepted as native vacancy inventory',async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url===ROLE)stateChange(p,s=>{s.jobSearch.jobs=[{title:'Other current vacancy',country:'US'}]})}}),/role client search state/)
})
for(const [label,from,to] of [
 ['visible role reference conflict','<dd class="summary-value reqid">R-97392</dd>','<dd class="summary-value reqid">R-999999</dd>'],
 ['visible work-country conflict','4/F, WeWork, Embassy GolfLinks, Karnataka, Karnātaka 560093, India</dd>','4/F, WeWork, Embassy GolfLinks, Karnataka, Karnātaka 560093, United States</dd>']
])test(label+' rejects contradictory current authored summary',async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url===ROLE){assert.ok(p.body.includes(from));p.body=p.body.replace(from,to)}}}),/summary|identity|country|location/)
})
for(const closingOnly of [false,true])test('new plain criteria inside existing inert native furniture holds'+(closingOnly?' closing only':''),async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:(p,{pass})=>{if(p.url===ROLE&&(!closingOnly||pass===2))p.body=p.body.replace('<div role="menu" class="share-menu share-menu-aside" aria-hidden="true">','<div role="menu" class="share-menu share-menu-aside" aria-hidden="true">Applicants must hold a cryptography doctorate.')}}),/owner|context|attribute/)
})
for(const url of [ROLE,APPLY])test('changed current native document title holds '+url,async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url===url){const before=p.body;p.body=p.body.replace(/<title>[^<]*<\/title>/,'<title>Converse India — different employer</title>');assert.notEqual(p.body,before)}}}),/owner|context|attribute|title/)
})
for(const [label,url,closingOnly,name,value] of [
 ['Refresh changes publisher',ROLE,false,'refresh','0;url=https://another.example/jobs/1'],
 ['closing enforced CSP disables native rendering',ROLE,true,'content-security-policy',"script-src 'none'; style-src 'none'; form-action 'none'"],
 ['declared native charset changes criteria meaning',ROLE,false,'content-type','text/html; charset=iso-8859-1'],
 ['native role becomes an attachment',ROLE,false,'content-disposition','attachment; filename="job.bin"'],
 ['closing ATS Link changes canonical publisher',APPLY,true,'link','<https://another.example/jobs/2>; rel="canonical"'],
 ['legacy CSP alters document execution',ROLE,false,'x-content-security-policy',"default-src 'none'"],
 ['WebKit CSP alters document execution',ROLE,false,'x-webkit-csp',"default-src 'none'"],
 ['unreviewed role report-only CSP changes native policy',ROLE,true,'content-security-policy-report-only',"default-src 'none'"],
 ['Location supplies foreign navigation on status200',ROLE,true,'location','https://another.example/jobs/3'],
 ['Content-Location supplies foreign representation identity',ROLE,true,'content-location','https://another.example/jobs/4'],
 ['native nosniff declaration disappears',ROLE,true,'x-content-type-options',null],
 ['native frame execution context changes',APPLY,true,'x-frame-options','SAMEORIGIN'],
 ['duplicate native charset is unreviewed',ROLE,false,'content-type','text/html; charset=utf-8; charset=iso-8859-1'],
])test('reviewed effective response contract: '+label,async t=>{
 let mutations=0
 await assert.rejects(()=>replayCurrent(t,{change:(p,{pass})=>{if(p.url===url&&(!closingOnly||pass===2)){if(value===null)delete p.headers[name];else p.headers[name]=value;mutations++}}}),/header|MIME|charset|response|navigation/)
 assert.ok(mutations>0)
})
test('genuine fresh anonymous ATS responses preserve full criteria with their native rotated reporting headers',async t=>{
 assert.equal(headerVariants.variants.length,2)
 for(const p of headerVariants.variants)assert.equal(createHash('sha256').update(Buffer.from(p.bodyBase64,'base64')).digest('hex'),p.bodySHA256)
 const {jobs,counts}=await replayCurrent(t,{change:(p,{pass})=>{if(p.url===APPLY){const native=headerVariants.variants[pass-1];p.headers=structuredClone(native.headers);p.body=Buffer.from(native.bodyBase64,'base64').toString()}}})
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobDescription.length,6375);assert.equal(counts.get(APPLY),2)
 assert.notEqual(headerVariants.variants[0].headers['content-security-policy-report-only'],headerVariants.variants[1].headers['content-security-policy-report-only'])
})
for(const [label,change] of [
 ['foreign report-only endpoint',h=>{h['content-security-policy-report-only']=h['content-security-policy-report-only'].replace('https://csp-reporting.cloudflare.com/','https://another.example/')}],
 ['crossed native CSP report group',h=>{h['content-security-policy-report-only']=h['content-security-policy-report-only'].replace(/report-to cf-[a-z]{16}$/,'report-to cf-abcdefghijklmnop')}],
 ['crossed native Report-To endpoint',h=>{h['report-to']=h['report-to'].replace('https://csp-reporting.cloudflare.com/','https://another.example/')}],
 ['crossed native Reporting-Endpoints group',h=>{h['reporting-endpoints']=h['reporting-endpoints'].replace(/^cf-[a-z]{16}=/,'cf-abcdefghijklmnop=')}],
 ['foreign Reporting-Endpoints address',h=>{h['reporting-endpoints']=h['reporting-endpoints'].replace('https://csp-reporting.cloudflare.com/','https://another.example/')}],
 ['additional report-only execution directive',h=>{h['content-security-policy-report-only']+="; script-src 'unsafe-inline'"}],
 ['changed report-only directive order',h=>{h['content-security-policy-report-only']=h['content-security-policy-report-only'].replace("script-src 'none'; connect-src 'none'","connect-src 'none'; script-src 'none'")}],
 ['duplicate decoded reporting group key',h=>{h['report-to']=h['report-to'].replace('"group":"cf-nel"','"group":"foreign","gr\\u006fup":"cf-nel"')}],
 ['non-JSON reporting object-key syntax',h=>{h['report-to']=h['report-to'].replaceAll('"group":','group:')}],
 ['unknown added reporting group',h=>{h['report-to']+=', {"group":"another","max_age":86400,"endpoints":[{"url":"https://another.example/report"}]}'}],
 ['enforced ATS policy replacing reporting-only semantics',h=>{h['content-security-policy']=h['content-security-policy-report-only']}],
])test('narrow native reporting-header control: '+label,async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:(p,{pass})=>{if(p.url===APPLY&&pass===2)change(p.headers)}}),/header|policy|reporting|response|endpoint/)
})
for(const [label,change] of [
 ['stylesheet MIME charset changes',p=>{p.headers['content-type']='text/css; charset=iso-8859-1'}],
 ['script declared attachment',p=>{p.headers['content-disposition']='attachment; filename="client.js"'}],
 ['client Link introduces foreign stylesheet',p=>{p.headers.link='<https://another.example/hide.css>; rel="stylesheet"'}]
])test('native dependency effective response contract: '+label,async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url===(label.includes('stylesheet MIME')?'https://careers.nike.com/job-detail.css?v=0.7.36':'https://careers.nike.com/index.js?v=0.7.36'))change(p)}}),/header|response|MIME/)
})

for(const closingOnly of [false,true])test('reviewed native ATS facility substitution holds'+(closingOnly?' on closing only':' on both independent reads'),async t=>{
 let changed=0
 await assert.rejects(()=>replayCurrent(t,{change:(p,{pass})=>{if(p.url===APPLY&&(!closingOnly||pass===2))schemaChange(p,s=>{assert.equal(s.jobLocation.address.addressLocality,'INDIA TECHNOLOGY CENTER');s.jobLocation.address.addressLocality='UNREVIEWED TECHNOLOGY CENTER';changed++})}}),/location|facility|model|closing/)
 assert.ok(changed>0)
})
test('reviewed native own complete address changes require review even when model schema and visible summary agree',async t=>{
 let changed=0
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url===ROLE||/^https:\/\/careers\.nike\.com\/jobs(?:\/page\/\d+)?$/.test(p.url)){const next=p.body.replaceAll('560093','560094');if(next!==p.body){changed++;p.body=next}}}}),/location|address|model/)
 assert.ok(changed>=2)
})
for(const [label,country,facility]of [['unresolved','India',''],['mixed foreign','United States','UNREVIEWED FOREIGN FACILITY']])for(const closingOnly of [false,true])test('complete native ATS location binding holds '+label+' second alternative'+(closingOnly?' closing only':''),async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:(p,{pass})=>{if(p.url===APPLY&&(!closingOnly||pass===2))schemaChange(p,s=>{const other=structuredClone(s.jobLocation);other.address.addressCountry=country;other.address.addressLocality=facility;s.jobLocation=[s.jobLocation,other]})}}),/country|location|facility|model/)
})
for(const [key,value]of [['addressRegion','UNREVIEWED REGION'],['postalCode','999999']])test('unknown native ATS address property '+key+' is never discarded',async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url===APPLY)schemaChange(p,s=>{s.jobLocation.address[key]=value})}}),/fields|location|address|model/)
})
test('known complete native facility stays distinct from the original own city and address',async t=>{
 const {jobs}=await replayCurrent(t);const [job]=jobs
 assert.equal(job.city,'Karnataka');assert.equal(job.nativeLocations[0].stateAbbr,'Karnātaka');assert.equal(job.nativeLocations[0].zipCode,'560093')
 assert.deepEqual(JSON.parse(JSON.stringify(job.sourceNativeAtsJobPosting.jobLocation)),{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'India',addressLocality:'INDIA TECHNOLOGY CENTER'}})
 assert.equal(job.sourceNativeJobPosting.jobLocation[0].address.addressLocality,'Karnataka');assert.equal(job.jobDescription.length,6375)
 assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
})
