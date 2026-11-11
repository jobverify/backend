import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCurrentBreatheTeamtailor,runCurrentBreatheTeamtailor} from '../scraper/breathehr/currentTeamtailor.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/breathehr-teamtailor-current-20261111.json.gz',import.meta.url))))
const sha=s=>createHash('sha256').update(s).digest('hex')
const CORP='https://www.breathehr.com/',CANON=CORP+'en-gb/',HOME='https://careers.breathehr.com/',LIST=HOME+'jobs'
const roles=fixture.responses.filter(r=>r.requestedURL.startsWith(LIST+'/')).slice(0,5).map(r=>r.requestedURL)
const now=()=> '2026-11-11T08:00:00.000Z'
const body=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8')
const mutatePosting=(html,change)=>html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(all,open,raw,close)=>{
 const v=JSON.parse(raw);return v['@type']==='JobPosting'?open+JSON.stringify(change(v))+close:all
})
const wrapPosting=(html,tag)=>html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(all,open,raw,close)=>{
 const v=JSON.parse(raw);return v['@type']==='JobPosting'?'<'+tag+'>'+all+'</'+tag+'>':all
})
const removeCard=(html,url)=>html.replace(/(<ul\b[^>]*\bid="jobs_list_container"[^>]*>)([\s\S]*?)(<\/ul>)/,
 (all,open,inner,close)=>open+inner.replace(/<li\b[^>]*>[\s\S]*?<\/li>/g,card=>card.includes(url)?'':card)+close)
function replay(change=(html)=>html,options={}){
 const groups=new Map(),calls=[],seen=new Map(),changed=[]
 for(const r of fixture.responses){if(!groups.has(r.requestedURL))groups.set(r.requestedURL,[]);groups.get(r.requestedURL).push(r)}
 const readPage=async url=>{
  calls.push(url);const occurrence=seen.get(url)||0;seen.set(url,occurrence+1)
  const r=groups.get(url)?.[occurrence]
  assert.ok(r,'Every read must have an actual captured packet: '+url+' phase '+occurrence)
  const original=body(r);assert.equal(sha(Buffer.from(r.bodyBase64,'base64')),r.bodySHA256)
  const html=change(original,{url,occurrence,calls,seen,packet:r})
  if(html!==original)changed.push({url,occurrence})
  return {url:r.finalURL,status:r.status,html,headers:{...(r.contentType?{'content-type':r.contentType}:{}),...(r.location?{location:r.location}:{})}}
 }
 return {calls,changed,run:()=>readCurrentBreatheTeamtailor({readPage,now,...options})}
}

