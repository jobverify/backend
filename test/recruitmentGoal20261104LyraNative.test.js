import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from '../scraper/lyrahealth/script.js'
import {readNativeDocument} from '../scraper-support/utils/activeNativeHtml.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/lyrahealth-native-quality.json.gz',import.meta.url))))
const API='https://api.lever.co/v0/postings/lyrahealth',HOST='https://jobs.lever.co/lyrahealth/'
const nativeRows=fixture.packets.filter(p=>p.requestedURL.startsWith(API)).flatMap(p=>JSON.parse(p.bodyText))
const india=nativeRows.filter(r=>r.country==='IN'),target=india[0].id
const now=()=> '2026-11-05T08:05:00.000Z'
const editRows=(packet,edit)=>{const rows=JSON.parse(packet.bodyText);rows.forEach(edit);packet.bodyText=JSON.stringify(rows)}
const editSchema=(packet,edit)=>{
 const d=readNativeDocument(packet.bodyText),nodes=d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')
 assert.equal(nodes.length,1)
 const schema=JSON.parse(nodes[0].raw);edit(schema);packet.bodyText=packet.bodyText.replace(nodes[0].raw,JSON.stringify(schema))
}
const replay=async(t,edit=()=>{},options={})=>{
 const calls=[],fetchImpl=async(url,init={})=>{
  const found=fixture.packets.find(p=>p.requestedURL===String(url))
  assert.ok(found,'Uncaptured Lyra native URL: '+url)
  assert.equal(createHash('sha256').update(found.bodyText).digest('hex'),found.bodySHA256)
  const p=structuredClone(found),occurrence=calls.filter(c=>c.url===String(url)).length
  edit(p,calls,occurrence)
  if(p.bodyText!==found.bodyText&&!p.headers?.['content-encoding']&&p.headers?.['content-length'])p.headers['content-length']=String(Buffer.byteLength(p.bodyText))
  calls.push({url:String(url),method:init.method||'GET',status:p.status,occurrence})
  assert.equal(init.method||'GET','GET')
  const response=new Response(p.bodyText,{status:p.status,headers:p.headers||{'content-type':p.contentType}})
  Object.defineProperty(response,'url',{value:p.finalURL})
  return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 let jobs,error
 try{jobs=await source.run({fetchImpl,minIntervalMs:0,requestIntervalMs:0,now,...options})}catch(e){error=e}
 return {jobs,error,calls}
}

test('Lyra reads ten bounded small pages and closes every full own India model, including lists-only descriptions',async t=>{
 assert.equal(nativeRows.length,482);assert.equal(india.length,7)
 const {jobs,error,calls}=await replay(t)
 assert.ifError(error);assert.equal(jobs.length,7)
 assert.deepEqual(jobs.map(j=>j.jobId).sort(),india.map(r=>r.id).sort())
 assert.deepEqual(calls.filter(c=>c.url.startsWith(API)).map(c=>Number(new URL(c.url).searchParams.get('skip'))),[0,50,100,150,200,250,300,350,400,450,0,50,100,150,200,250,300,350,400,450])
 assert.ok(calls.every(c=>!c.url.endsWith('/apply')))
 for(const job of jobs){
  const row=nativeRows.find(r=>r.id===job.jobId)
  assert.deepEqual(job.nativeSourceRecord.posting,row)
  assert.equal(job.nativeSourceRecord.jobPosting.hiringOrganization.name,'Lyra Health')
  assert.equal(job.country,'India');assert.ok(job.jobDescription.length>1000)
  assert.equal(job.postingDate,job.nativeSourceRecord.jobPosting.datePosted)
  assert.equal(job.sourceDatePrecision,'day');assert.equal(job.requisitionId,null);assert.equal(job.firstEverPublication,null)
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.nativeRoleClosingReconciled,true)
  assert.equal(job.sourceListingComplete,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.applicationVisited,false);assert.equal(job.nativeSourceRecord.posting.createdAt,row.createdAt)
  assert.equal(job.remoteStatus,({onsite:'On-site',remote:'Remote',hybrid:'Hybrid'})[row.workplaceType])
 }
 const intake=jobs.find(j=>j.jobId==='0c4e320a-afda-4355-b56a-d4ba6fa9d35e')
 assert.equal(intake.nativeSourceRecord.posting.description,'')
 assert.match(intake.jobDescription,/Clinical Intake & Triage/)
 assert.match(intake.jobDescription,/Qualification/)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Lyra preserves its publisher and explicitly named contracting party separately',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.equal(jobs.length,7)
 const affiliates=jobs.filter(j=>/You will be contracted by Lyra Clinical Associates/.test(j.jobDescription))
 assert.equal(affiliates.length,4)
 assert.ok(affiliates.every(j=>j.company==='Lyra Health'&&j.legalEmployer==='Lyra Clinical Associates'&&j.employmentType==='Contract'))
 assert.ok(jobs.filter(j=>!affiliates.includes(j)).every(j=>j.legalEmployer===null))
 assert.ok(jobs.filter(j=>j.nativeSourceRecord.posting.categories.location==='India').every(j=>j.city===null))
 const junior=jobs.find(j=>j.jobId==='d46f0095-045d-4d2a-8bb0-e75664eeb590')
 assert.match(junior.jobDescription,/Lyra Health’s mental health/)
 assert.match(junior.jobDescription,/globaldpo@lyrahealth\.com/)
 assert.match(junior.jobDescription,/artificial intelligence/)
})

