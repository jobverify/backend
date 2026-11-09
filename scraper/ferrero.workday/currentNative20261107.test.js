import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readCountryForm,readIndiaListing,readFerreroRole,strictJSON} from './nativeModels.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-http.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(p=>p.source==='ferrero'),HOME='https://www.ferrero.com/',JOBS='https://www.ferrerocareers.com/int/en/jobs',INDIA=JOBS+'?search_country=&country%5BIndia%5D=India'
const first=fixture.requests.find(r=>r.authorityBasis.kind==='nativeIndiaListingRoleOpening').url,sha=b=>createHash('sha256').update(b).digest('hex')
function transport(change){
 const calls=[],counts=new Map
 return {calls,fetchImpl:async(url,init)=>{
  const rows=fixture.requests.filter(r=>r.url===url),count=counts.get(url)||0,p=rows[Math.min(count,rows.length-1)];assert.ok(p,'NETWORK TRIPWIRE unrecorded URL '+url);counts.set(url,count+1)
  assert.equal(init.method,'GET');assert.equal(init.redirect,'follow');assert.equal(init.credentials,'omit');assert.deepEqual(Object.fromEntries(new Headers(init.headers)),p.requestHeaders)
  assert.equal(init.body,undefined);calls.push(String(url));const b=Buffer.from(fixture.entities[p.bodySHA256],'base64');assert.equal(sha(b),p.bodySHA256)
  const current=change?change({url,html:b.toString(),status:p.status,finalURL:p.finalURL,contentType:p.contentType},count+1):{html:b.toString(),status:p.status,finalURL:p.finalURL,contentType:p.contentType}
  const response=new Response(current.html,{status:current.status,headers:{'content-type':current.contentType}});Object.defineProperty(response,'url',{value:current.finalURL});return response
 }}
}
const run=(io,extra={})=>createCatalogScraper(provider).run({fetchImpl:io.fetchImpl,now:()=>fixture.observedAt,...extra})
test('Ferrero exact current GET-country workflow retains10 true ownIDs/full raw India models as lifecycle holds without qualified active jobs',async()=>{
 const io=transport(),jobs=await run(io);assert.deepEqual(io.calls,fixture.requests.map(r=>r.url));assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,'ferrero').observedVacancyCount,10)
 const a=jobs.nativeCollectionEvidence;assert.equal(a.openingRoles.length,10);assert.equal(a.closingRoles.length,10);assert.equal(a.heldRoles.length,10)
 const first=a.openingRoles[0];assert.equal(first.id,'78362');assert.equal(first.schema.identifier,'Manufacturing');assert.equal(first.country,'India');assert.equal(first.city,'Baramati');assert.ok(first.fullCriteriaHTML.includes('Atleast 4 to 8 years'));assert.equal(first.criteriaText,first.schema.description);assert.equal(first.schema.validThrough,'2026-10-29T13:00:00+0100')
 assert.ok(a.heldRoles.every(r=>r.reason.includes('validThrough')));assert.equal(a.sourceScopeComplete,false);assert.equal(a.lifecycleCleanupAllowed,false);assert.equal(a.companyIndiaZeroProven,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
for(const[name,change]of[
 ['different country selector',s=>s.replace('name="country[India]"','name="country[United States]"')],
 ['different India selector value',s=>s.replace('name="country[India]" value="India"','name="country[India]" value="US"')],
 ['extra successful country authority',s=>s.replace('id="views-exposed-form-jobs-jobs"','id="views-exposed-form-jobs-jobs" data-country="US"')],
])test('Ferrero rejects changed exact declared GET contract '+name,async()=>{
 const io=transport(p=>p.url===JOBS?{...p,html:change(p.html)}:p);await assert.rejects(run(io),/country|form|GET/i)
})
for(const[name,change]of[
 ['typed foreign country',s=>s.replace('"addressCountry": "IN"','"addressCountry": "US"')],
 ['unsupported nested country carrier',s=>s.replace('"addressCountry": "IN"','"addressCountry": "IN", "countryCode":"US"')],
 ['employer authority',s=>s.replace('"name": "Ferrero"','"name": "Different employer"')],
 ['extra employer sameAs',s=>s.replace('"name": "Ferrero"','"name": "Ferrero", "sameAs":"https://unrelated.invalid/"')],
 ['category mistaken for native role ID',s=>s.replace('field--label-hidden field__item">78362</div>','field--label-hidden field__item">Manufacturing</div>')],
 ['hidden mandatory criteria',s=>s.replace('class="ac-panel"','class="ac-panel" hidden')],
 ['unreviewed hidden country authority',s=>s.replace('class="job-posting__summary mt-3 mb-4"','class="job-posting__summary mt-3 mb-4" data-countrycode="US"')],
 ['extra mandatory paragraph outside full criteria',s=>s.replace('<div class="node__content">','<div class="node__content"><p>Mandatory additional clearance.</p>')],
 ['extra role inline authority program',s=>s.replace('</head>','<script>document.country="US"</script></head>')],
])test('Ferrero keeps whole raw held evidence for '+name,async()=>{
 let changed=0;const io=transport(p=>{if(p.url===first){const html=change(p.html);assert.notEqual(html,p.html);changed++;return{...p,html}}return p}),jobs=await run(io),a=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(changed,2);assert.equal(readSourceObservationEvidence(jobs,'ferrero').observedVacancyCount,10);const held=a.heldRoles.find(r=>r.id==='78362')
 assert.ok(held);assert.equal(held.opening.modelComplete,false);assert.ok(held.opening.originalRawHTML.length>70000);assert.equal(held.opening.originalRawHTML,held.closing.originalRawHTML);assert.ok(held.reason);assert.notEqual(held.reason,'native-validThrough-is-past')
})
test('Ferrero closing criteria mutation remains separate raw opening and closing evidence',async()=>{
 const io=transport((p,count)=>p.url===first&&count===2?{...p,html:p.html.replaceAll('4 to 8 years','5 to 9 years')}:p),jobs=await run(io),held=jobs.nativeCollectionEvidence.heldRoles.find(r=>r.id==='78362')
 assert.match(held.reason,/closing/);assert.ok(held.opening.originalRawHTML.includes('4 to 8 years'));assert.ok(held.closing.originalRawHTML.includes('5 to 9 years'));assert.equal(jobs.length,0)
})
test('Ferrero detail budget retains all10 observed rows and explicit unread holds',async()=>{
 const io=transport(),jobs=await run(io,{maxDetails:1}),a=jobs.nativeCollectionEvidence;assert.equal(readSourceObservationEvidence(jobs,'ferrero').observedVacancyCount,10);assert.equal(a.openingRoles.length,1);assert.equal(a.heldRoles.filter(r=>r.reason==='native-detail-unread-budget').length,9);assert.equal(jobs.length,0)
})
test('Ferrero primary403 remains denial with raw provenance and no fallback',async()=>{
 const io=transport(p=>({...p,status:403,html:'Access denied'}));await assert.rejects(run(io),e=>{assert.equal(e.status,403);assert.equal(e.failureKind,'blocked_or_access_denied');assert.equal(e.upstreamOutage,true);assert.equal(e.recruitmentObservations.receipts.length,1);assert.equal(e.recruitmentObservations.receipts[0].status,403);return true});assert.equal(io.calls.length,1)
})
test('Ferrero opaque caller abort settles pending headers without changing its reason',async()=>{
 const caller=new AbortController(),reason=Object.freeze({opaque:'caller'});let start,release
 const ready=new Promise(r=>start=r),result=createCatalogScraper(provider).run({signal:caller.signal,fetchImpl:async()=>{start();return new Promise(r=>release=r)}})
 const done=result.then(value=>({value}),error=>({error}));await ready;caller.abort(reason)
 const outcome=await Promise.race([done,new Promise(r=>setTimeout(()=>r({late:true}),80))]);release({status:200,url:HOME,headers:new Headers({'content-type':'text/html'}),body:null});await done
 assert.equal(outcome.error,reason);assert.deepEqual(Object.keys(reason),['opaque'])
})
test('Ferrero request deadline settles a callback ignoring its signal',async()=>{
 const started=performance.now();await assert.rejects(createCatalogScraper(provider).run({sourceTimeoutMs:50,requestTimeoutMs:20,fetchImpl:async()=>new Promise(resolve=>setTimeout(()=>resolve({status:200,url:HOME,headers:new Headers({'content-type':'text/html'}),body:null}),100))}),e=>e.name==='TimeoutError'&&e.message==='Ferrero request deadline exceeded');assert.ok(performance.now()-started<1000)
})
test('Ferrero first403 survives an actual body stream failure',async()=>{
 await assert.rejects(createCatalogScraper(provider).run({sourceTimeoutMs:200,fetchImpl:async()=>({status:403,url:HOME,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{read(){return Promise.reject(Error('actual denied stream'))},cancel(){return new Promise(r=>setTimeout(r,100))},releaseLock(){}}}}})}),e=>e.status===403&&e.failureKind==='blocked_or_access_denied'&&e.upstreamOutage===true)
})
const nativePage=url=>{const r=fixture.requests.find(r=>r.url===url);return{status:r.status,url:r.finalURL,contentType:r.contentType,html:Buffer.from(fixture.entities[r.bodySHA256],'base64').toString()}}
const actualForm=readCountryForm(nativePage(JOBS)),actualListing=readIndiaListing(nativePage(INDIA),actualForm),actualRole=nativePage(first),actualRow=actualListing.rows[0]
for(const[name,insert]of[
 ['foreign employer link','<link itemprop="hiringOrganization" href="https://unrelated.invalid/">'],
 ['hidden country metadata','<meta hidden name="country" content="US">'],
 ['hidden mandatory criterion outside role','<div hidden>Additional mandatory security clearance.</div>'],
 ['hidden base URL','<base hidden href="https://unrelated.invalid/">'],
])test('Ferrero raw global owner envelope rejects '+name,()=>assert.throws(()=>readFerreroRole({...actualRole,html:actualRole.html.replace('</head>',insert+'</head>')},actualRow,fixture.observedAt)))
for(const input of ['<input type="hidden" hidden name="country[United States]" value="United States">','<input type="checkbox" hidden checked name="country[United States]" value="United States">','<select hidden name="country[United States]"><option selected>United States</option></select>'])test('Ferrero exact raw successful GET controls reject '+input,()=>{
 const p=nativePage(JOBS),html=p.html.replace(/(<form[^>]*id="views-exposed-form-jobs-jobs"[^>]*>)/,'$1'+input);assert.notEqual(html,p.html);assert.throws(()=>readCountryForm({...p,html}))
})
for(const key of ['addressCountry','hiringOrganization','description'])test('Ferrero strict native JSON preserves duplicate and escaped-key conflicts '+key,()=>{
 assert.throws(()=>strictJSON('{"'+key+'":"first","'+key+'":"second"}'))
 assert.throws(()=>strictJSON('{"'+key+'":"first","\\u'+key.charCodeAt(0).toString(16).padStart(4,'0')+key.slice(1)+'":"second"}'))
})
test('Ferrero complete listing owner rejects additional structural owner with unchanged scalar text',()=>{
 const p=nativePage(INDIA),html=p.html.replace('<article','<article data-unreviewed="new-authority"');assert.notEqual(html,p.html);assert.throws(()=>readIndiaListing({...p,html},actualForm))
})
test('Ferrero native renderer node and own share-dialog binding must agree',()=>{
 const html=actualRole.html.replace('"currentPath":"node\\/11725"','"currentPath":"node\\/11618"');assert.notEqual(html,actualRole.html);assert.throws(()=>readFerreroRole({...actualRole,html},actualRow,fixture.observedAt))
})
test('Ferrero supplemental WebPage summary must preserve exact current prefix and whole primary criteria',()=>{
 const html=actualRole.html.replace('"description": "About the Role:', '"description": "Mandatory foreign clearance. About the Role:');assert.notEqual(html,actualRole.html);assert.throws(()=>readFerreroRole({...actualRole,html},actualRow,fixture.observedAt))
})
for(const kind of ['source','request'])test('Ferrero monotonic '+kind+' deadline rejects a synchronous late callback before timer dispatch',async()=>{
 const {createFerreroReader}=await import('./nativeCurrent.js'),r=createFerreroReader({sourceTimeoutMs:kind==='source'?20:1000,requestTimeoutMs:kind==='request'?20:1000,fetchImpl:async()=>{
  const until=performance.now()+45;while(performance.now()<until){}
  const p=nativePage(HOME),response=new Response(p.html,{headers:{'content-type':p.contentType}});Object.defineProperty(response,'url',{value:p.url});return response
 }})
 try{await assert.rejects(r.read(HOME),e=>e.name==='TimeoutError'&&e.message==='Ferrero '+kind+' deadline exceeded')}finally{r.close()}
})
test('Ferrero monotonic deadline also bounds synchronous onAudit processing after complete raw models',async()=>{
 const io=transport();let entered=false
 await assert.rejects(run(io,{sourceTimeoutMs:2000,onAudit:()=>{entered=true;const until=performance.now()+2100;while(performance.now()<until){}}}),e=>e.name==='TimeoutError'&&e.message==='Ferrero source deadline exceeded')
 assert.equal(entered,true)
})