test('actual eighteen packets prove five native GB roles in the current Breathe programme, never an empty board or global scope',async()=>{
 const r=replay(),jobs=await r.run(),e=readInventoryEvidence(jobs),a=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(r.calls.length,18)
 assert.equal(e.status,'complete-inventory');assert.equal(e.reportedTotal,5);assert.equal(e.indiaFacetCount,0);assert.equal(e.listingComplete,true)
 assert.equal(e.lifecycleCleanupAllowed,false)
 assert.equal(a.sourceScopeComplete,false);assert.equal(a.lifecycleCleanupAllowed,false);assert.equal(a.companyGlobalTotal,null)
 assert.equal(a.observedRecordCount,5);assert.equal(a.observedVacancyCount,5)
 assert.deepEqual(readSourceObservationEvidence(jobs,'breathehr'),{source:'breathehr',recordKind:'vacancy-rows',observedRecordCount:5,observedVacancyCount:5,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 assert.equal(a.roles.length,5)
 assert.ok(a.roles.every(r=>r.country==='United Kingdom'&&r.publishedDescriptionVisibleMatch===true&&r.applicationVisited===false&&r.screeningCriteriaAcquired===false))
 const software=a.roles.find(r=>r.id==='8569272')
 assert.equal(software.nativeEmployer.name,'ELMOgroup');assert.equal(software.nativeDivision,'BreatheHR')
 assert.equal(software.nativeLegalEmployer,null);assert.equal(software.descriptionEncoding,'one-entity-HTML-wrapper')
 assert.match(software.nativeDescriptionRaw,/&lt;p&gt;/);assert.match(software.publishedDescriptionHTML,/<p>/)
 assert.match(software.nativeDescriptionRaw,/ELMO UK is an equal opportunity employer/)
 assert.equal(software.applicationDeadline,null);assert.equal(software.nativeDatePosted,'2026-10-19T12:57:44+01:00')
 assert.ok(a.allOpeningRolesBeforeClosingRoles&&a.allOwnRolesRechecked&&a.currentCorporateHandoffRechecked)
 for(const url of roles)assert.ok(r.calls.lastIndexOf(url)>Math.max(...roles.map(u=>r.calls.indexOf(u))))
 assert.ok(r.calls.every(u=>!u.includes('/applications/')&&!u.includes('/connect')))
})

const scenarios=[
 ['unreconciled native counter',(h,c)=>c.url===LIST?h.replace(/(<h2\b[^>]*>\s*)5 jobs/,(all,before)=>before+'6 jobs'):h,/count|cards/],
 ['unlinked extra native card',(h,c)=>c.url===LIST?h.replace(/(<ul\b[^>]*\bid="jobs_list_container"[^>]*>)/,'$1<li class="w-full">India role without inventoried native link</li>'):h,/card|count|inventory/],
 ['additional linked role outside native cards',(h,c)=>c.url===LIST?h.replace('</turbo-frame>','<a href="https://careers.breathehr.com/jobs/9999999-extra-role">Extra role</a></turbo-frame>'):h,/card|role|inventory/],
 ['visible paging',(h,c)=>c.url===LIST?h.replace('</turbo-frame>','<a rel="next" href="/jobs?page=2">Next</a></turbo-frame>'):h,/pagin|programme|inventory/],
 ['nonempty native keyword filter',(h,c)=>c.url===LIST?h.replace('id="query"','id="query" value="India"'):h,/filter/],
 ['additional native filter',(h,c)=>c.url===LIST?h.replace('</form>','<input name="country" value="GB"></form>'):h,/filter/],
 ['hidden successful native country filter',(h,c)=>c.url===LIST?h.replace(/(<form\b[^>]*\bid="blocks-jobs-filters-form"[^>]*>)/,'$1<input type="hidden" name="country" value="GB">'):h,/filter/],
 ['successful native country filter with hidden attribute',(h,c)=>c.url===LIST?h.replace(/(<form\b[^>]*\bid="blocks-jobs-filters-form"[^>]*>)/,'$1<input hidden name="country" value="GB">'):h,/filter/],
 ['successful native country filter with CSS hiding',(h,c)=>c.url===LIST?h.replace(/(<form\b[^>]*\bid="blocks-jobs-filters-form"[^>]*>)/,'$1<style>#extra-country{display:none!important}</style><input id="extra-country" name="country" value="GB">'):h,/filter/],
 ['external form-associated hidden native filter',(h,c)=>c.url===LIST?h.replace('</body>','<input form="blocks-jobs-filters-form" hidden name="country" value="GB"></body>'):h,/filter/],
 ['unreviewed selected native option in optgroup',(h,c)=>{
  if(c.url!==LIST)return h
  const changed=h.replace(/<option\b[^>]*\bvalue="London"[^>]*>\s*London\s*<\/option>/,
   option=>'<optgroup label="Changed location model">'+option.replace('<option','<option selected')+'</optgroup>')
  assert.notEqual(changed,h,'The current native London option must really move under optgroup');return changed
 },/filter|option|model/],
 ['disabled default native All option',(h,c)=>{
  if(c.url!==LIST)return h
  const changed=h.replace(/(<select\b[^>]*\bid="location-select"[^>]*>)([\s\S]*?)(<\/select>)/,
   (all,open,options,close)=>open+options.replace(/(<option\b[^>]*\bvalue=""[^>]*)(>\s*All\s*<\/option>)/,'$1 disabled$2')+close)
  assert.notEqual(changed,h,'The current native location All option must really become disabled');return changed
 },/filter|option|unfiltered/],
 ['duplicate native frame id shadow',(h,c)=>c.url===LIST?h.replace('</body>','<template><turbo-frame id="jobs_list"></turbo-frame></template></body>'):h,/unique|frame|duplicate/],
 ['new deferred native frame source',(h,c)=>c.url===LIST?h.replace('<turbo-frame id="jobs_list"','<turbo-frame src="/jobs?country=GB" id="jobs_list"'):h,/frame|scope|source/],
 ['CSS-hidden native job list',(h,c)=>c.url===LIST?h.replace('</head>','<style>#jobs_list{display:none!important}</style></head>'):h,/visible|frame|inventory/],
 ['new corporate recruitment programme',(h,c)=>c.url===CANON?h.replace('</body>','<a href="https://another.example/careers">Careers</a></body>'):h,/programme|handoff|careers/],
 ['nonexact corporate openings programme',(h,c)=>c.url===CANON?h.replace('</body>','<a href="https://boards.greenhouse.io/other-employer">India engineering openings</a></body>'):h,/programme|handoff|careers/],
 ['nonexact native openings programme',(h,c)=>c.url===HOME?h.replace('</body>','<a href="https://boards.greenhouse.io/other-employer">India engineering openings</a></body>'):h,/programme|handoff|careers/],
 ['lost corporate handoff',(h,c)=>c.url===CANON?h.replaceAll(HOME,'https://another.example/'):h,/handoff|careers|programme/],
 ['unqualified native account',(h,c)=>c.url===roles[0]?mutatePosting(h,j=>({...j,hiringOrganization:{...j.hiringOrganization,sameAs:'https://other-account.teamtailor.com'}})):h,/account|employer|identity/],
 ['present empty LD source attribute',(h,c)=>c.url===roles[0]?h.replace(/(<script\b[^>]*\btype="application\/ld\+json")/,'$1 src=""'):h,/active|identity|JSON|source/],
 ...['object','svg','math'].map(tag=>['unqualified '+tag+' JobPosting carrier',(h,c)=>c.url===roles[0]?wrapPosting(h,tag):h,/active|identity|JSON|carrier/]),
 ['unqualified native employer',(h,c)=>c.url===roles[2]?mutatePosting(h,j=>({...j,hiringOrganization:{...j.hiringOrganization,name:'Other Employer'}})):h,/employer|identity/],
 ['foreign native head title',(h,c)=>c.url===roles[0]?h.replace(/(<title>)[\s\S]*?(<\/title>)/,'$1Other Employer role$2'):h,/title|identity/],
 ['lost own Division binding',(h,c)=>c.url===roles[2]?h.replace(/(<dd\b[^>]*>\s*)BreatheHR(\s*<\/dd>)/,'$1OtherDivision$2'):h,/Division|division|programme/],
 ['lost current native apply controls',(h,c)=>c.url===roles[0]?h.replaceAll('careersite--jobs--form-overlay#showFormOverlay','inactive#other'):h,/apply|application|current/],
 ['contradictory explicit visible work country',(h,c)=>{
  if(c.url===LIST||c.url===HOME)return h.replace(/(<span>\s*)London(?=\s*<\/span>)/,'$1London, India')
  if(c.url!==roles[0])return h
  return mutatePosting(h,j=>({...j,jobLocation:j.jobLocation.map(l=>({...l,address:{...l.address,addressLocality:'London, India'}}))}))
   .replace(/(<dd\b[^>]*>\s*)London(\s*<\/dd>)/,'$1London, India$2')
 },/country/],
 ['contradictory slash-separated visible work country',(h,c)=>{
  if(c.url===LIST||c.url===HOME)return h.replace(/(<span>\s*)London(?=\s*<\/span>)/,'$1London / India')
  if(c.url!==roles[0])return h
  return mutatePosting(h,j=>({...j,jobLocation:j.jobLocation.map(l=>({...l,address:{...l.address,addressLocality:'London / India'}}))}))
   .replace(/(<dd\b[^>]*>\s*)London(\s*<\/dd>)/,'$1London / India$2')
 },/country/],
 ['native India work country',(h,c)=>c.url===roles[0]?mutatePosting(h,j=>({...j,jobLocation:j.jobLocation.map(l=>({...l,address:{...l.address,addressCountry:'IN'}}))})):h,/India|country/],
 ['unknown native work country',(h,c)=>c.url===roles[0]?mutatePosting(h,j=>({...j,jobLocation:j.jobLocation.map(l=>({...l,address:{...l.address,addressCountry:'ZZ'}}))})):h,/country/],
 ['contradictory explicit native address-region country',(h,c)=>c.url===roles[0]?mutatePosting(h,j=>({...j,jobLocation:j.jobLocation.map(l=>({...l,address:{...l.address,addressRegion:'Karnataka, India'}}))})):h,/country/],
 ['contradictory explicit native street-address country',(h,c)=>c.url===roles[0]?mutatePosting(h,j=>({...j,jobLocation:j.jobLocation.map(l=>({...l,address:{...l.address,streetAddress:'Bangalore, India'}}))})):h,/country/],
 ['unreviewed nested address-region country model',(h,c)=>c.url===roles[0]?mutatePosting(h,j=>({...j,jobLocation:j.jobLocation.map(l=>({...l,address:{...l.address,addressRegion:{country:'IN'}}}))})):h,/country|address|model/],
 ['contradictory country model',(h,c)=>c.url===roles[0]?mutatePosting(h,j=>({...j,jobLocation:j.jobLocation.map(l=>({...l,address:{...l.address,addressCountry:{name:'GB',identifier:'IN'}}}))})):h,/country/],
 ['additional native India location',(h,c)=>c.url===roles[0]?mutatePosting(h,j=>({...j,jobLocation:[...j.jobLocation,{...j.jobLocation[0],address:{...j.jobLocation[0].address,addressCountry:'IN'}}]})):h,/location|country/],
 ['unknown nested native country field',(h,c)=>c.url===roles[0]?mutatePosting(h,j=>({...j,jobLocation:j.jobLocation.map(l=>({...l,addressCountry:'IN'}))})):h,/location|country|model/],
 ['new applicant-country declaration',(h,c)=>c.url===roles[0]?mutatePosting(h,j=>({...j,applicantLocationRequirements:{'@type':'Country',name:'India'}})):h,/country|field|model/],
 ['changed complete authored criterion',(h,c)=>c.url===roles[0]?mutatePosting(h,j=>({...j,description:j.description.replace('minimum three office days','minimum four office days')})):h,/criteria|description/],
 ['authored punctuation change',(h,c)=>c.url===roles[0]?mutatePosting(h,j=>({...j,description:j.description.replace('UK Group','UK+ Group')})):h,/criteria|description/],
 ['unknown extra native criterion field',(h,c)=>c.url===roles[0]?mutatePosting(h,j=>({...j,qualifications:'Additional mandatory condition'})):h,/field|model|criteria/],
 ['invalid native calendar date',(h,c)=>c.url===roles[0]?mutatePosting(h,j=>({...j,datePosted:'2026-02-30T11:43:53+00:00'})):h,/date|calendar/],
 ['future native publication',(h,c)=>c.url===roles[0]?mutatePosting(h,j=>({...j,datePosted:'2027-10-27T11:43:53+00:00'})):h,/date|publication/],
 ['duplicate native JSON key',(h,c)=>c.url===roles[0]?h.replace('"addressCountry":"GB"','"addressCountry":"GB","addressCountry":"GB"'):h,/duplicate|JSON/],
 ['closing whole-role body drift',(h,c)=>c.url===roles[0]&&c.occurrence===1?h+'\n<!-- changed outside published criteria -->':h,/closing|changed/],
 ['closing listing country drift',(h,c)=>c.url===LIST&&c.occurrence===1?h.replace('London','India'):h,/closing|changed/],
 ['closing corporate handoff drift',(h,c)=>c.url===CANON&&c.occurrence===1?h.replaceAll(HOME,'https://another.example/'):h,/closing|changed|handoff/],
 ['missing native home card',(h,c)=>c.url===HOME?removeCard(h,roles.at(-1)):h,/inventory|card|count/],
]
for(const [name,change,pattern]of scenarios)test('withholds finite-programme zero for '+name,async()=>{
 const r=replay(change)
 await assert.rejects(r.run(),e=>e.failureKind==='coverage_gap'&&pattern.test(e.message))
 assert.ok(r.changed.length>0,'The control must mutate an acquired original packet')
})

test('all selected roles open before earlier-role closing, so later-acquisition drift cannot release stale zero',async()=>{
 let later=false,closingAfterLater=false
 const r=replay((h,c)=>{
  if(c.url===roles[1]&&c.occurrence===0)later=true
  if(c.url===roles[0]&&c.occurrence===1){closingAfterLater=later;if(later)return h+'\n<!-- changes after later role acquisition -->'}
  return h
 })
 await assert.rejects(r.run(),/closing|changed/)
 assert.equal(closingAfterLater,true)
})
test('reserves the entire eighteen-read closing transaction and all five own-role details',async()=>{
 for(const options of [{maxRequests:17},{maxDetails:4}]){
  const r=replay(undefined,options)
  await assert.rejects(r.run(),e=>e.failureKind==='coverage_gap'&&/budget|bound|detail/i.test(e.message))
  assert.ok(r.calls.length<=4)
 }
})

test('dynamic complete native four-role programme qualifies only after all remaining own-role openings and closings',async()=>{
 const r=replay((html,c)=>{
  if(c.url!==LIST&&c.url!==HOME)return html
  return removeCard(html,roles.at(-1)).replace(/(<h2\b[^>]*>\s*)5 jobs/,(all,before)=>before+'4 jobs')
 },{maxRequests:16,maxDetails:4})
 const jobs=await r.run(),e=readInventoryEvidence(jobs)
 assert.equal(e.status,'complete-inventory');assert.equal(e.reportedTotal,4);assert.equal(e.indiaFacetCount,0)
 assert.equal(r.calls.length,16);assert.equal(jobs.nativeCollectionEvidence.roles.length,4)
 assert.ok(!r.calls.includes(roles.at(-1)))
})

test('bounded standalone transport replays original HTTP bodies with GET/no-store/manual redirect and finite native audit',async()=>{
 const seen=new Map(),calls=[]
 const jobs=await runCurrentBreatheTeamtailor({now,requestIntervalMs:0,fetchImpl:async(url,init)=>{
  calls.push({url,method:init.method,cache:init.cache,redirect:init.redirect,credentials:init.credentials,headers:init.headers})
  const occurrence=seen.get(url)||0;seen.set(url,occurrence+1)
  const packet=fixture.responses.filter(r=>r.requestedURL===url)[occurrence]
  assert.ok(packet,'All transport calls need an exact captured response')
  const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,
   headers:{...(packet.contentType?{'content-type':packet.contentType}:{}),...(packet.location?{location:packet.location}:{})}})
  Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }})
 assert.equal(calls.length,18);assert.equal(readInventoryEvidence(jobs).reportedTotal,5)
 assert.ok(calls.every(c=>c.method==='GET'&&c.cache==='no-store'&&c.redirect==='manual'&&c.credentials==='omit'&&c.headers.Accept==='text/html'))
})