test('Lyra applies a positive result cap only after full native closing reconciliation',async t=>{
 const {jobs,error,calls}=await replay(t,()=>{},{maxJobs:1});assert.ifError(error)
 assert.equal(jobs.length,1);assert.equal(jobs[0].nativeRoleClosingReconciled,true)
 assert.equal(calls.filter(c=>c.url.startsWith(API)).length,20)
 assert.equal(calls.filter(c=>c.url.startsWith(HOST)).length,14)
})

test('Lyra zero cap and pre-cancellation settle without public requests',async t=>{
 let r=await replay(t,()=>{},{maxJobs:0});assert.ifError(r.error);assert.equal(r.jobs.length,0);assert.equal(r.calls.length,0)
 const controller=new AbortController(),reason=Error('Stop Lyra now');controller.abort(reason)
 r=await replay(t,()=>{},{signal:controller.signal});assert.equal(r.error,reason);assert.equal(r.calls.length,0)
})

for(const country of [null,'US'])test('Lyra cannot turn own country '+country+' into India from a city or provider default',async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL.startsWith(API))editRows(p,row=>{if(row.id===target)row.country=country})})
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target))
})

for(const change of ['employer','country','contracting entity','preview'])test('Lyra holds the affected own role for changed '+change,async t=>{
 const {jobs,error}=await replay(t,p=>{
  if(p.requestedURL===HOST+target)editSchema(p,s=>{
   if(change==='employer')s.hiringOrganization.name='Other company'
   if(change==='country')s.jobLocation.address.addressCountry='US'
   if(change==='preview')s.description='<p>Preview only</p>'
  })
  if(change==='contracting entity'){
   if(p.requestedURL.startsWith(API))editRows(p,r=>{if(r.id===target)for(const k of ['description','descriptionPlain','opening','openingPlain'])r[k]=r[k].replaceAll('Lyra Clinical Associates','Other company')})
   if(p.requestedURL===HOST+target)p.bodyText=p.bodyText.replaceAll('Lyra Clinical Associates','Other company')
  }
 })
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target))
})

for(const attribute of ['hidden','aria-hidden=true','style="visibility: collapse"','style="display: /* pending */ none"','style="opacity: .0"'])test('Lyra refuses unreviewed criteria visibility: '+attribute,async t=>{
 const addition='<p '+attribute+'>Sentinel mandatory qualification</p>'
 const {jobs,error}=await replay(t,p=>{
  if(p.requestedURL.startsWith(API))editRows(p,r=>{if(r.id===target){r.description+=addition;r.opening+=addition}})
  if(p.requestedURL===HOST+target){
   editSchema(p,s=>{s.description+=addition})
   p.bodyText=p.bodyText.replace(/(<div[^>]*data-qa="job-description"[^>]*>)/,'$1'+addition)
  }
 })
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target))
})

test('Lyra preserves a changed native creation clock without using it as a publication date',async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL.startsWith(API))editRows(p,r=>{if(r.id===target)r.createdAt=Date.parse('2026-11-01T00:00:00Z')})})
 assert.ifError(error);assert.equal(jobs.length,7)
 const job=jobs.find(j=>j.jobId===target);assert.equal(job.postingDate,'2026-09-29');assert.equal(job.nativeSourceRecord.posting.createdAt,Date.parse('2026-11-01T00:00:00Z'))
})

