import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run,SOURCE} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/current-native-20261115.json.gz',import.meta.url))))
export const ROLE='https://careers.bhp.com/job/India-Economist-Gurgaon/1447607600/'
export const QUERY='https://careers.bhp.com/search/?q=India'
const atBody=(body,notice)=>body.replace(/(<body\b[^>]*>)/,'$1'+notice)
const atOwner=(body,notice)=>body.replace(/(<div\b[^>]*class="jobDisplayShell"[^>]*>)/,'$1'+notice)
const shortDescription=html=>{
 const opening=/<span\b[^>]*itemprop="description"[^>]*>/.exec(html)
 assert.ok(opening,'Genuine complete description boundary')
 const tags=/<\/?span\b[^>]*>/g;tags.lastIndex=opening.index+opening[0].length
 let depth=1,tag
 while((tag=tags.exec(html))){depth+=tag[0].startsWith('</')?-1:1;if(depth===0)return html.slice(0,opening.index+opening[0].length)+'About BHP About the Role About You About Our Process Apply now'+html.slice(tag.index)}
 throw Error('Genuine closing description boundary unavailable')
}
export async function replayCurrent(t,{change,options={}}={}){
 const counts=new Map(),requests=[]
 const fetchImpl=async(value,init={})=>{
  const url=String(value),original=[...fixture.packets,...fixture.legacyRedPackets].find(p=>p.url===url)
  assert.ok(original,'Uncaptured original public GET '+url)
  const packet=structuredClone(original),pass=(counts.get(url)??0)+1;counts.set(url,pass)
  packet.body=Buffer.from(packet.bodyBase64,'base64').toString('utf8');requests.push({url,method:init.method??'GET',body:init.body,headers:init.headers})
  change?.(packet,{pass,number:requests.length})
  const response=new Response(packet.body,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 return{jobs:await run({fetchImpl,requestIntervalMs:0,now:()=> '2026-11-15T11:07:00.000Z',...options}),counts,requests}
}

test('retained current proof packets have unchanged original bytes',()=>{
 assert.equal(fixture.packets.length,39)
 for(const packet of fixture.packets)assert.equal(createHash('sha256').update(Buffer.from(packet.bodyBase64,'base64')).digest('hex'),packet.bodySHA256)
})
test('registered source publishes own full typed India role and retains the foreign observed row with incomplete scope',async t=>{
 const {jobs,requests,counts}=await replayCurrent(t)
 assert.equal(jobs.length,1)
 const [job]=jobs
 assert.equal(job.source,SOURCE);assert.equal(job.jobId,'1447607600');assert.equal(job.title,'India Economist | Gurgaon')
 assert.equal(job.country,'India');assert.equal(job.city,'Gurgaon');assert.equal(job.state,'Haryana')
 assert.ok(job.jobDescription.includes('At least seven years of relevant experience'));assert.ok(job.jobDescription.includes('A degree in economics or a related discipline.'))
 assert.ok(job.jobDescription.includes('paid parental leave policy'));assert.ok(job.jobDescription.includes('police / criminal background checks'))
 assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 assert.equal(job.applyUrl,'https://careers.bhp.com/talentcommunity/apply/1447607600/?locale=en_GB')
 assert.equal(job.closingDate,'2026-11-18T16:00:00.000Z');assert.equal(counts.get(ROLE),2);assert.equal(counts.get(QUERY),2)
 assert.equal(requests.length,78)
 assert.equal(jobs.nativeCollectionEvidence.openingRows.length,2);assert.equal(jobs.nativeCollectionEvidence.closingRows.length,2)
 assert.equal(jobs.nativeCollectionEvidence.heldNativeRows[0].jobId,'1391670200')
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(requests.every(r=>r.method==='GET'&&r.body===undefined&&!/\/apply\/|\/talentcommunity\/|\/services\//.test(r.url)))
})
test('registered reader preserves the pre-existing transparent public HTML request contract',async t=>{
 const {requests}=await replayCurrent(t)
 assert.ok(requests.length>0)
 for(const request of requests){
  assert.equal(request.headers['User-Agent'],'Mozilla/5.0 (compatible; Jobverify careers inventory check)')
  if(!fixture.packets.find(p=>p.url===request.url)?.assetKind)assert.equal(request.headers.Accept,'text/html')
 }
})
for(const notice of ['This job is not available.','This position is currently unavailable.','This position has been filled.','Applications are closed.'])for(const closingOnly of [false,true])test('visible whole-body closure holds'+(closingOnly?' at closing only':'')+': '+notice,async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:(packet,{pass})=>{if(packet.url===ROLE&&(!closingOnly||pass===2))packet.body=atBody(packet.body,'<p>'+notice+'</p>')}}),/closed|unavailable|availability/i)
})
for(const tag of ['template','div hidden'])test('inactive closure prose does not replace the current positive ('+tag+')',async t=>{
 const {jobs}=await replayCurrent(t,{change:packet=>{if(packet.url===ROLE)packet.body=atOwner(packet.body,'<'+tag+'><p>Applications are closed.</p></'+tag.split(' ')[0]+'>')}})
 assert.equal(jobs.length,1)
})
for(const closingOnly of [false,true])test('full own additional qualification is '+(closingOnly?'reconciled on closing':'retained'),async t=>{
 const change=(packet,{pass})=>{if(packet.url===ROLE&&(!closingOnly||pass===2))packet.body=atOwner(packet.body,'<section itemprop="qualifications">Applicants must hold an advanced research credential.</section>')}
 if(closingOnly)await assert.rejects(()=>replayCurrent(t,{change}),/changed|criteria|closing/i)
 else{const {jobs}=await replayCurrent(t,{change});assert.ok(jobs[0].jobDescription.includes('Applicants must hold an advanced research credential.'))}
})
test('complete visible authored benefit prose and formatting remain retained',async t=>{
 const benefit='Employer provides a paid advanced research programme for this position.'
 const {jobs}=await replayCurrent(t,{change:p=>{if(p.url===ROLE)p.body=atOwner(p.body,'<section itemprop="jobBenefits"><h2>Current additional benefit</h2><p><strong>'+benefit+'</strong></p></section>')}})
 assert.ok(jobs[0].jobDescription.includes(benefit));assert.ok(jobs[0].sourceDescription.includes('<strong>'+benefit+'</strong>'))
})
for(const reason of ['opaque-abort',Object.freeze({reason:'frozen-caller-abort'})])test('caller abort reason identity survives source handling '+String(reason),async t=>{
 const controller=new AbortController()
 await assert.rejects(()=>replayCurrent(t,{change:(_,context)=>{if(context.number===1)controller.abort(reason)},options:{signal:controller.signal}}),error=>error===reason)
})

