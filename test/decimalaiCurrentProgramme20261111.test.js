import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCurrentDecimalProgramme,runCurrentDecimalProgramme} from '../scraper/decimalai/currentProgramme.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/decimalai-current-programme-20261111.json.gz',import.meta.url))))
const HOME='https://www.decimal.app/',LIST=HOME+'careers',roles=fixture.expected.roleURLs
const sha=value=>createHash('sha256').update(value).digest('hex'),now=()=>fixture.capturedAtLast
const text=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8')
const mutateModel=(html,type,change)=>html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,
 (all,open,raw,close)=>{const data=JSON.parse(raw);if(!Array.isArray(data)||!data.some(j=>j['@type']===type))return all
  return open+JSON.stringify(data.map(j=>j['@type']===type?change(j):j))+close})
const originalJob=[...text(fixture.responses.find(r=>r.requestedURL===roles[0])).matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
 .flatMap(m=>JSON.parse(m[1])).find(j=>j['@type']==='JobPosting')
const appendIndiaJob=html=>html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,
 (all,open,raw,close)=>open+JSON.stringify([...JSON.parse(raw),{...originalJob,title:'Additional India role',url:LIST+'/additional-india-role',
  jobLocation:{...originalJob.jobLocation,address:{...originalJob.jobLocation.address,addressCountry:'IN'}}}])+close)