test('Lyra holds an untyped additional workplace rather than assigning its primary country',async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL.startsWith(API))editRows(p,r=>{if(r.id===target)r.categories.allLocations.push('Portland, United States')})})
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target))
})

test('Lyra withholds a full own model changed in its closing API snapshot',async t=>{
 const {jobs,error}=await replay(t,(p,_,occurrence)=>{if(occurrence&&p.requestedURL.startsWith(API))editRows(p,r=>{if(r.id===target)r.lists[0].content+='<li>New required skill</li>'})})
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target))
})

for(const status of [202,401,403,429,451])test('Lyra stops every further source read after closing HTTP '+status,async t=>{
 const {jobs,error,calls}=await replay(t,(p,_,occurrence)=>{if(occurrence&&p.requestedURL.startsWith(API))p.status=status})
 assert.ifError(error);assert.equal(jobs.length,7);assert.equal(calls.at(-1).status,status)
 assert.ok(jobs.every(j=>!j.sourceDetailComplete&&!j.nativeRoleClosingReconciled&&!j.sourceScopeComplete&&!j.lifecycleCleanupAllowed))
})

test('Lyra keeps prior complete native facts when a later opening role is denied',async t=>{
 const second=india[1].hostedUrl
 const {jobs,error,calls}=await replay(t,p=>{if(p.requestedURL===second)p.status=403})
 assert.ifError(error);assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,target)
 assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(calls.at(-1).url,second)
})

test('Lyra cannot resurrect known changed models after a subsequent closing client failure',async t=>{
 const {jobs,error,calls}=await replay(t,(p,calls,occurrence)=>{
  if(occurrence&&p.requestedURL.startsWith(API))editRows(p,r=>{if(r.country==='IN')r.lists[0].content+='<li>Known changed qualification</li>'})
  if(p.requestedURL==='https://careers.lyrahealth.com/'&&calls.some(c=>c.url===p.requestedURL))p.status=403
 })
 assert.ok(error);assert.equal(jobs,undefined);assert.ok(calls.every(c=>c.url!==HOST+target||c.occurrence===0))
})

test('Lyra preserves exact caller cancellation with a noncooperative transport',async()=>{
 const controller=new AbortController(),reason=Error('Cancel pending Lyra transport')
 const pending=source.run({fetchImpl:()=>new Promise(()=>{}),minIntervalMs:0,signal:controller.signal})
 controller.abort(reason);await assert.rejects(pending,error=>error===reason)
})

test('Lyra rejects a false uncompressed Content-Length and stops before using the page',async t=>{
 const {jobs,error,calls}=await replay(t,p=>{if(p.requestedURL.startsWith(API))p.headers['content-length']='1'})
 assert.equal(jobs,undefined);assert.match(error.message,/length mismatch/)
 assert.equal(calls.filter(c=>c.url.startsWith(API)).length,1)
})

test('Lyra immediately excludes a changed model from a partial closing feed before a later denial',async t=>{
 const {jobs,error,calls}=await replay(t,(p,_,occurrence)=>{
  if(occurrence&&p.requestedURL===API+'?mode=json&skip=0&limit=50')editRows(p,r=>{if(r.id===target)r.lists[0].content+='<li>Changed mandatory skill</li>'})
  if(occurrence&&p.requestedURL===API+'?mode=json&skip=50&limit=50')p.status=403
 })
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target))
 assert.equal(calls.at(-1).status,403);assert.ok(jobs.every(j=>!j.nativeRoleClosingReconciled&&!j.sourceDetailComplete))
})

for(const [name,container]of [['wrapper','section-wrapper page-full-width'],['ancestor','content']])for(const style of ['opacity:0','font-size:0px'])test('Lyra holds hidden criteria '+name+' with '+style,async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===HOST+target)p.bodyText=p.bodyText.replace('<div class="'+container+'">','<div class="'+container+'" style="'+style+'">')})
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target))
})

test('Lyra holds additional criteria outside its expected role container',async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===HOST+target)p.bodyText=p.bodyText.replace('<div class="section-wrapper page-full-width">','<div data-qa="additional-criteria">Sentinel mandatory certification</div><div class="section-wrapper page-full-width">')})
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target))
})