for(const [name,change,pattern]of[
 ['same own country value without the native Job Country label',p=>{p.body=p.body.replace('Job Country:','Office:')},/Job Country|country|field/i],
 ['own employer changed',p=>{p.body=p.body.replace('content="BHP Career Portal"','content="Unrelated Employer"')},/employer/i],
 ['address conflicts with explicit own India work country',p=>{p.body=p.body.replace('itemprop="streetAddress" content="India"','itemprop="streetAddress" content="Australia"')},/country|address/i],
 ['native Apply points to another vacancy',p=>{p.body=p.body.replaceAll('/talentcommunity/apply/1447607600/','/talentcommunity/apply/1391670200/')},/Apply|identity/i],
 ['own expiry is in the past',p=>{p.body=p.body.replace('Wed Nov 18 16:00:00 UTC 2026','Wed Nov 04 16:00:00 UTC 2026')},/expired/i],
 ['full own criteria are replaced by a short teaser',p=>{p.body=shortDescription(p.body)},/criteria/i],
 ['additional own required criterion is hidden',p=>{p.body=atOwner(p.body,'<section itemprop="qualifications" hidden>Applicants require a research permit.</section>')},/hidden|inert|criteria/i],
 ['complete own role is CSS hidden',p=>{p.body=p.body.replace('</head>','<style>.jobDisplayShell{display:none!important}</style></head>')},/JobPosting|visible|body/i],
 ['new body load program changes current execution authority',p=>{p.body=p.body.replace(/<body\b/,'<body onload="window.j2w={}"')},/program|mode/i],
 ['new module mutates computed global namespace',p=>{p.body=p.body.replace('</body>','<script type="module">globalThis["j2w"]={};</script></body>')},/program|mode/i],
 ['current initializer is changed into inert JSON',p=>{p.body=p.body.replace(/(<script) type="text\/javascript">(\s*\/\/<!\[CDATA\[\s*j2w\.init\()/,'$1 type="application/json">$2')},/program|mode/i],
 ['current initializer gains an empty src',p=>{p.body=p.body.replace(/(<script) type="text\/javascript">(\s*\/\/<!\[CDATA\[\s*j2w\.init\()/,'$1 src="" type="text/javascript">$2')},/program|mode/i],
 ['current initializer gains nomodule',p=>{p.body=p.body.replace(/(<script) type="text\/javascript">(\s*\/\/<!\[CDATA\[\s*j2w\.init\()/,'$1 nomodule type="text/javascript">$2')},/program|mode/i],
])test(name+' cannot qualify a current complete role',async t=>{
 let mutations=0
 await assert.rejects(()=>replayCurrent(t,{change:packet=>{if(packet.url===ROLE){const before=packet.body;change(packet);assert.notEqual(packet.body,before,'Control must mutate genuine role bytes');mutations++}}}),pattern)
 assert.ok(mutations>0)
})
for(const [name,change,pattern]of[
 ['impossible native expiry calendar',h=>h.replace('Wed Nov 18 16:00:00 UTC 2026','Tue Nov 31 16:00:00 UTC 2026'),/calendar|date/i],
 ['impossible native publication calendar',h=>h.replace('Wed Nov 04 00:00:00 UTC 2026','Thu Sep 31 00:00:00 UTC 2026'),/calendar|date/i],
 ['additional own conflicting native jobLocation',h=>atOwner(h,'<div itemprop="jobLocation" itemscope itemtype="http://schema.org/Place"><meta itemprop="addressCountry" content="United States"></div>'),/location|country|metadata/i],
 ['additional own metadata qualification',h=>atOwner(h,'<meta itemprop="qualifications" content="Applicants must hold a cryptography doctorate before applying.">'),/metadata|criteria|carrier/i],
 ['both native Apply links disabled',h=>h.replaceAll('class="btn btn-primary btn-large btn-lg apply dialogApplyBtn "','disabled aria-disabled="true" class="btn btn-primary btn-large btn-lg apply dialogApplyBtn disabled"'),/Apply|active/i],
 ['current has-now-been-filled notice',h=>atBody(h,'<p>This position has now been filled.</p>'),/closed|unavailable|availability/i],
 ['current hiring-ended notice',h=>atBody(h,'<p>Hiring for this role has ended.</p>'),/closed|unavailable|availability/i],
])test('independent review: '+name+' holds the current role',async t=>{
 let mutations=0
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url===ROLE){const before=p.body;p.body=change(p.body);assert.notEqual(p.body,before);mutations++}}}),pattern)
 assert.ok(mutations>0)
})
test('independent review: closing-only new own conditions immediately outside JobPosting cannot be omitted',async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:(p,{pass})=>{if(p.url===ROLE&&pass===2)p.body=p.body.replace(/(<div\b[^>]*class="jobDisplayShell"[^>]*>)/,'<section><h2>Additional current requirement for this position</h2><p>Applicants must hold a cryptography doctorate before applying.</p></section>$1')}}),/context|criteria|author|changed/i)
})
const controlCriterion='Applicants must hold a cryptography doctorate before applying.'
for(const [name,change]of[
 ['visible required input value',h=>atOwner(h,'<form><label>Current minimum qualification<input name="requiredQualification" required value="'+controlCriterion+'"></label></form>')],
 ['hidden required input value',h=>atOwner(h,'<form><input type="hidden" name="requiredQualification" required value="'+controlCriterion+'"></form>')],
 ['template required input value',h=>atOwner(h,'<template><input required value="'+controlCriterion+'"></template>')],
 ['required input hidden beside an inactive closure',h=>atOwner(h,'<div hidden><p>Applications are closed.</p><input required value="'+controlCriterion+'"></div>')],
 ['outside-owner hidden required input value',h=>atBody(h,'<input type="hidden" name="requiredQualification" required value="'+controlCriterion+'">')],
 ['existing hidden control gains a criterion value',h=>h.replace('name="createNewAlert" type="hidden" value="false"','name="createNewAlert" type="hidden" value="'+controlCriterion+'"')],
 ['DATA native qualification value',h=>atOwner(h,'<data itemprop="qualifications" value="'+controlCriterion+'"></data>')],
 ['LINK native qualification reference',h=>atOwner(h,'<link itemprop="qualifications" href="https://careers.bhp.com/mandatory-qualification">')],
 ['IMG native qualification alt text',h=>atOwner(h,'<img itemprop="qualifications" alt="'+controlCriterion+'">')],
 ['TIME native qualification datetime',h=>atOwner(h,'<time itemprop="qualifications" datetime="2027-01-01"></time>')],
 ['existing authored element gains a qualification title',h=>h.replace('class="jobdescription"','class="jobdescription" title="'+controlCriterion+'"')],
 ['plain TEXTAREA qualification carrier',h=>atOwner(h,'<textarea required>'+controlCriterion+'</textarea>')],
 ['SELECT native qualification value',h=>atOwner(h,'<select required><option value="'+controlCriterion+'">Current qualification</option></select>')],
])for(const closingOnly of [false,true])test('complete native authority rejects '+name+(closingOnly?' at closing only':''),async t=>{
 let mutations=0
 await assert.rejects(()=>replayCurrent(t,{change:(p,{pass})=>{if(p.url===ROLE&&(!closingOnly||pass===2)){const before=p.body;p.body=change(p.body);assert.notEqual(p.body,before);mutations++}}}),/control|property|value|structure|hidden|inert|criteria|author|context|changed/i)
 assert.ok(mutations>0)
})
for(const closingOnly of [false,true])test('role stylesheet media cannot borrow active CSS from an earlier document'+(closingOnly?' at closing only':''),async t=>{
 let mutations=0
 await assert.rejects(()=>replayCurrent(t,{change:(p,{pass})=>{if(p.url===ROLE){p.body=atOwner(p.body,'<div class="hidden">This position is filled.</div>');if(!closingOnly||pass===2){p.body=p.body.replace(/<link\b[^>]*\brel="stylesheet"[^>]*>/g,tag=>{mutations++;return tag.replace(/\smedia="[^"]*"/g,'').replace(/\s*\/?>$/,' media="print">')})}}}}),/style|mode|closed|unavailable/i)
 assert.ok(mutations>0)
})
for(const url of ['https://www.bhp.com/','https://www.bhp.com/careers'])test('corporate stylesheet cannot hide the declared handoff '+url,async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url===url)p.body=p.body.replace('</head>','<style>a{display:none!important}</style></head>')}}),/binding|handoff/i)
})
for(const [name,change]of[
 ['duplicate resolved foreign native identity',p=>{p.body=p.body.replace(/(<tr class="data-row">[\s\S]*?Dragline Operators[\s\S]*?<\/tr>)/,'$1$1')}],
 ['foreign native role points to unrelated employer origin',p=>{p.body=p.body.replaceAll('/job/Dragline-Operators-Saraji-BMA/1391670200/','https://unrelated.example/job/Dragline-Operators-Saraji-BMA/1391670200/')}],
])test(name+' is validated before country selection',async t=>{
 let changed=false
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url===QUERY){const before=p.body;change(p);assert.notEqual(p.body,before);changed=true}}}),/identity|conflict|repeated|rows/i)
 assert.equal(changed,true)
})
for(const [name,change,pattern]of[
 ['changed native CSS content',p=>{p.body+='\na{display:none!important}'},/client|style/i],
 ['changed native script content',p=>{p.body+=';window.j2w={};'},/client|style/i],
 ['denied native response',p=>{p.status=403},/HTTP status/i],
 ['native final URL mismatch',p=>{p.finalURL='https://unrelated.example/'},/final URL/i],
 ['native response MIME mismatch',p=>{p.headers['content-type']='application/json'},/MIME|client|style/i],
])test(name+' keeps the source held',async t=>{
 const suffix=name.includes('script')?'/platform/js/j2w/min/j2w.core.min.js?h=2fd162d1':'/platform/bootstrap/3.4.8_NES/css/bootstrap.min.css'
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url.endsWith(suffix))change(p)}}),pattern)
})
test('anonymous CSRF and passive visit literals can refresh without changing native authority',async t=>{
 const {jobs}=await replayCurrent(t,{change:p=>{if(!p.assetKind&&p.url.startsWith('https://careers.bhp.com/'))p.body=p.body.replace(/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/g,'12345678-1234-4234-8234-123456789abc')}})
 assert.equal(jobs.length,1)
})
test('observed regenerated passive alert-frequency IDs retain their exact native sibling label bindings',async t=>{
 const {jobs}=await replayCurrent(t,{change:(p,{pass})=>{if(p.url===ROLE)p.body=p.body.replaceAll('j_idt737',pass===1?'j_idt151':'j_idt1282').replaceAll('j_idt871',pass===1?'j_idt162':'j_idt1320')}})
 assert.equal(jobs.length,1);assert.equal(jobs[0].sourceScopeComplete,false)
})
for(const [name,change]of[
 ['unbound passive alert label',h=>h.replace('for="j_idt737"','for="j_idt151"')],
 ['reused passive input identity',h=>h.replaceAll('j_idt871','j_idt737')],
 ['crossed passive sibling label bindings',h=>h.replace('for="j_idt737"','for="<FIRST>"').replace('for="j_idt871"','for="j_idt737"').replace('for="<FIRST>"','for="j_idt871"')],
 ['unreviewed generated-ID representation',h=>h.replaceAll('j_idt737','qualification_737')],
 ['changed native alert input value',h=>h.replace(/(name="frequency"[^>]*value=")7(")/g,'$1'+controlCriterion+'$2')],
])test('passive ID normalization cannot hide '+name,async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:p=>{if(p.url===ROLE){const before=p.body;p.body=change(p.body);assert.notEqual(p.body,before)}}}),/control|property|value|structure|binding/i)
})
test('a known external stylesheet hidden closure notice stays inactive',async t=>{
 const {jobs}=await replayCurrent(t,{change:p=>{if(p.url===ROLE)p.body=atOwner(p.body,'<div class="hidden">Applications are closed.</div>')}})
 assert.equal(jobs.length,1)
})