function replay(change=h=>h,options={}){
 const groups=new Map(),seen=new Map(),calls=[],changed=[]
 for(const row of fixture.responses){const rows=groups.get(row.requestedURL)||[];rows.push(row);groups.set(row.requestedURL,rows)}
 const readPage=async url=>{
  const occurrence=seen.get(url)||0;seen.set(url,occurrence+1);calls.push(url)
  const packet=groups.get(url)?.[occurrence];assert.ok(packet,'Only exact actual captured responses: '+url+' phase'+occurrence)
  const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(sha(bytes),packet.bodySHA256)
  const original=bytes.toString('utf8'),html=change(original,{url,occurrence,calls,packet})
  if(html!==original)changed.push({url,occurrence})
  return {url:packet.finalURL,status:packet.status,html,headers:{'content-type':packet.contentType}}
 }
 return {calls,changed,run:()=>readCurrentDecimalProgramme({readPage,now,...options})}
}
const removeCard=(h,url)=>h.replace(/<a\b[^>]*\bhref="\/careers\/[^"?#]+"[^>]*>[\s\S]*?<\/a>/g,card=>card.includes(new URL(url).pathname)?'':card)

test('ten actual packets prove the finite three-role US programme, with full visible criteria separate from introductory schemas',async()=>{
 const r=replay(),jobs=await r.run(),e=readInventoryEvidence(jobs),a=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(r.calls.length,10)
 assert.equal(e.status,'complete-inventory');assert.equal(e.reportedTotal,3);assert.equal(e.indiaFacetCount,0)
 assert.equal(e.listingComplete,true);assert.equal(e.lifecycleCleanupAllowed,false)
 assert.equal(a.currentDeclaredSourceProgramComplete,true);assert.equal(a.companyGlobalScopeQualified,false)
 assert.equal(a.sourceScopeComplete,false);assert.equal(a.lifecycleCleanupAllowed,false)
 assert.equal(a.companyGlobalTotal,null);assert.equal(a.companyIndiaTotal,null);assert.equal(a.observedRecordCount,3)
 assert.equal(readSourceObservationEvidence(jobs,'decimalai').observedVacancyCount,3)
 assert.equal(a.publisherOrganization.legalName,'Decimal AI');assert.equal(a.publisherOrganization.alternateName,'Decimal AI')
 assert.equal(a.publisherLegalNameRegistryVerified,false);assert.equal(a.applicationVisited,false);assert.equal(a.screeningCriteriaAcquired,false)
 assert.equal(a.roles.length,3)
 for(const role of a.roles){
  assert.equal(role.country,'United States');assert.equal(role.nativeEmployer.name,'Decimal AI')
  assert.equal(role.schemaDescriptionIsIntroOnly,true);assert.equal(role.schemaIntroductionVisibleMatch,true)
  assert.equal(role.schemaFullDescriptionMatch,false);assert.ok(role.publishedRequirements.length>=1)
  assert.ok(role.fullPublishedRoleText.includes(role.publishedRequirements[0]));assert.ok(!role.nativeSchemaDescription.includes(role.publishedRequirements[0]))
  assert.ok(role.originalOwnRoleHTML.includes('Requirements'));assert.equal(role.nativeDatePosted,'2026-07-28')
  assert.equal(role.firstEverPostedAt,null);assert.equal(role.applicationDeadline,null);assert.equal(role.remoteStatus,null)
  assert.equal(role.applicationVisited,false);assert.equal(role.screeningCriteriaAcquired,false)
  assert.ok(r.calls.lastIndexOf(role.url)>Math.max(...roles.map(url=>r.calls.indexOf(url))))
 }
 assert.ok(a.allOpeningRolesBeforeClosingRoles&&a.allOwnRolesRechecked&&a.currentCorporateHandoffRechecked)
})

const scenarios=[
 ...[HOME,LIST].map(url=>['additional active India JobPosting on '+(url===HOME?'publisher':'listing'),(h,c)=>c.url===url?appendIndiaJob(h):h,/JSON|model|programme|scope/]),
 ...[HOME,LIST].map(url=>['unreviewed query role declaration on '+(url===HOME?'publisher':'listing'),(h,c)=>c.url===url?
  h.replace('</main>','<a href="/careers/additional-india-role?country=IN">India Engineering</a></main>'):h,/programme|scope|role/]),
 ['careers hostname with opaque label',(h,c)=>c.url===HOME?h.replace('</main>','<a href="https://careers.decimal.app/">Engineering</a></main>'):h,/programme|scope|handoff/],
 ['jobs hostname with opaque label',(h,c)=>c.url===HOME?h.replace('</main>','<a href="https://jobs.decimal.app/">Engineering</a></main>'):h,/programme|scope|handoff/],
 ['unreviewed first-party jobs programme',(h,c)=>c.url===HOME?h.replace('</main>','<a href="/jobs">Engineering</a></main>'):h,/programme|scope|handoff/],
 ...['?country=IN','#india'].map(suffix=>['unreviewed existing role URL variant '+suffix,(h,c)=>c.url===LIST?
  h.replace('</main>','<a href="'+new URL(roles[0]).pathname+suffix+'">Engineering</a></main>'):h,/programme|scope|role/]),
 ['unreviewed listing fragment declaration',(h,c)=>c.url===LIST?h.replace('href="#open-roles"','href="#india"'):h,/programme|scope|handoff/],
 ['additional visible card country text',(h,c)=>c.url===LIST?h.replace(new RegExp('(<a\\b[^>]*href="'+new URL(roles[0]).pathname+'"[^>]*>)([\\s\\S]*?)(<\\/a>)'),
  '$1$2<span>Remote - India</span>$3'):h,/card|location|criteria|scope/],
 ['unsupported object embedding model',(h,c)=>c.url===LIST?h.replace('</main>','<object type="text/html" data="/careers?country=IN"></object></main>'):h,/embedded|embedding|programme|scope/],
 ['unsupported embed model',(h,c)=>c.url===HOME?h.replace('</main>','<embed type="text/html" src="/careers?country=IN"></main>'):h,/embedded|embedding|programme|scope/],
 ['srcdoc override on exact product media',(h,c)=>c.url===HOME?h.replace('<iframe','<iframe srcdoc="&lt;h1&gt;India engineering openings&lt;/h1&gt;"'):h,/embedded|programme|scope/],
 ['empty srcdoc override on exact product media',(h,c)=>c.url===HOME?h.replace('<iframe','<iframe srcdoc=""'):h,/embedded|programme|scope/],
 ['counter/card mismatch',(h,c)=>c.url===LIST?h.replace('>3<!-- --> open <!-- -->roles','>4<!-- --> open <!-- -->roles'):h,/count|inventory|card/],
 ['extra unlinked role card',(h,c)=>c.url===LIST?h.replace('class="LRsLgq_rowList _3sEuiq_roleList _3sEuiq_reveal">','class="LRsLgq_rowList _3sEuiq_roleList _3sEuiq_reveal"><div>India role</div>'):h,/card|inventory|row/],
 ['extra linked own role',(h,c)=>c.url===LIST?h.replace('</main>','<a href="/careers/another-role">Additional role</a></main>'):h,/role|inventory|card/],
 ['unknown filter control',(h,c)=>c.url===LIST?h.replace('</main>','<input hidden name="country" value="US"></main>'):h,/filter|control|scope/],
 ['pagination declaration',(h,c)=>c.url===LIST?h.replace('</head>','<link rel="next" href="/careers?page=2"></head>'):h,/pagin|scope|page/],
 ['duplicate open-roles shadow',(h,c)=>c.url===LIST?h.replace('</body>','<template><section id="open-roles"></section></template></body>'):h,/unique|duplicate|inventory/],
 ['CSS-hidden role inventory',(h,c)=>c.url===LIST?h.replace('</head>','<style>#open-roles{display:none!important}</style></head>'):h,/visible|inventory|role/],
 ['new declared corporate programme',(h,c)=>c.url===HOME?h.replace('</body>','<a href="https://boards.greenhouse.io/other-employer">India engineering openings</a></body>'):h,/programme|scope|handoff/],
 ['new declared native programme',(h,c)=>c.url===LIST?h.replace('</main>','<a href="https://jobs.lever.co/other-employer">Explore</a></main>'):h,/programme|scope|handoff/],
 ['lost corporate handoff',(h,c)=>c.url===HOME?h.replaceAll('href="/careers"','href="/contact"'):h,/handoff|careers|programme/],
 ['hidden document base',(h,c)=>c.url===LIST?h.replace('</head>','<base hidden href="https://other.example/"></head>'):h,/base|scope/],
 ['foreign canonical role URL',(h,c)=>c.url===roles[0]?h.replace('rel="canonical" href="'+roles[0]+'"','rel="canonical" href="https://other.example/role"'):h,/canonical|URL|identity/],
 ['foreign open-graph role URL',(h,c)=>c.url===roles[0]?h.replace('property="og:url" content="'+roles[0]+'"','property="og:url" content="https://other.example/role"'):h,/URL|identity/],
 ['changed product media to a native board',(h,c)=>c.url===HOME?h.replace('https://www.youtube-nocookie.com/embed/WgdwXi28CIw?autoplay=0&amp;mute=0&amp;controls=1&amp;playsinline=1','https://jobs.lever.co/other-employer'):h,/embedded|programme|scope/],
 ['new unreviewed embedded programme',(h,c)=>c.url===LIST?h.replace('</main>','<iframe src="https://jobs.lever.co/other-employer"></iframe></main>'):h,/embedded|programme|scope/],
 ['foreign published organization',(h,c)=>c.url===HOME?mutateModel(h,'Organization',j=>({...j,legalName:'Other Employer'})):h,/organization|publisher|identity/],
 ['foreign role employer',(h,c)=>c.url===roles[0]?mutateModel(h,'JobPosting',j=>({...j,hiringOrganization:{...j.hiringOrganization,name:'Other Employer'}})):h,/employer|identity/],
 ['wrong native role URL',(h,c)=>c.url===roles[0]?mutateModel(h,'JobPosting',j=>({...j,url:roles[1]})):h,/URL|identity/],
 ['native India country',(h,c)=>c.url===roles[0]?mutateModel(h,'JobPosting',j=>({...j,jobLocation:{...j.jobLocation,address:{...j.jobLocation.address,addressCountry:'IN'}}})):h,/India|country/],
 ['unknown country',(h,c)=>c.url===roles[0]?mutateModel(h,'JobPosting',j=>({...j,jobLocation:{...j.jobLocation,address:{...j.jobLocation.address,addressCountry:'ZZ'}}})):h,/country/],
 ['contradictory typed country model',(h,c)=>c.url===roles[0]?mutateModel(h,'JobPosting',j=>({...j,jobLocation:{...j.jobLocation,address:{...j.jobLocation.address,addressCountry:{name:'US',identifier:'IN'}}}})):h,/country|model/],
 ['additional native location',(h,c)=>c.url===roles[0]?mutateModel(h,'JobPosting',j=>({...j,jobLocation:[j.jobLocation,{...j.jobLocation,address:{...j.jobLocation.address,addressCountry:'IN'}}]})):h,/location|country|model/],
 ['written India region contradiction',(h,c)=>c.url===roles[0]?mutateModel(h,'JobPosting',j=>({...j,jobLocation:{...j.jobLocation,address:{...j.jobLocation.address,addressRegion:'CA / India'}}})):h,/country/],
 ['unknown nested country scope',(h,c)=>c.url===roles[0]?mutateModel(h,'JobPosting',j=>({...j,jobLocation:{...j.jobLocation,address:{...j.jobLocation.address,addressRegion:{country:'IN'}}}})):h,/country|model/],
 ['new applicant-country model',(h,c)=>c.url===roles[0]?mutateModel(h,'JobPosting',j=>({...j,applicantLocationRequirements:{name:'India'}})):h,/country|model|field/],
 ['new visible India applicant scope',(h,c)=>c.url===roles[0]?h.replace('Requirements</h2>','Requirements</h2><p>Applicants located in India are welcome.</p>'):h,/India|scope|model|criteria/],
 ['schema introductory criterion drift',(h,c)=>c.url===roles[0]?mutateModel(h,'JobPosting',j=>({...j,description:j.description.replace('top of our funnel','top + of our funnel')})):h,/intro|criteria|description/],
 ['hidden published requirement',(h,c)=>c.url===roles[0]?h.replace('<li>1–3 years','<li hidden>1–3 years'):h,/visible|criteria|requirement/],
 ['CSS-hidden full prose',(h,c)=>c.url===roles[0]?h.replace('</head>','<style>.GKRuyq_prose{display:none!important}</style></head>'):h,/visible|criteria|prose/],
 ['unknown primary criterion section',(h,c)=>c.url===roles[0]?h.replace('Requirements</h2>','Additional conditions</h2>'):h,/section|criteria|Requirements/],
 ['empty source attribute on JobPosting carrier',(h,c)=>c.url===roles[0]?h.replace(/(<script\b[^>]*type="application\/ld\+json")/g,'$1 src=""'):h,/active|carrier|source|JSON/],
 ...['template','object','svg','math'].map(tag=>['unqualified '+tag+' JobPosting carrier',(h,c)=>c.url===roles[0]?h.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,
  (all,open,raw)=>JSON.parse(raw).some(j=>j['@type']==='JobPosting')?'<'+tag+'>'+all+'</'+tag+'>':all):h,/active|carrier|JSON|identity|embedding/]),
 ['duplicate raw JSON key',(h,c)=>c.url===roles[0]?h.replace('"addressCountry":"US"','"addressCountry":"US","addressCountry":"US"'):h,/duplicate|JSON/],
 ['invalid native calendar',(h,c)=>c.url===roles[0]?mutateModel(h,'JobPosting',j=>({...j,datePosted:'2026-02-30'})):h,/calendar|date/],
 ['future native date',(h,c)=>c.url===roles[0]?mutateModel(h,'JobPosting',j=>({...j,datePosted:'2027-07-28'})):h,/date|future/],
 ['closing full requirement drift',(h,c)=>c.url===roles[0]&&c.occurrence===1?h.replace('1–3 years','1–4 years'):h,/closing|changed/],
 ['closing whole-role drift',(h,c)=>c.url===roles[0]&&c.occurrence===1?h+'<!-- changed unrelated original role byte -->':h,/closing|changed/],
 ['closing listing drift',(h,c)=>c.url===LIST&&c.occurrence===1?h+'<!-- changed original listing -->':h,/closing|changed/],
 ['closing corporate drift',(h,c)=>c.url===HOME&&c.occurrence===1?h+'<!-- changed original corporate -->':h,/closing|changed/],
]
for(const [name,change,pattern]of scenarios)test('withholds programme zero for '+name,async()=>{
 const r=replay(change)
 await assert.rejects(r.run(),e=>e.failureKind==='coverage_gap'&&pattern.test(e.message))
 assert.ok(r.changed.length>0,'Must mutate an acquired original packet')
})