test('bounded transport retains genuine denial, changed response URL/MIME, caller abort and request deadline',async()=>{
 for(const status of [401,403,429,451])await assert.rejects(runCurrentBreatheTeamtailor({requestIntervalMs:0,fetchImpl:async url=>{
  const response=new Response('Publisher denial',{status,headers:{'content-type':'text/html'}})
  Object.defineProperty(response,'url',{value:url});return response
 }}),e=>e.status===status&&e.failureKind==='blocked_or_access_denied'&&e.upstreamOutage===true)
 const aborted=new AbortController(),reason=Error('Original caller cancellation');aborted.abort(reason)
 await assert.rejects(runCurrentBreatheTeamtailor({signal:aborted.signal,fetchImpl:()=>assert.fail('No read after cancellation')}),e=>e===reason)
 await assert.rejects(runCurrentBreatheTeamtailor({requestIntervalMs:0,requestTimeoutMs:10,fetchImpl:()=>new Promise(()=>{})}),e=>e.name==='TimeoutError')
 for(const change of ['url','mime']){
  await assert.rejects(readCurrentBreatheTeamtailor({now,readPage:async url=>change==='url'?{url:url+'?other',status:200,html:'',headers:{'content-type':'text/html'}}:
   url===CORP?{url,status:301,html:'',headers:{location:CANON}}:{url,status:200,html:'{}',headers:{'content-type':'application/json'}}}),e=>e.failureKind==='coverage_gap'&&/URL|MIME/.test(e.message))
 }
})

test('an injected original-page hook must provide its actual response URL rather than invented requested-URL provenance',async()=>{
 const seen=new Map()
 await assert.rejects(runCurrentBreatheTeamtailor({now,requestIntervalMs:0,fetchPage:async url=>{
  const occurrence=seen.get(url)||0;seen.set(url,occurrence+1)
  const packet=fixture.responses.filter(r=>r.requestedURL===url)[occurrence]
  assert.ok(packet,'Every hook read still uses an actual fixture packet')
  return {status:packet.status,html:body(packet),headers:{...(packet.contentType?{'content-type':packet.contentType}:{}),...(packet.location?{location:packet.location}:{})}}
 }}),e=>e.failureKind==='coverage_gap'&&/URL|identity|provenance/.test(e.message))
})
