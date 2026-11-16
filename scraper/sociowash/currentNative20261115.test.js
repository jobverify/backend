import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {currentSociowashInitializers,currentSociowashHeaders,strictSociowashJSON} from './currentNative20261115.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const options={now:()=>new Date('2026-11-15T17:30:00.000Z'),requestIntervalMs:0}
const originals=new Map(fixture.originalRegisteredPackets.map(packet=>[packet.requestedURL,packet]))
const groups=new Map()
for(const packet of fixture.packets){const key=packet.requestedURL??packet.url;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(packet)}
export function transport(mutate){
 const counts=new Map(),calls=[]
 const fetchImpl=async(url,init)=>{
  url=String(url);const count=(counts.get(url)??0)+1;counts.set(url,count);calls.push({url,init,count})
  const candidates=groups.get(url),original=candidates?.[Math.min(count-1,candidates.length-1)]??originals.get(url)
  assert.ok(original,'Only genuine observed native URLs may be requested: '+url)
  let packet={...original,headers:{...original.headers},html:Buffer.from(original.bodyBase64,'base64').toString('utf8')}
  packet=mutate?.(packet,{url,count,init})??packet
  const response=new Response(packet.bytes??packet.html,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl??packet.url})
  return response
 }
 return{fetchImpl,calls,counts}
}