for(const style of ['opacity:0','display:none','font-size:0px'])test('Lyra holds a changed stylesheet that can hide native role criteria: '+style,async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===HOST+target)p.bodyText=p.bodyText.replace('</head>','<style>.content{'+style+'}</style></head>')})
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target))
})

test('Lyra matches the visible worksite with the own API and schema worksite',async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===HOST+target)p.bodyText=p.bodyText.replace(/(<div[^>]*class="[^"]*\blocation\b[^"]*"[^>]*>)Bhubaneswar(<\/div>)/,'$1Portland, United States$2')})
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target))
})

for(const field of ['qualifications','conflicting legal employer'])test('Lyra holds an unreviewed own JobPosting '+field,async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===HOST+target)editSchema(p,s=>{
  if(field==='qualifications')s.qualifications='Sentinel mandatory certification'
  else s.hiringOrganization.legalName='Other company'
 })})
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target))
})

test('Lyra caller cancellation settles even if response stream cleanup never settles',async()=>{
 const controller=new AbortController(),reason=Error('Cancel stalled native stream cleanup')
 let release,cancelled=0
 const response=new Response(new ReadableStream({cancel(){cancelled++;return new Promise(resolve=>{release=resolve})}}),{headers:{'content-type':'text/html'}})
 Object.defineProperty(response,'url',{value:'https://careers.lyrahealth.com/'})
 const pending=source.run({fetchImpl:async()=>response,minIntervalMs:0,signal:controller.signal})
 await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
 const result=await Promise.race([pending.then(value=>({value}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timedOut:true}),250))])
 release?.();await pending.catch(()=>{})
 assert.equal(result.error,reason);assert.equal(cancelled,1)
})

test('Lyra scans an entire parsed closing page for contradictions before validating earlier malformed rows',async t=>{
 const {jobs,error}=await replay(t,(p,_,occurrence)=>{
  if(occurrence&&p.requestedURL===API+'?mode=json&skip=0&limit=50'){
   const rows=JSON.parse(p.bodyText);rows[0].hostedUrl='https://example.invalid/unreviewed'
   rows.find(r=>r.id===target).lists[0].content+='<li>Already observed changed qualification</li>'
   p.bodyText=JSON.stringify(rows)
  }
 })
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target&&!j.sourceDetailComplete))
})

for(const container of ['section-wrapper accent-section page-full-width','posting-categories'])test('Lyra accounts for all header content inside '+container,async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===HOST+target)p.bodyText=p.bodyText.replace('<div class="'+container+'">','<div class="'+container+'"><div data-qa="additional-criteria">Sentinel mandatory certification</div>')})
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target))
})

for(const [before,after]of [['Contract /','Full-time /'],['International Provider Jobs – International Provider Jobs /','Other Department /'],['On-site','Remote']])test('Lyra reconciles the complete visible header metadata: '+before,async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===HOST+target)p.bodyText=p.bodyText.replace('>'+before+'<','>'+after+'<')})
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target))
})

for(const position of ['outer posting page','hidden outer posting page','body','footer'])test('Lyra accounts for criteria inserted into '+position,async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===HOST+target){
  const extra='<div data-qa="additional-criteria"'+(position.startsWith('hidden')?' hidden':'')+'>Sentinel mandatory certification</div>'
  if(position.includes('posting page'))p.bodyText=p.bodyText.replace('<div class="content-wrapper posting-page">','<div class="content-wrapper posting-page">'+extra)
  else if(position==='body')p.bodyText=p.bodyText.replace('<body class="show header-compact">','<body class="show header-compact">'+extra)
  else p.bodyText=p.bodyText.replace('</body>',extra+'</body>')
 }})
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target))
})

for(const position of ['body','footer'])test('Lyra holds hidden unmodeled criteria in '+position,async t=>{
 const {jobs,error}=await replay(t,p=>{if(p.requestedURL===HOST+target){
  const extra='<div data-qa="additional-criteria" '+(position==='body'?'hidden':'aria-hidden="true"')+'>Sentinel mandatory certification</div>'
  p.bodyText=position==='body'?p.bodyText.replace('<body class="show header-compact">','<body class="show header-compact">'+extra):p.bodyText.replace('</body>',extra+'</body>')
 }})
 assert.ifError(error);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobId!==target))
})