const streamResponse=(body,url='https://www.bhp.com/')=>({status:200,url,headers:new Headers({'content-type':'text/html'}),body})
for(const reason of ['opaque-stream-abort',Object.freeze({reason:'frozen-stream-abort'})])test('pending body read preserves caller abort and cleans its reader '+String(reason),async()=>{
 const controller=new AbortController(),stats={reads:0,cancels:0,releases:0}
 const body={getReader:()=>({read(){stats.reads++;controller.abort(reason);return new Promise(()=>{})},cancel(value){stats.cancels++;assert.equal(value,reason)},releaseLock(){stats.releases++}})}
 await assert.rejects(()=>run({signal:controller.signal,fetchImpl:async()=>streamResponse(body),requestIntervalMs:0}),error=>error===reason)
 assert.deepEqual(stats,{reads:1,cancels:1,releases:1})
})
test('pending reader is bounded by source deadline and canceled/released',async()=>{
 const stats={cancels:0,releases:0},body={getReader:()=>({read:()=>new Promise(()=>{}),cancel(){stats.cancels++},releaseLock(){stats.releases++}})}
 await assert.rejects(()=>run({fetchImpl:async()=>streamResponse(body),requestIntervalMs:0,sourceDeadlineMs:35}),/source deadline/)
 assert.deepEqual(stats,{cancels:1,releases:1})
})
test('a late response after opaque fetch cancellation is canceled without acquiring a reader',async()=>{
 const controller=new AbortController(),reason=Object.freeze({late:'opaque'}),stats={cancels:0,readers:0};let resolve
 const result=run({signal:controller.signal,requestIntervalMs:0,fetchImpl:()=>new Promise(done=>{resolve=done})})
 await new Promise(done=>setImmediate(done));controller.abort(reason);await assert.rejects(()=>result,error=>error===reason)
 resolve(streamResponse({cancel(value){stats.cancels++;assert.equal(value,reason)},getReader(){stats.readers++}}))
 await new Promise(done=>setImmediate(done));assert.deepEqual(stats,{cancels:1,readers:0})
})
for(const [name,chunk]of[['byte overflow',new Uint8Array(4_000_001)],['non-byte chunk','not native bytes']])test('stream '+name+' cancels and releases before publication',async()=>{
 const stats={reads:0,cancels:0,releases:0},body={getReader:()=>({async read(){stats.reads++;return{done:false,value:chunk}},cancel(){stats.cancels++},releaseLock(){stats.releases++}})}
 await assert.rejects(()=>run({fetchImpl:async()=>streamResponse(body),requestIntervalMs:0}),/byte|chunk/)
 assert.deepEqual(stats,{reads:1,cancels:1,releases:1})
})