const marker='Applicants must hold a cryptography doctorate before applying.'
const target='414709000015839005'
const encode=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
function rowsIn(packet,change){
 if(!['board','role'].includes(packet.kind))return packet
 const parsed=currentSociowashInitializers(packet.html,packet.kind),rows=structuredClone(parsed.rows)
 change(rows,packet.kind)
 if(packet.kind==='board')packet.html=packet.html.replace(/<input\b[^>]*\bid="jobs"[^>]*>/,tag=>tag.replace(/\bvalue="[^"]*"/,'value="'+encode(JSON.stringify(rows))+'"'))
 else packet.html=packet.html.replace(parsed.source,parsed.source.slice(0,parsed.dataNode.start)+'JSON.parse('+JSON.stringify(JSON.stringify(rows))+')'+parsed.source.slice(parsed.dataNode.end))
 return packet
}
const runWith=(change,extra={})=>{const t=transport(change);return run({...options,...extra,fetchImpl:t.fetchImpl})}

for(const sentence of [
 'Applicants must reside in United States.',
 'Applicants must live in United States.',
 'Your appointment is with Acme Corporation.',
 'Your contract is with Acme Corporation.',
 'For this opportunity, apply before 1 November 2026.',
 'Candidates must apply before 1 November 2026.',
 'Only candidates living within United States may proceed.',
 'Residence in United States is mandatory.',
 'This appointment will be issued through Acme Corporation.',
 'The proposed contractual counterparty is Acme Corporation.',
 'For consideration, applications end on 1 November 2026.',
 'To be considered, candidates shall apply by 1 November 2026.',
])test('neutral complete native residence/entity/deadline clause requires review: '+sentence,async()=>{
 await assert.rejects(runWith(packet=>rowsIn(packet,(rows,kind)=>{
  const row=rows.find(value=>value.id===target)
  if(row)row.Job_Description+=kind==='role'?'<p>'+sentence+'</p>':' '+sentence
 })),/unreviewed.*authority/)
})

for(const sentence of [
 'Candidates are expected to demonstrate careful experimental design.',
 'Experience applying reusable testing patterns is required.',
])test('neutral complete ordinary qualification remains lossless: '+sentence,async()=>{
 const jobs=await runWith(packet=>rowsIn(packet,(rows,kind)=>{
  const row=rows.find(value=>value.id===target)
  if(row)row.Job_Description+=kind==='role'?'<p>'+sentence+'</p>':' '+sentence
 }))
 assert.equal(jobs.length,2)
 const job=jobs.find(value=>value.jobId===target)
 for(const content of [job.jobDescription,job.sourceDescription,job.sourceNativeDescription,job.sourceNativeModel.Job_Description])assert.ok(content.includes(sentence))
 assert.deepEqual(jobs.sourceAudit.opening,jobs.sourceAudit.closing)
 assert.equal(jobs.sourceAudit.opening.rows.length,48)
})

for(const sentence of [
 'Resumes must be received by 1 November 2026.',
 'All curricula vitae should reach us by 1 November 2026.',
 'Cover letters must be received by 1 November 2026.',
 'CVs must be received by 1 November 2026.',
])test('plural complete native material subject requires review: '+sentence,async()=>{
 await assert.rejects(runWith(packet=>rowsIn(packet,(rows,kind)=>{const row=rows.find(value=>value.id===target);if(row)row.Job_Description+=kind==='role'?'<p>'+sentence+'</p>':' '+sentence})),/unreviewed.*authority/)
})

for(const sentence of ['This role is based in United States.','Your employer will be Another Employer Limited.','Applications close on 1 November 2026.'])test('explicit authored role authority cannot contradict published qualification: '+sentence,async()=>{
 await assert.rejects(runWith(packet=>rowsIn(packet,(rows,kind)=>{const row=rows.find(row=>row.id===target);if(row)row.Job_Description+=kind==='role'?'<p>'+sentence+'</p>':' '+sentence})),/unreviewed.*authority/)
})
test('an unknown community observation is retained without being counted as a native vacancy',async()=>{
 const jobs=await runWith(packet=>rowsIn(packet,(rows,kind)=>{if(kind==='board')rows.push({id:'414709099999999999',Posting_Title:'Join our talent community',recordKind:'community-interest'})}))
 const evidence=readSourceObservationEvidence(jobs,'sociowash');assert.equal(evidence.observedRecordCount,49);assert.equal(evidence.observedVacancyCount,48);assert.equal(evidence.recordKind,'mixed');assert.ok(jobs.sourceAudit.opening.held.some(item=>item.row.recordKind==='community-interest'));assert.equal(jobs.sourceAudit.opening.rows.length,49)
})
for(const sentence of ['Applications will be accepted until 1 November 2026.','Apply before 1 November 2026.','Applications should reach us by 1 November 2026.'])test('complete application authority paragraph holds independently of a finite modal/date grammar: '+sentence,async()=>{
 await assert.rejects(runWith(packet=>rowsIn(packet,(rows,kind)=>{const row=rows.find(row=>row.id===target);if(row)row.Job_Description+=kind==='role'?'<p>'+sentence+'</p>':' '+sentence})),/unreviewed.*authority/)
})
test('an isolated negated availability paragraph remains current and fully retained',async()=>{
 const sentence='Applications are not closed.'
 const jobs=await runWith(packet=>rowsIn(packet,(rows,kind)=>{const row=rows.find(row=>row.id===target);if(row)row.Job_Description+=kind==='role'?'<p>'+sentence+'</p>':' '+sentence}));assert.equal(jobs.length,2);assert.ok(jobs.find(job=>job.jobId===target).jobDescription.includes(sentence))
})
for(const sentence of ['Your primary work location is New York, United States.','The work country for this position is United States.','Work country for this position is United States.','The hiring entity for this position is Another Employer Limited.'])test('complete native location/country/hiring-entity subject block remains unreviewed: '+sentence,async()=>{
 await assert.rejects(runWith(packet=>rowsIn(packet,(rows,kind)=>{const row=rows.find(row=>row.id===target);if(row)row.Job_Description+=kind==='role'?'<p>'+sentence+'</p>':' '+sentence})),/unreviewed.*authority/)
})
for(const sentence of [
 'Submit your CV by 1 November 2026.',
 'Please send your CV no later than 1 November 2026.',
 'Submit your resume by 1 November 2026.',
 'Please send your résumé no later than 1 November 2026.',
 'Submit your curriculum vitae by 1 November 2026.',
 'Please send your cover letter no later than 1 November 2026.',
 'You will be working for Acme Corporation.',
 'You will work for Acme Corporation.',
 'Your duty station is New York, United States.',
 'You are assigned to New York, United States.',
 'You will be stationed in New York, United States.'
])for(const closingOnly of [false,true])test('complete native employment/workplace/application topic requires review '+JSON.stringify({sentence,closingOnly}),async()=>{
 await assert.rejects(runWith((packet,{count})=>!closingOnly||count===2?rowsIn(packet,(rows,kind)=>{const row=rows.find(row=>row.id===target);if(row)row.Job_Description+=kind==='role'?'<p>'+sentence+'</p>':' '+sentence}):packet),error=>error.failureKind==='coverage_gap'&&error.sourceScopeComplete===false&&error.lifecycleCleanupAllowed===false)
})
test('the genuine Swiper response with its narrowly paired native Cloudflare NEL headers remains qualified',async()=>{
 const observed=fixture.currentRegisteredHeaderObservations.find(packet=>packet.requestedURL==='https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css');assert.ok(observed)
 const jobs=await runWith(packet=>{if(packet.url===observed.requestedURL)packet.headers={...observed.headers};return packet});assert.equal(jobs.length,2)
})
for(const sentence of ['This role is based in United States.','Your employer will be Another Employer Limited.','Applications close on 1 November 2026.'])test('closing-only native authority assertion holds: '+sentence,async()=>{
 await assert.rejects(runWith((packet,{count})=>count===2?rowsIn(packet,(rows,kind)=>{const row=rows.find(row=>row.id===target);if(row)row.Job_Description+=kind==='role'?'<p>'+sentence+'</p>':' '+sentence}):packet),/unreviewed.*authority/)
})
for(const sentence of ['This position will be located in United States.','Work location: United States.','Country: United States.','Employer: Another Employer Limited.','You will be employed by Another Employer Limited.','Application deadline: 1 November 2026.','Applications will close on 1 November 2026.','Closing date: 1 November 2026.','Apply by 1 November 2026.','Applications must be received by 1 November 2026.'])test('unreviewed explicit native authority phrase remains a hold: '+sentence,async()=>{
 await assert.rejects(runWith(packet=>rowsIn(packet,(rows,kind)=>{const row=rows.find(row=>row.id===target);if(row)row.Job_Description+=kind==='role'?'<p>'+sentence+'</p>':' '+sentence})),/unreviewed.*authority/)
})
for(const [label,change] of [
 ['missing reporting half',headers=>delete headers['report-to']],
 ['missing NEL half',headers=>delete headers.nel],
 ['foreign endpoint',headers=>{const value=JSON.parse(headers['report-to']);value.endpoints[0].url=value.endpoints[0].url.replace('a.nel.cloudflare.com','example.invalid');headers['report-to']=JSON.stringify(value)}],
 ['foreign endpoint path',headers=>{const value=JSON.parse(headers['report-to']);value.endpoints[0].url=value.endpoints[0].url.replace('/report/v4','/unreviewed');headers['report-to']=JSON.stringify(value)}],
 ['foreign reporting group',headers=>{const value=JSON.parse(headers['report-to']);value.group='foreign';headers['report-to']=JSON.stringify(value)}],
 ['unbound NEL group',headers=>{const value=JSON.parse(headers.nel);value.report_to='foreign';headers.nel=JSON.stringify(value)}],
 ['unknown reporting condition',headers=>{const value=JSON.parse(headers['report-to']);value.include_subdomains=true;headers['report-to']=JSON.stringify(value)}],
 ['extra endpoint query',headers=>{const value=JSON.parse(headers['report-to']);value.endpoints[0].url+='&foreign=1';headers['report-to']=JSON.stringify(value)}],
 ['duplicate decoded key',headers=>{headers['report-to']=headers['report-to'].replace('"group":"cf-nel"','"group":"foreign","gro\\u0075p":"cf-nel"')}],
 ['unquoted JSON key',headers=>{headers['report-to']=headers['report-to'].replace('"group":','group:')}],
 ['unbound reporting endpoints',headers=>{headers['reporting-endpoints']='cf-nel="https://example.invalid/report"'}],
 ['new enforced CSP',headers=>{headers['content-security-policy']="default-src 'none'; style-src 'none'"}],
 ['changed full MIME',headers=>{headers['content-type']='text/css; charset=iso-8859-1'}]
])test('exact Swiper optional NEL admission rejects '+label,async()=>{
 const observed=fixture.currentRegisteredHeaderObservations.find(packet=>packet.requestedURL==='https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css')
 await assert.rejects(runWith(packet=>{if(packet.url===observed.requestedURL){packet.headers={...observed.headers};change(packet.headers)}return packet}))
})
test('a native Swiper reporting token may rotate while retaining the exact bound reporting model',async()=>{
 const observed=fixture.currentRegisteredHeaderObservations.find(packet=>packet.requestedURL==='https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css'),other=cfPackets[0],token=JSON.parse(other.headers['report-to']).endpoints[0].url
 const jobs=await runWith(packet=>{if(packet.url===observed.requestedURL){packet.headers={...observed.headers};const value=JSON.parse(packet.headers['report-to']);value.endpoints[0].url=token;packet.headers['report-to']=JSON.stringify(value)}return packet});assert.equal(jobs.length,2)
})

test('additional selected board requirements cannot be omitted while the full native row remains raw',async()=>{
 await assert.rejects(runWith(packet=>rowsIn(packet,(rows,kind)=>{if(kind==='board')rows.find(row=>row.id===target).Required_Qualifications=marker})),/unreviewed.*fields/)
})

test('unknown nested department criteria cannot be discarded by rendering only the native name',async()=>{
 await assert.rejects(runWith(packet=>rowsIn(packet,rows=>{const row=rows.find(row=>row.id===target);if(row)row.Department_Name.Required_Qualifications=marker})),/unreviewed.*fields/)
})

test('an unreviewed structured agency requirement cannot lose properties while only its name is rendered',async()=>{
 await assert.rejects(runWith(packet=>rowsIn(packet,(rows,kind)=>{const row=rows.find(row=>row.id===target);if(row&&kind==='role')row.Agency_Experience={name:'Yes',Required_Qualifications:marker}})),/native.*(?:scalar|field)/)
})

test('an impossible native calendar remains an identified source failure rather than an incidental date exception',async()=>{
 await assert.rejects(runWith(packet=>rowsIn(packet,rows=>{const row=rows.find(row=>row.id===target);if(row)row.Date_Opened='2026-13-01'})),/invalid native date\/calendar/)
})

test('registered Sociowash uses the current corporate handoff and two complete typed India native roles while retaining all 48 observations',async()=>{
 const t=transport(),jobs=await run({...options,fetchImpl:t.fetchImpl})
 assert.equal(jobs.length,2)
 assert.deepEqual(jobs.map(job=>job.nativePublicJobId),['414709000015839005','414709000017915013'])
 for(const job of jobs){
  assert.equal(job.company,'Sociowash');assert.equal(job.country,'India');assert.equal(job.requisitionId,null);assert.equal(job.nativeLegalEmployer,null)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.sourceListingComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceRenderedApplicationQualified,false)
  assert.equal(job.sourceWholeOriginalCriteriaRetained,true);assert.equal(job.sourcePublicApplicationMetadataQualified,true)
  assert.ok(job.sourceNativeModel.Job_Description.length>14000);assert.ok(job.sourceDescription.includes(job.sourceNativeModel.Job_Description));assert.match(job.jobDescription,/Agency Experience: Yes/)
 }
 assert.match(jobs[0].jobDescription,/8\+ Years/);assert.match(jobs[1].jobDescription,/3\.5 to 5 Years/)
 assert.equal(jobs.sourceAudit.opening.rows.length,48);assert.equal(jobs.sourceAudit.closing.rows.length,48);assert.equal(jobs.sourceAudit.opening.held.length,46)
 assert.ok(t.calls.every(call=>call.init.method==='GET'&&call.init.redirect==='manual'&&call.init.credentials==='omit'))
 assert.ok(!t.calls.some(call=>/PortalDetail|candidateportal|candidatedetail|googletagmanager|password_strength|screening-bot-models|zia-skills-sdk/.test(call.url)))
 assert.equal(t.calls.length,70);assert.ok([...t.counts.values()].every(count=>count===2))
 assert.ok(t.calls.every(call=>call.init.headers['User-Agent']==='Mozilla/5.0 (compatible; Jobverify careers inventory check)'&&!Object.keys(call.init.headers).some(key=>/cookie|authorization/i.test(key))))
 assert.ok(t.calls.filter(call=>['https://www.sociowash.com/about','https://sociowash.zohorecruit.com/jobs/Careers'].includes(call.url)||/\/jobs\/Careers\//.test(call.url)).every(call=>call.init.headers.Accept==='text/html'))
 for(const job of jobs){assert.match(job.jobDescription,/Resume \(required\)/);assert.match(job.jobDescription,/Maximum file size: 10485760 bytes/);assert.match(job.jobDescription,/CAPTCHA \(required\)/);assert.match(job.jobDescription,/Notice Period \(required\).*14 weeks/)}
})

test('a consistently authored full description addition is published from both independent native reads',async()=>{
 const jobs=await runWith(packet=>rowsIn(packet,(rows,kind)=>{const row=rows.find(row=>row.id===target);if(row)row.Job_Description+=kind==='role'?'<p>'+marker+'</p>':' '+marker}))
 const job=jobs.find(job=>job.jobId===target);assert.ok(job);assert.ok(job.jobDescription.includes(marker));assert.ok(job.sourceDescription.includes(marker));assert.equal(jobs.sourceAudit.opening.rows.length,48)
})
test('an ordinary full qualification beside the original generic deadline word remains published',async()=>{
 const jobs=await runWith(packet=>rowsIn(packet,rows=>{const row=rows.find(row=>row.id===target);if(row){assert.match(row.Job_Description,/\bdeadline\b/);row.Job_Description=row.Job_Description.replace(/\bdeadline\b/,'deadline. '+marker)}}))
 assert.equal(jobs.length,2);assert.ok(jobs.find(job=>job.jobId===target).jobDescription.includes(marker));assert.equal(jobs.sourceAudit.opening.rows.length,48)
})

for(const scenario of [
 ['closing-only complete description addition',(packet,{count})=>count===2?rowsIn(packet,(rows,kind)=>{const row=rows.find(row=>row.id===target);if(row)row.Job_Description+=kind==='role'?'<p>'+marker+'</p>':' '+marker}):packet],
 ['detail-only complete description addition',packet=>packet.kind==='role'?rowsIn(packet,rows=>{if(rows[0].id===target)rows[0].Job_Description+='<p>'+marker+'</p>'}):packet],
 ['board-only complete description addition',packet=>packet.kind==='board'?rowsIn(packet,rows=>{rows.find(row=>row.id===target).Job_Description+=' '+marker}):packet],
 ['unknown separate requirements field',packet=>rowsIn(packet,(rows,kind)=>{const row=rows.find(row=>row.id===target);if(row&&kind==='role')row.Requirements=marker})],
 ['unknown second location alternative',packet=>rowsIn(packet,rows=>{const row=rows.find(row=>row.id===target);if(row)row.Additional_Locations=[{Country:'United States',City:'New York'}]})],
 ['unknown native expiry field',packet=>rowsIn(packet,(rows,kind)=>{const row=rows.find(row=>row.id===target);if(row&&kind==='role')row.Expiry_Date='2026-11-01'})],
 ['native original employer replaced by another group brand',packet=>rowsIn(packet,(rows,kind)=>{const row=rows.find(row=>row.id===target);if(row)row.Job_Description=kind==='role'?row.Job_Description.replace(/Sociowash/g,'Another Employer'):row.Job_Description.replace(/Sociowash/g,'Another Employer')})],
 ['repeated uninspected foreign vacancy identity',packet=>rowsIn(packet,(rows,kind)=>{if(kind==='board'){const row=structuredClone(rows.find(row=>![target,'414709000017915013'].includes(row.id)));row.Country='United States';rows.push(row)}})],
 ['foreign selected country',packet=>rowsIn(packet,rows=>{const row=rows.find(row=>row.id===target);if(row)row.Country='United States'})],
 ['unknown selected country despite familiar city',packet=>rowsIn(packet,rows=>{const row=rows.find(row=>row.id===target);if(row)row.Country=null})],
 ['mixed native country value',packet=>rowsIn(packet,rows=>{const row=rows.find(row=>row.id===target);if(row)row.Country='India; United States'})],
 ['unreviewed selected city',packet=>rowsIn(packet,rows=>{const row=rows.find(row=>row.id===target);if(row)row.City='Bengaluru'})],
 ['unreviewed selected state',packet=>rowsIn(packet,rows=>{const row=rows.find(row=>row.id===target);if(row)row.State='Karnataka'})],
 ['unreviewed native postal code',packet=>rowsIn(packet,(rows,kind)=>{const row=rows.find(row=>row.id===target);if(row&&kind==='role')row.Zip_Code='999999'})],
 ['closing-only complete native location drift',(packet,{count})=>count===2?rowsIn(packet,rows=>{const row=rows.find(row=>row.id===target);if(row)row.City='Bengaluru'}):packet],
 ['impossible native day rollover',packet=>rowsIn(packet,rows=>{const row=rows.find(row=>row.id===target);if(row)row.Date_Opened='2026-11-31'})],
 ['future original native posting date',packet=>rowsIn(packet,rows=>{const row=rows.find(row=>row.id===target);if(row)row.Date_Opened='2026-11-16'})],
 ['unknown native attachment meaning',packet=>{if(packet.kind==='role')packet.html=packet.html.replace('var public_attachments_info = null','var public_attachments_info = []');return packet}],
 ['closing-only uninspected raw observation drift',(packet,{count})=>count===2&&packet.kind==='board'?rowsIn(packet,rows=>{rows.find(row=>![target,'414709000017915013'].includes(row.id)).Posting_Title+=' changed'}):packet]
])test(scenario[0]+' holds instead of silently publishing contradictory or incomplete data',async()=>{await assert.rejects(runWith(scenario[1]))})

test('one independently inactive selected record leaves one positive and every native row held or retained',async()=>{
 const jobs=await runWith(packet=>rowsIn(packet,(rows,kind)=>{if(kind==='board')rows.find(row=>row.id===target).Publish=false}))
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'414709000017915013');assert.equal(jobs.sourceAudit.opening.rows.length,48);assert.equal(jobs.sourceAudit.opening.held.length,47);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
test('no current selected positive cannot certify whole-company or India zero',async()=>{
 await assert.rejects(runWith(packet=>rowsIn(packet,(rows,kind)=>{if(kind==='board')for(const row of rows)if([target,'414709000017915013'].includes(row.id))row.Publish=false})),error=>error.failureKind==='coverage_gap'&&error.sourceScopeComplete===false&&error.lifecycleCleanupAllowed===false)
})

for(const html of [
 '<meta itemprop="qualifications" content="'+marker+'">',
 '<data itemprop="qualifications" value="'+marker+'"></data>',
 '<link itemprop="qualifications" href="https://example.invalid/mandatory-qualification">',
 '<input required name="requiredQualification" value="'+marker+'">',
 '<input hidden required name="requiredQualification" value="'+marker+'">',
 '<textarea name="requiredQualification">'+marker+'</textarea>',
 '<select required name="requiredQualification"><option>'+marker+'</option></select>',
 '<p hidden>'+marker+'</p>',
 '<p inert>'+marker+'</p>'
])test('unsupported native criterion carrier holds: '+html.slice(0,65),async()=>{
 await assert.rejects(runWith(packet=>{if(packet.kind==='role'&&packet.url.includes('/'+target+'/'))packet.html=packet.html.replace('</body>',html+'</body>');return packet}))
})

for(const notice of ['This job is not available.','This position is currently unavailable.','This position has now been filled.','Applications are closed.','Hiring for this role has ended.'])for(const closingOnly of [false,true])test('active native availability notice holds '+JSON.stringify({notice,closingOnly}),async()=>{
 await assert.rejects(runWith((packet,{count})=>{if(packet.kind==='role'&&packet.url.includes('/'+target+'/')&&(!closingOnly||count===2))packet.html=packet.html.replace('</body>','<p>'+notice+'</p></body>');return packet}))
})
for(const wrapper of [text=>'<p hidden>'+text+'</p>',text=>'<div style="display:none">'+text+'</div>',text=>'<template>'+text+'</template>',text=>'<noscript>'+text+'</noscript>'])test('an isolated definitely inactive fallback closure preserves genuine current positives: '+wrapper('notice'),async()=>{
 const jobs=await runWith(packet=>{if(packet.kind==='role'&&packet.url.includes('/'+target+'/'))packet.html=packet.html.replace('</body>',wrapper('This position is filled.')+'</body>');return packet});assert.equal(jobs.length,2)
})

for(const [label,change] of [
 ['inert native initializer',html=>{const parsed=currentSociowashInitializers(html,'role');return html.replace('<script>'+parsed.source,'<script type="application/json">'+parsed.source)}],
 ['native initializer empty src',html=>{const parsed=currentSociowashInitializers(html,'role');return html.replace('<script>'+parsed.source,'<script src="">'+parsed.source)}],
 ['native initializer nomodule mode',html=>{const parsed=currentSociowashInitializers(html,'role');return html.replace('<script>'+parsed.source,'<script nomodule>'+parsed.source)}],
 ['unknown initializer authority write',html=>{const parsed=currentSociowashInitializers(html,'role');return html.replace(parsed.source,parsed.source+'\nwindow.jobs=[];')}],
 ['screen styles changed to print',html=>html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g,tag=>tag.replace(/\s*\/?>$/,' media="print">'))],
 ['new stylesheet visibility rule',html=>html.replace('</head>','<style>a{display:none!important}</style></head>')],
 ['unreviewed base',html=>html.replace('</head>','<base href="https://example.invalid/">\n</head>')]
])test(label+' is not treated as the reviewed executable current client',async()=>{
 await assert.rejects(runWith(packet=>{if(packet.kind==='role'&&packet.url.includes('/'+target+'/')){const before=packet.html;packet.html=change(packet.html);assert.notEqual(packet.html,before,'real retained packet must be mutated')}return packet}))
})
test('hidden corporate handoff cannot establish current employer delegation',async()=>{
 await assert.rejects(runWith(packet=>{if(packet.kind==='corporate')packet.html=packet.html.replace('href="https://sociowash.zohorecruit.com/jobs/Careers"','hidden href="https://sociowash.zohorecruit.com/jobs/Careers"');return packet}))
})
test('current authoritative declared client byte mutation holds',async()=>{
 await assert.rejects(runWith(packet=>{if(packet.kind==='asset'&&packet.html.includes('getManualApplyForm'))packet.html+='\nwindow.additionalRequiredQualification='+JSON.stringify(marker)+';';return packet}))
})

for(const [header,value] of [
 ['refresh','0; url=https://example.invalid/foreign-role'],
 ['content-type','text/html; charset=iso-8859-1'],
 ['content-disposition','attachment; filename="role.html"'],
 ['content-security-policy',"default-src 'none'; script-src 'none'; style-src 'none'; form-action 'none'"],
 ['content-security-policy-report-only',"default-src 'none'"],
 ['link','<https://example.invalid/foreign-role>; rel="canonical"'],
 ['location','https://example.invalid/foreign-role'],
 ['content-location','https://example.invalid/foreign-role'],
 ['x-content-type-options','unreviewed-mode'],
 ['reporting-endpoints','foreign="https://example.invalid/report"']
])for(const closingOnly of [false,true])test('effective native response header change holds '+JSON.stringify({header,closingOnly}),async()=>{
 await assert.rejects(runWith((packet,{count})=>{if(packet.kind==='role'&&packet.url.includes('/'+target+'/')&&(!closingOnly||count===2))packet.headers[header]=value;return packet}),/effective headers\/full MIME/)
})

const cfPackets=fixture.packets.filter(packet=>new URL(packet.url).hostname==='cdnjs.cloudflare.com'&&packet.headers['report-to'])
test('only actual independently observed same-group Cloudflare NEL endpoint token rotation normalizes',()=>{
 assert.ok(cfPackets.length>=4)
 const first=cfPackets[0],second=cfPackets.find(packet=>packet.url===first.url&&packet.headers['report-to']!==first.headers['report-to']);assert.ok(second)
 assert.deepEqual(currentSociowashHeaders(first.headers,first.url),currentSociowashHeaders(second.headers,second.url))
})
for(const [label,change] of [
 ['foreign reporting origin',headers=>{const report=JSON.parse(headers['report-to']);report.endpoints[0].url=report.endpoints[0].url.replace('a.nel.cloudflare.com','example.invalid');headers['report-to']=JSON.stringify(report)}],
 ['foreign reporting path',headers=>{const report=JSON.parse(headers['report-to']);report.endpoints[0].url=report.endpoints[0].url.replace('/report/v4','/unreviewed');headers['report-to']=JSON.stringify(report)}],
 ['crossed report group',headers=>{const report=JSON.parse(headers['report-to']);report.group='foreign';headers['report-to']=JSON.stringify(report)}],
 ['unbound NEL group',headers=>{const nel=JSON.parse(headers.nel);nel.report_to='foreign';headers.nel=JSON.stringify(nel)}],
 ['changed NEL sampling',headers=>{const nel=JSON.parse(headers.nel);nel.success_fraction=1;headers.nel=JSON.stringify(nel)}],
 ['unknown reporting condition',headers=>{const report=JSON.parse(headers['report-to']);report.include_subdomains=true;headers['report-to']=JSON.stringify(report)}],
 ['duplicate decoded report keys',headers=>{headers['report-to']=headers['report-to'].replace('"group":"cf-nel"','"group":"foreign","gro\\u0075p":"cf-nel"')}],
 ['unquoted reporting JSON key',headers=>{headers['report-to']=headers['report-to'].replace('"group":','group:')}],
 ['malformed reporting JSON',headers=>{headers['report-to']+=','}],
 ['extra endpoint query',headers=>{const report=JSON.parse(headers['report-to']);report.endpoints[0].url+='&foreign=1';headers['report-to']=JSON.stringify(report)}]
])test('report-only anonymous token exception rejects '+label,()=>{const packet=cfPackets[0],headers={...packet.headers};change(headers);assert.throws(()=>currentSociowashHeaders(headers,packet.url))})

test('strict JSON rejects duplicate decoded names instead of accepting the final value',()=>{
 assert.throws(()=>strictSociowashJSON('{"code":"foreign","co\\u0064e":"success"}'),/duplicate decoded/)
})

for(const closingOnly of [false,true])test('public application metadata additions hold '+JSON.stringify({closingOnly}),async()=>{
 await assert.rejects(runWith((packet,{count})=>{if(packet.kind==='form'&&(!closingOnly||count===2)){const form=JSON.parse(packet.html);form.webforms[0].sections[0].fields.push({api_name:'Required_Qualification',field_label:marker,required:true});packet.html=JSON.stringify(form)}return packet}),/application fields\/conditions\/status/)
})
test('closing public application required-condition drift holds',async()=>{
 await assert.rejects(runWith((packet,{count})=>{if(packet.kind==='form'&&count===2){const form=JSON.parse(packet.html);form.webforms[0].sections[0].fields[0].required=false;packet.html=JSON.stringify(form)}return packet}),/application fields\/conditions\/status/)
})

for(const reason of ['opaque-caller-stop',Object.freeze({reason:'frozen-caller-stop'})]){
 test('pre-aborted caller reason identity is preserved: '+JSON.stringify(reason),async()=>{const controller=new AbortController();controller.abort(reason);let reads=0;await assert.rejects(run({...options,signal:controller.signal,fetchImpl:async()=>{reads++;throw Error('must not read')}}),error=>error===reason);assert.equal(reads,0)})
 test('in-flight caller reason identity is preserved: '+JSON.stringify(reason),async()=>{const controller=new AbortController();let reads=0;await assert.rejects(run({...options,signal:controller.signal,fetchImpl:async()=>{reads++;controller.abort(reason);throw reason}}),error=>error===reason);assert.equal(reads,1)})
}
test('a denial is retained once and does not provoke credential, retry or alternate transport changes',async()=>{
 let reads=0;await assert.rejects(run({...options,fetchImpl:async url=>{reads++;const response=new Response('Forbidden',{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:String(url)});return response}}));assert.equal(reads,1)
})
test('invalid UTF-8 native bytes hold before parsing',async()=>{
 await assert.rejects(runWith(packet=>{if(packet.kind==='corporate')packet.bytes=new Uint8Array([0xff,0xfe]);return packet}),/invalid UTF-8/)
})
test('bounded source deadline cancels a pending ordinary request',async()=>{
 let reads=0;await assert.rejects(run({...options,sourceTimeoutMs:5,fetchImpl:async(_url,init)=>{reads++;return new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}))}}),/source deadline exceeded/);assert.equal(reads,1)
})
test('streaming entity overflow cancels and releases the original reader',async()=>{
 const first=fixture.packets.find(packet=>packet.kind==='corporate');let canceled=0,released=0,reads=0
 await assert.rejects(run({...options,fetchImpl:async()=>({status:first.status,url:first.url,headers:new Headers(first.headers),body:{getReader(){return{async read(){reads++;return{done:false,value:new Uint8Array(4_000_001)}},async cancel(){canceled++},releaseLock(){released++}}}}})}),/byte cap/)
 assert.equal(reads,1);assert.ok(canceled>=1);assert.equal(released,1)
})
