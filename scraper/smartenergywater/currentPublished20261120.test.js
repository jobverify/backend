import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readInventoryEvidence,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const api=await import('./currentPublished20261120.js').catch(e=>e.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(e))
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url))))
const LANDING='https://www.sew.ai/sew-career',LISTING='https://www.sew.ai/current-opening',FIRST='https://www.sew.ai/career/technical-delivery-manager',AT=fixture.observedAt
const requireAPI=()=>assert.equal(typeof api.runCurrentPublications,'function','Current native own-publication collector required')
const text=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8')
async function replay(change,options={}){
 requireAPI();const queues=new Map(),calls=[];let harnessFailure,changes=0
 for(const p of fixture.responses){if(!queues.has(p.requestedUrl))queues.set(p.requestedUrl,[]);queues.get(p.requestedUrl).push(p)}
 const fetchImpl=async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const p=queues.get(url)?.shift();assert.ok(p,'Only exact genuine original URL '+url)
  const index=calls.filter(v=>v.url===url).length;let m={}
  try{m=change?.(text(p),url,index)??{}}catch(e){harnessFailure=e;throw e}
  if(Object.keys(m).length)changes++;calls.push({url,index,status:m.status??p.status})
  return Object.defineProperties(new Response(m.body??Buffer.from(p.bodyBase64,'base64'),{status:m.status??p.status,headers:m.headers??p.headers}),{url:{value:m.url??p.url},redirected:{value:m.redirected??false}})
 }
 try{const jobs=await api.runCurrentPublications({now:AT,requestIntervalMs:0,fetchImpl,...options});if(harnessFailure)throw harnessFailure;if(change)assert(changes,'Actual original mutation applied');return{jobs,calls,audit:jobs.nativeCollectionEvidence}}catch(e){if(harnessFailure)throw harnessFailure;throw e}
}
function editNode(html,predicate,edit){const d=document(html),node=d.nodes(predicate)[0];assert.ok(node,'Native mutation owner exists');const old=d.outer(node),next=edit(old,node,d);assert.notEqual(next,old,'Actual native mutation changes evidence');return html.slice(0,node.start)+next+html.slice(node.end)}
const header=(html,edit)=>editNode(html,n=>n.tag==='h3'&&/hdng3_nww/.test(n.attrs.class??''),edit)
const form=(html,edit)=>editNode(html,n=>n.tag==='form'&&/webform-submission-job-application-node-/.test(n.attrs.id??''),edit)
const scope=(html,edit)=>editNode(html,n=>n.tag==='section'&&/platform_wrp/.test(n.attrs.class??'')&&/smrtgxclrblue/.test(n.attrs.class??''),edit)
const add=(html,markup)=>scope(html,(old,n)=>old.slice(0,n.closeStart-n.start)+markup+old.slice(n.closeStart-n.start))
const closing=edit=>(html,url,index)=>url===FIRST&&index===1?{body:edit(html)}:null