test('full visible requirements remain authoritative data when the introductory schema does not describe them',async()=>{
 const r=replay((h,c)=>c.url===roles[0]?h.replace('1–3 years','1–4 years'):h),jobs=await r.run(),role=jobs.nativeCollectionEvidence.roles[0]
 assert.match(role.publishedRequirements[0],/1–4 years/);assert.match(role.fullPublishedRoleText,/1–4 years/)
 assert.ok(!role.nativeSchemaDescription.includes('1–4 years'));assert.equal(role.schemaDescriptionIsIntroOnly,true)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,3)
})
test('a dynamic two-role programme requires every remaining role and all closings, never a frozen native count',async()=>{
 const r=replay((h,c)=>c.url===LIST?removeCard(h,roles[2]).replace('>3<!-- --> open <!-- -->roles','>2<!-- --> open <!-- -->roles'):h,{maxRequests:8,maxDetails:2})
 const jobs=await r.run();assert.equal(r.calls.length,8);assert.equal(readInventoryEvidence(jobs).reportedTotal,2)
 assert.equal(jobs.nativeCollectionEvidence.roles.length,2);assert.ok(!r.calls.includes(roles[2]))
})
test('an earlier role closes only after all selected role openings, catching later-acquisition drift',async()=>{
 let later=false,checked=false
 const r=replay((h,c)=>{
  if(c.url===roles[1]&&c.occurrence===0)later=true
  if(c.url===roles[0]&&c.occurrence===1){checked=later;if(later)return h+'<!-- newer first role after later acquisition -->'}
  return h
 })
 await assert.rejects(r.run(),/closing|changed/);assert.equal(checked,true)
})
test('the complete closing transaction and every declared detail must fit before acquisition',async()=>{
 for(const options of [{maxRequests:9},{maxDetails:2},{maxPages:1}]){
  const r=replay(undefined,options)
  await assert.rejects(r.run(),e=>e.failureKind==='coverage_gap'&&/budget|bound|detail|page/i.test(e.message))
  assert.ok(r.calls.length<=2)
 }
})
test('bounded transport replays only original exact GET bodies and preserves original URL identity',async()=>{
 const seen=new Map(),calls=[]
 const jobs=await runCurrentDecimalProgramme({now,requestIntervalMs:0,fetchImpl:async(url,init)=>{
  calls.push(init);const occurrence=seen.get(url)||0;seen.set(url,occurrence+1)
  const row=fixture.responses.filter(r=>r.requestedURL===url)[occurrence];assert.ok(row)
  const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:{'content-type':row.contentType}})
  Object.defineProperty(response,'url',{value:row.finalURL});return response
 }})
 assert.equal(calls.length,10);assert.ok(calls.every(c=>c.method==='GET'&&c.cache==='no-store'&&c.credentials==='omit'&&c.redirect==='manual'))
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 await assert.rejects(runCurrentDecimalProgramme({now,requestIntervalMs:0,fetchPage:async()=>({status:200,html:'',headers:{'content-type':'text/html'}})}),e=>e.failureKind==='coverage_gap'&&/URL|provenance|identity/.test(e.message))
})
test('denial, deadline and caller cancellation remain failures with no zero release',async()=>{
 for(const status of [401,403,429,451])await assert.rejects(runCurrentDecimalProgramme({requestIntervalMs:0,fetchImpl:async url=>{
  const response=new Response('Denied',{status});Object.defineProperty(response,'url',{value:url});return response
 }}),e=>e.failureKind==='blocked_or_access_denied'&&e.status===status)
 const c=new AbortController(),reason=Error('original cancellation');c.abort(reason)
 await assert.rejects(runCurrentDecimalProgramme({signal:c.signal,fetchImpl:()=>assert.fail('No read after abort')}),e=>e===reason)
 await assert.rejects(runCurrentDecimalProgramme({requestTimeoutMs:10,requestIntervalMs:0,fetchImpl:()=>new Promise(()=>{})}),e=>e.name==='TimeoutError')
})