test('44 genuine current original Responses retain exact bytes and hashes',()=>{
 assert.equal(fixture.error,null);assert.equal(fixture.responses.length,44)
 for(const p of fixture.responses){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(b.length,p.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),p.sha256);assert.equal(p.status,200)}
})
test('own current declaration enumerates all20 native public URLs including uppercase React Engineer',()=>{
 requireAPI();const publisher=api.currentPublisher(text(fixture.responses[0])),listing=api.currentListing(text(fixture.responses[1]),publisher.listingURL)
 assert.equal(publisher.listingURL,LISTING);assert.equal(listing.rows.length,20);assert.ok(listing.rows.some(r=>r.url==='https://www.sew.ai/React-Engineer'))
 assert.equal(new Set(listing.rows.map(r=>r.url)).size,20)
})
test('current own title/public role/form and explicit India workplace yield valid partial vacancies',async()=>{
 const{jobs,calls,audit}=await replay();assert.equal(calls.length,44);assert(jobs.length>=3);assert(jobs.some(j=>j.sourceUrl===FIRST))
 assert.equal(audit.nativeOpeningInventory.length,20);assert.equal(audit.nativeClosingInventory.length,20)
 assert(jobs.every(j=>j.country==='India'&&j.nativeLegalEmployer===null&&j.nativePublicJobId===null&&j.requisitionId===null&&j.sourceDetailComplete===false&&j.lifecycleCleanupAllowed===false&&j.sourceNativeApplication.activationVerified===false&&j.sourceNativeApplication.submitted===false))
 const e=readInventoryEvidence(jobs);assert.equal(e.status,'coverage-gap');assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null);assert.equal(isVerifiedEmptyEvidence(e),false)
 assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null)
})
for(const[name,edit]of[
 ['actual title publication flag',html=>header(html,s=>s.replace('<h3 ','<h3 data-is-published="false" '))],
 ['actual role employer conflict',html=>add(html,'<div>Employer: Other Company</div>')],
 ['whole role country conflict',html=>add(html,'<section>Work Country: Canada</section>')],
 ['authored same-role expiry',html=>add(html,'<div>Expires: 2020-01-01</div>')],
 ['multi-token structured date',html=>add(html,'<time itemprop="datePosted publicationDate" datetime="2099-01-01"></time>')],
 ['semantic leaf closure',html=>add(html,'<section>This position has been filled.</section>')],
 ['native current country',html=>header(html,s=>s.replace('<h3 ','<h3 data-country="Canada" '))],
 ['actual form application action',html=>form(html,s=>s.replace('action="/career/technical-delivery-manager"','action="https://other.invalid/apply"'))],
 ['actual form disabled',html=>form(html,s=>s.replace('<form ','<form aria-disabled="true" '))],
 ['actual submit handoff override',html=>form(html,(s,n)=>s.slice(0,n.closeStart-n.start)+'<button type="submit" formaction="https://other.invalid/apply">Apply</button>'+s.slice(n.closeStart-n.start))],
 ['foreign country before city despite India suffix',html=>html.replace('>Noida (India)</a>','>Canada Toronto Noida (India)</a>')],
 ['role native same URL altered title',html=>header(html,s=>s.replace('>Technical Delivery Manager</span>','>Unrelated Title</span>'))]
])test('closing '+name+' holds affected role while preserving unrelated partials',async()=>{
 const baseline=await replay(),{jobs}=await replay(closing(edit));assert.equal(jobs.length,baseline.jobs.length-1);assert(!jobs.some(j=>j.sourceUrl===FIRST))
})
test('different current CSS and script release does not gate genuine own SSR roles',async()=>{
 const baseline=await replay(),r=await replay((html)=>({body:html.replaceAll('row mb-2','row mb-2 new-current-style')+'<!-- own harmless release -->'}));assert.equal(r.jobs.length,baseline.jobs.length)
})
test('known opening and closing authored dates retain earliest actual precision and both native observations',async()=>{
 const{jobs}=await replay(closing(html=>add(html,'<div>Date Posted: 2020-01-01</div><div>Expires: 2026-12-01</div><p>New authored criterion.</p>'))),j=jobs.find(j=>j.sourceUrl===FIRST)
 assert.ok(j);assert.equal(j.postingDate,'2020-01-01T00:00:00.000Z');assert.equal(j.sourcePostingDateIsExact,false);assert.equal(j.sourceNativeRoleModels.length,2);assert.match(JSON.stringify(j.sourceNativeRoleModels),/New authored criterion/);assert.equal(j.sourceDetailComplete,false)
})
test('a duplicate conflicting closing native list card cannot hide behind URL deduplication',async()=>{
 const baseline=await replay(),r=await replay((html,url,index)=>url===LISTING&&index===1?{body:editNode(html,n=>n.tag==='li'&&/job-crr-item/.test(n.attrs.class??''),(s)=>s+s.replace('<a ','<a data-is-published="false" '))}:null)
 assert.equal(r.jobs.length,baseline.jobs.length-1);assert(!r.jobs.some(j=>j.sourceUrl===FIRST))
})
test('current country form choices do not qualify an unknown native workplace',async()=>{
 const baseline=await replay(),r=await replay((html,url)=>url===FIRST?{body:html.replaceAll('Noida (India)','Unproven workplace').replaceAll('Noida, India','Unproven workplace')}:null)
 assert.equal(r.jobs.length,baseline.jobs.length-1);assert(!r.jobs.some(j=>j.sourceUrl===FIRST))
})
test('complete200 invalid UTF8 and conflicting finalURL are held as parser/identity failures',async()=>{
 await assert.rejects(replay((h,u,n)=>u===LANDING&&n===0?{body:Buffer.from([0xc3,0x28])}:null))
 await assert.rejects(replay((h,u,n)=>u===LANDING&&n===0?{url:'https://other.invalid/'}:null))
})
for(const status of[202,401,402,403,406,407,429,451])test('HTTP'+status+' denial stops current origin without a second request',async()=>{
 let reads=0;await assert.rejects(replay(()=>{reads++;return{status,body:'Unavailable'}}));assert.equal(reads,1)
})
test('opaque caller cancellation before first read and after audit callback is preserved',async()=>{
 requireAPI();const early=new AbortController(),why=Object.freeze({caller:'SEW',phase:'early'});early.abort(why);await assert.rejects(api.runCurrentPublications({signal:early.signal}),e=>e===why)
 const late=new AbortController(),reason=Object.freeze({caller:'SEW',phase:'late'});await assert.rejects(replay(null,{signal:late.signal,onAudit:()=>queueMicrotask(()=>late.abort(reason))}),e=>e===reason)
})
test('mutating an audit clone cannot promote company completeness or cleanup',async()=>{
 const{audit,jobs}=await replay(null,{onAudit:a=>{a.sourceScopeComplete=true;a.companyIndiaTotal=0;a.lifecycleCleanupAllowed=true}});assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false);assert(jobs.every(j=>!j.lifecycleCleanupAllowed))
})
test('production factory defaults to original Response collection and current own metadata',async()=>{
 const {createSmartEnergyWaterScraper}=await import('./script.js'),provider=(await import('./catalog.js')).default,queues=new Map()
 for(const p of fixture.responses){if(!queues.has(p.requestedUrl))queues.set(p.requestedUrl,[]);queues.get(p.requestedUrl).push(p)}
 assert.equal(provider.authoritativeCurrentPublication,true);assert.equal(provider.scraperTimeoutMs,180000);assert.equal(provider.backfillMode,'live-parser');assert.equal(provider.companyCareerPage,LANDING)
 const jobs=await createSmartEnergyWaterScraper().run({now:AT,requestIntervalMs:0,fetchImpl:async(url)=>{const p=queues.get(url)?.shift();assert.ok(p,'Exact current production request '+url);return Object.defineProperties(new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers}),{url:{value:p.url},redirected:{value:false}})}})
 assert(jobs.some(j=>j.sourceUrl===FIRST));assert(jobs.every(j=>j.sourceDetailComplete===false))
})
const posting=edit=>{const value={'@context':'https://schema.org','@type':'https://schema.org/JobPosting',title:'Technical Delivery Manager',url:FIRST,hiringOrganization:{'@type':'Organization',name:'SEW',url:'https://www.sew.ai/'},jobLocation:[{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:'Noida',addressCountry:'IN'}}]};edit?.(value);return '<script type="application/ld+json">'+JSON.stringify(value)+'</script>'}
for(const[name,edit]of[
 ['foreign structured application',m=>m.applicationUrl='https://other.invalid/apply'],
 ['foreign structured employer URL',m=>m.hiringOrganization.sameAs='https://other.invalid/'],
 ['foreign structured applicant eligibility',m=>m.applicantLocationRequirements={'@type':'Country',name:'Canada'}],
 ['foreign whole structured workplace behind typedIndia',m=>m.jobLocation[0].address.name='Canada Toronto'],
 ['structured native publication false',m=>m.isPublished=false],
])test('closing '+name+' holds only affected role',async()=>{
 const baseline=await replay(),{jobs}=await replay(closing(html=>add(html,posting(edit))));assert.equal(jobs.length,baseline.jobs.length-1);assert(!jobs.some(j=>j.sourceUrl===FIRST))
})
test('genuine separate India and Canada structured places retain a valid India partial with all alternatives',async()=>{
 const baseline=await replay(),{jobs}=await replay(closing(html=>add(html,posting(m=>m.jobLocation.push({'@type':'Place',address:{'@type':'PostalAddress',addressLocality:'Toronto',addressCountry:'CA'}}))))),j=jobs.find(j=>j.sourceUrl===FIRST)
 assert.equal(jobs.length,baseline.jobs.length);assert.ok(j);assert.equal(j.country,'India');assert(!j.location.includes('Canada'));assert.match(JSON.stringify(j.sourceCountryEvidence),/Toronto/);assert.equal(j.sourceDetailComplete,false)
})
test('critical closing role HTTP503 holds its role while retaining independently qualified unrelated roles',async()=>{
 const baseline=await replay(),{jobs}=await replay((html,url,index)=>url===FIRST&&index===1?{status:503,body:'Temporary unavailable'}:null);assert.equal(jobs.length,baseline.jobs.length-1);assert(!jobs.some(j=>j.sourceUrl===FIRST))
})
test('native audit callback remains source-deadline bounded',async()=>{
 let entered=false;await assert.rejects(replay(null,{sourceTimeoutMs:2000,onAudit:()=>{entered=true;return new Promise(()=>{})}}),e=>entered&&/deadline/i.test(e.message))
})
test('snake_case native standard application alias cannot contradict current own form',async()=>{
 const baseline=await replay(),{jobs}=await replay(closing(html=>add(html,posting(m=>m.application_url='https://other.invalid/apply'))));assert.equal(jobs.length,baseline.jobs.length-1);assert(!jobs.some(j=>j.sourceUrl===FIRST))
})
test('empty native time datetime under authored posting label constrains future publication',async()=>{
 const baseline=await replay(),{jobs}=await replay(closing(html=>add(html,'<p>Date Posted: <time datetime="2099-01-01"></time></p>')));assert.equal(jobs.length,baseline.jobs.length-1)
})
test('microdata applicant geography cannot contradict own-role India eligibility',async()=>{
 const baseline=await replay(),{jobs}=await replay(closing(html=>add(html,'<meta itemprop="eligibleRegion" content="Canada">')));assert.equal(jobs.length,baseline.jobs.length-1)
})
test('hidden current criteria remains explicitly unreviewed while keeping valid partial role',async()=>{
 const baseline=await replay(),{jobs}=await replay(closing(html=>header(html,s=>s+'<div hidden>Additional mandatory criterion.</div>'))),job=jobs.find(j=>j.sourceUrl===FIRST)
 assert.equal(jobs.length,baseline.jobs.length);assert.ok(job);assert.equal(job.sourceHiddenCriteriaUnreviewed,true);assert.match(JSON.stringify(job.sourceNativeRoleModels),/Additional mandatory criterion/);assert.equal(job.sourceDetailComplete,false)
})
const submit=(html,edit)=>editNode(html,n=>n.tag==='input'&&n.attrs['data-drupal-selector']==='edit-actions-submit',edit)
for(const[name,edit]of[
 ['primary submit disabled',h=>submit(h,s=>s.replace('<input ','<input disabled '))],
 ['primary submit aria disabled',h=>submit(h,s=>s.replace('<input ','<input aria-disabled="true" '))],
 ['primary submit different form',h=>submit(h,s=>s.replace('<input ','<input form="unrelated-native-form" '))],
 ['primary submit GET method',h=>submit(h,s=>s.replace('<input ','<input formmethod="get" '))],
 ['primary submit disabled enclosing fieldset',h=>submit(h,s=>'<fieldset disabled>'+s+'</fieldset>')],
])test('independent peer '+name+' holds affected native role',async()=>{const{jobs}=await replay(closing(edit));assert.equal(jobs.length,3);assert(!jobs.some(j=>j.sourceUrl===FIRST))})
test('independent peer separate foreign native taxonomy workplace preserves existing India alternative',async()=>{
 const{jobs}=await replay(closing(h=>editNode(h,n=>n.tag==='a'&&/^\/taxonomy\/term\//.test(n.attrs.href??'')&&document(h).text(n)==='Noida (India)',s=>s+'<a href="/taxonomy/term/999999">Toronto Canada</a>'))),j=jobs.find(j=>j.sourceUrl===FIRST);assert.equal(jobs.length,4);assert.ok(j);assert.match(JSON.stringify(j.sourceCountryEvidence),/Toronto Canada/);assert(!j.location.includes('Canada'))
})
test('independent peer separate foreign labelled workplace preserves current India alternative',async()=>{
 const{jobs}=await replay(closing(h=>add(h,'<p>Location: Toronto Canada</p>'))),j=jobs.find(j=>j.sourceUrl===FIRST);assert.equal(jobs.length,4);assert.ok(j);assert.match(JSON.stringify(j.sourceCountryEvidence),/Toronto Canada/)
})
test('independent peer explicit same native form action and post method preserve current partial',async()=>{
 const{jobs}=await replay(closing(h=>submit(h,s=>s.replace('<input ','<input form="webform-submission-job-application-node-1486-add-form" formaction="'+FIRST+'" formmethod="post" '))));assert.equal(jobs.length,4)
})
export {fixture,replay,editNode,header,form,scope,add,closing,FIRST,LANDING,LISTING,AT}
