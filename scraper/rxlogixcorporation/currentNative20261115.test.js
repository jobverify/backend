import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,createRxLogixCorporationScraper,extractCareerDetail,extractCareerListings} from './script.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
test.beforeEach(t=>t.mock.method(globalThis,'fetch',()=>{throw Error('Real network prohibited in retained source tests')}))
const BOARD='https://rxlogix.com/careers/',ARCH='https://rxlogix.com/technical-architect/'
const ANALYTICS='https://www.googletagmanager.com/gtag/js?id=G-5N9GRWCJB3',GLOBALCSS='https://rxlogix.com/wp-content/themes/rxlogix-theme/assets/css/global.css'
const grouped=new Map(),body=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8')
for(const p of fixture.packets){if(!grouped.has(p.requestedURL))grouped.set(p.requestedURL,[]);grouped.get(p.requestedURL).push(p)}
const originalCriteria=url=>{const doc=readNativeDocument(body(grouped.get(url)[0]));return doc.text(doc.nodes(n=>doc.hasClass(n,'job-detail'))[0])}
function replay(change=()=>{},options={}){
 const calls=[],counts=new Map(),mutations=[]
 const fetchImpl=options.fetchImpl||(async(value,init)=>{
  const url=String(value),index=counts.get(url)||0;counts.set(url,index+1)
  const original=grouped.get(url)?.[index];assert.ok(original,'actual retained packet '+url+' #'+index)
  const p={...structuredClone(original),body:body(original)};change(p,url,index)
  if(p.body!==body(original)||p.status!==original.status||p.url!==original.url||JSON.stringify(p.headers)!==JSON.stringify(original.headers))mutations.push({url,index})
  calls.push({url,index,init});const response=new Response(p.body,{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response
 })
 return{calls,mutations,promise:run({fetchImpl,fetchPage:async url=>({html:body(grouped.get(url)[0]),status:200,url}),requestIntervalMs:0,now:()=>fixture.packets.at(-1).checkedAt,...options})}
}
test('original wrapper genuinely misses all current attributed native cards and truncates full criteria',async()=>{
 const html=body(grouped.get(BOARD)[0]);assert.equal(extractCareerListings(html).length,0)
 const jobs=await createRxLogixCorporationScraper().run({fetchPage:async url=>({html:body(grouped.get(url)[0]),status:200,url})});assert.equal(jobs.length,0)
 const old=extractCareerDetail(body(grouped.get(ARCH)[0]),{title:'Technical Architect',sourceUrl:ARCH,location:'Noida, India'})
 assert.ok(old.jobDescription.length<originalCriteria(ARCH).length/2)
})
test('registered current reader preserves two full own India roles, all22 raw cards and full application conditions',async()=>{
 const r=replay(),jobs=await r.promise;assert.equal(jobs.length,2)
 assert.deepEqual(jobs.map(j=>j.title),['Technical Architect','Performance Test Engineer'])
 assert.deepEqual(jobs.map(j=>j.employmentType),['Full Time',null])
 for(const job of jobs){assert.equal(job.company,'RxLogix Corporation');assert.equal(job.country,'India');assert.equal(job.location,'Noida, India');assert.equal(job.jobId,null);assert.equal(job.requisitionId,null);assert.equal(job.postingDate,null);assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceNativeClosingReconciled,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceRenderedApplicationQualified,false);assert.equal(job.nativeSourceRecord.originalNativeFullCriteria,originalCriteria(job.sourceUrl));assert.ok(job.jobDescription.includes(originalCriteria(job.sourceUrl)));assert.ok(job.jobDescription.includes('Only PDF or DOCX type files are allowed'));assert.ok(job.jobDescription.includes('Please select your preferred location'));assert.deepEqual(job.nativeSourceRecord.originalPublishedApplication.preferredLocations,['India','Japan','United Kingdom','United States']);assert.equal(job.nativeSourceRecord.originalPublishedApplication.preferredLocationsAreWorksites,false);assert.equal(job.nativeSourceRecord.originalPublishedApplication.authoredHref,'#')}
 assert.ok(jobs[0].jobDescription.includes('Travel Expectations 0%'));assert.ok(jobs[1].jobDescription.includes('Willingness to learn and adapt'))
 const e=jobs.nativeCollectionEvidence;assert.equal(e.nativeRows.length,22);assert.equal(new Set(e.nativeRows.map(r=>r.url)).size,21);assert.equal(e.holds.length,20);assert.equal(e.originalResponses.length,6);assert.equal(e.closingNativeRows.length,22);assert.equal(e.companyIndiaTotal,null);assert.equal(e.verifiedZero,false)
 assert.equal(r.calls.length,6);assert.ok(r.calls.every(c=>c.init.method==='GET'&&c.init.redirect==='manual'&&c.init.credentials==='omit'))
 const inventory=readInventoryEvidence(jobs);assert.equal(inventory.listingComplete,false);assert.equal(inventory.lifecycleCleanupAllowed,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null)
})
test('historical analytics variants are not requested for native authored qualification',async()=>{
 for(const variant of[0,1]){const r=replay((p,url)=>{if(url===ANALYTICS)p.body=body(grouped.get(url)[variant])});assert.equal((await r.promise).length,2)}
})
test('third historical analytics build is irrelevant to native authored role facts',async()=>{
 const actual=grouped.get(ANALYTICS)[2];assert.ok(actual,'third complete actual program packet retained')
 const r=replay((p,url)=>{if(url===ANALYTICS)p.body=body(actual)});assert.equal((await r.promise).length,2);assert.equal(r.mutations.length,0);assert.ok(r.calls.every(c=>c.url!==ANALYTICS))
})
test('native closing does not request a historical analytics release',async()=>{
 const r=replay((p,url,index)=>{if(url===ANALYTICS&&index===1)p.body=body(grouped.get(ANALYTICS)[2])});assert.equal((await r.promise).length,2);assert.equal(r.mutations.length,0);assert.ok(r.calls.every(c=>c.url!==ANALYTICS))
})
test('unread same-length analytics change cannot deny native authored roles',async()=>{
 const actual=body(grouped.get(ANALYTICS)[2]),changed=actual.replace('R(206)','R(999)');assert.notEqual(changed,actual);assert.equal(changed.length,actual.length)
 const r=replay((p,url)=>{if(url===ANALYTICS)p.body=changed});assert.equal((await r.promise).length,2);assert.equal(r.mutations.length,0);assert.ok(r.calls.every(c=>c.url!==ANALYTICS))
})
test('unread jQuery replacement cannot change independently authored role qualification',async()=>{
 const r=replay((p,url)=>{if(url==='https://rxlogix.com/wp-includes/js/jquery/jquery.min.js')p.body=body(grouped.get(ANALYTICS)[2])});assert.equal((await r.promise).length,2);assert.equal(r.mutations.length,0);assert.equal(r.calls.length,6)
})
test('only exact coupled native translator references and overwritten initial hidden seeds may vary',async()=>{
 const r=replay(p=>{if(!p.headers['content-type'].includes('html'))return;const id=/id="gt-wrapper-(\d{8})"/.exec(p.body)[1];p.body=p.body.replaceAll(id,'99112233').replace(/(<input type="hidden" id="ak_js_[12]" name="_wpcf7_ak_js" value=")[0-9]+("\/>)/g,'$1'+'999999999'+'$2')})
 assert.equal((await r.promise).length,2);assert.equal(r.mutations.length,6)
})

const roleMutations=[
 ['country contradiction',p=>{p.body=p.body.replace('Noida, India','Noida, United States')}],
 ['foreign worksite alternative',p=>{p.body=p.body.replace('Noida, India','Noida, India / London, United Kingdom')}],
 ['unknown worksite country',p=>{p.body=p.body.replace('Noida, India','Noida')}],
 ['extra original criterion',p=>{p.body=p.body.replace('Minimum Requirements','Mandatory additional licence. Minimum Requirements')}],
 ['omitted original criterion',p=>{p.body=p.body.replace('Travel Expectations','Removed Expectations')}],
 ['new unknown required input',p=>{p.body=p.body.replace(/<form\b[^>]*action="\/technical-architect\/[^"]*"[^>]*>/,'$&<input name="mandatory_licence" required value="yes">')}],
 ['unknown native data context',p=>{p.body=p.body.replace('class="job-detail"','class="job-detail" DATA-role="closed"')}],
 ['changed required input value',p=>{p.body=p.body.replace('value="Technical Architect"','value="A Different Role"')}],
 ['omitted application preference',p=>{p.body=p.body.replace('<option value="Japan">Japan</option>','')}],
 ['changed application condition',p=>{p.body=p.body.replace('Only PDF or DOCX type files are allowed','Only PDF and a mandatory licence are allowed')}],
 ['closed current role',p=>{p.body=p.body.replace('Minimum Requirements','Applications are no longer accepted. Minimum Requirements')}],
 ['hidden complete criteria',p=>{p.body=p.body.replace('class="job-detail"','class="job-detail" hidden')}],
 ['inert complete criteria',p=>{p.body=p.body.replace('class="job-detail"','class="job-detail" inert')}],
 ['title identity mismatch',p=>{p.body=p.body.replace(/(class="title"[^>]*>\s*)Technical Architect/,'$1Different Role')}],
 ['canonical publisher mismatch',p=>{p.body=p.body.replace('rel="canonical" href="https://rxlogix.com/technical-architect/"','rel="canonical" href="https://other.example/technical-architect/"')}],
 ['unreviewed native publisher',p=>{p.body=p.body.replaceAll('"name":"Rxlogix"','"name":"Other Company"')}],
 ['duplicate decoded schema key',p=>{p.body=p.body.replace('"@context":','"\\u0040context":"https://other.example/","@context":')}],
 ['native application target mismatch',p=>{p.body=p.body.replace('data-bs-target="#applyModal"','data-bs-target="#otherModal"')}],
 ['native application title mismatch',p=>{p.body=p.body.replace('Application for Technical Architect','Application for Other Role')}],
 ['native application form account mismatch',p=>{p.body=p.body.replace('#wpcf7-f1112-p810-o1','#wpcf7-f9999-p810-o1')}],
 ['native application post context mismatch',p=>{p.body=p.body.replace('name="_wpcf7_container_post" value="810"','name="_wpcf7_container_post" value="7482"')}],
 ['unreviewed active program',p=>{p.body=p.body.replace('</head>','<script>window.roleClosed=true</script></head>')}],
 ['document-local style mode',p=>{p.body=p.body.replace('<link rel=\'stylesheet\'','<link media="print" rel=\'stylesheet\'')}],
 ['unreviewed LINK resource',p=>{p.body=p.body.replace('</head>','<LINK rel="stylesheet" href="https://other.example/hide.css"></head>')}],
 ['mismatched translator reference',p=>{p.body=p.body.replace(/data-gt-widget-id="[0-9]+"/,'data-gt-widget-id="88113355"')}],
 ['extra translator token inside criterion',p=>{const id=/id="gt-wrapper-(\d{8})"/.exec(p.body)[1];p.body=p.body.replace('Minimum Requirements',id+' Minimum Requirements')}],
 ['changed immediate seed setter',p=>{p.body=p.body.replace('getTime()','getDate()')}],
 ['unreviewed hidden seed attribute',p=>{p.body=p.body.replace('id="ak_js_1"','id="ak_js_1" data-state="closed"')}],
 ['duplicate hidden seed identity',p=>{p.body=p.body.replace('id="ak_js_1"','id="ak_js_1" id="ak_js_2"')}],
]
for(const[name,mutate]of roleMutations)test(name+' cannot inherit the current whole native proof',async()=>{
 const r=replay((p,url)=>{if(url===ARCH)mutate(p)});await assert.rejects(r.promise,error=>error.softFailure===true&&error.lifecycleCleanupAllowed===false);assert.ok(r.mutations.length,'mutation actually reached a genuine role packet')
})
for(const[name,change]of[
 ['closing CSS',(p,url,index)=>{if(url===GLOBALCSS&&index===1)p.body+='\n.job-detail{display:none}'}],
 ['closing whole analytics',(p,url,index)=>{if(url===ANALYTICS&&index===1)p.body=p.body.replace('releaseExperiment','releaseExperimenx')}],
 ['wrong whole analytics MIME',(p,url)=>{if(url===ANALYTICS)p.headers['content-type']='text/plain'}],
 ['unknown complete analytics',(p,url)=>{if(url===ANALYTICS)p.body+=';window.closed=true;'}],
])test(name+' is not requested and grants no rendered visibility/activation claim',async()=>{
 const r=replay(change),jobs=await r.promise;assert.equal(jobs.length,2);assert.equal(r.calls.length,6);assert.equal(r.mutations.length,0)
 assert.ok(jobs.every(job=>job.sourceRenderedApplicationQualified===false&&job.sourceRenderedVisibilityQualified===false))
})
for(const[name,change]of[
 ['closing full criterion',(p,url,index)=>{if(url===ARCH&&index===1)p.body=p.body.replace('Minimum Requirements','Closing-only additional requirement. Minimum Requirements')}],
 ['closing application condition',(p,url,index)=>{if(url===ARCH&&index===1)p.body=p.body.replace('PDF or DOCX','PDF only')}],
 ['closing raw duplicate membership',(p,url,index)=>{if(url===BOARD&&index===1)p.body=p.body.replace('Bilingual BQA','Other Role')}],
 ['wrong native final origin',(p,url)=>{if(url===ARCH)p.url='https://other.example/technical-architect/'}],
 ['unsupported native MIME',(p,url)=>{if(url===ARCH)p.headers['content-type']='text/plain'}],
 ['public denial',(p,url)=>{if(url===BOARD)p.status=403}],
 ['empty native inventory',(p,url)=>{if(url===BOARD)p.body='<html><body>No current jobs</body></html>'}],
])test(name+' withholds the source without inventing zero or cleanup',async()=>{
 const r=replay(change);await assert.rejects(r.promise,error=>error.softFailure===true&&error.lifecycleCleanupAllowed===false);assert.ok(r.mutations.length)
})
for(const reason of['opaque-stop',Object.freeze({abort:'opaque-stop'})])test('opaque caller abort '+typeof reason+' preserves exact reason',async()=>{
 const c=new AbortController(),r=replay(undefined,{signal:c.signal,fetchImpl:()=>new Promise(()=>{})});setTimeout(()=>c.abort(reason),5);await assert.rejects(r.promise,e=>e===reason)
})
test('uncooperative fetch cannot outlive the bounded source deadline',async()=>{await assert.rejects(replay(undefined,{sourceDeadlineMs:20,fetchImpl:()=>new Promise(()=>{})}).promise,/deadline/)})
test('a late aborted fetch body is cancelled',async()=>{
 let cancelled=0;const c=new AbortController(),r=replay(undefined,{signal:c.signal,fetchImpl:value=>new Promise(resolve=>setTimeout(()=>resolve({status:200,url:String(value),headers:new Headers(grouped.get(String(value))[0].headers),body:{cancel(){cancelled++}}}),30))});setTimeout(()=>c.abort('late-stop'),5)
 await assert.rejects(r.promise,e=>e==='late-stop');await new Promise(resolve=>setTimeout(resolve,45));assert.equal(cancelled,1)
})
test('an uncooperative original reader is cancelled and released on abort',async()=>{
 let cancelled=0,released=0;const c=new AbortController(),r=replay(undefined,{signal:c.signal,fetchImpl:async value=>({status:200,url:String(value),headers:new Headers(grouped.get(String(value))[0].headers),body:{cancel(){cancelled++},getReader(){return{read:()=>new Promise(()=>{}),cancel(){cancelled++},releaseLock(){released++}}}}})});setTimeout(()=>c.abort('reader-stop'),5)
 await assert.rejects(r.promise,e=>e==='reader-stop');assert.equal(cancelled,1);assert.equal(released,1)
})
test('oversized native streams are cancelled before parsing or acceptance',async()=>{
 let cancelled=false;const r=replay(undefined,{fetchImpl:async value=>{const response=new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(4000001))},cancel(){cancelled=true}}),{status:200,headers:grouped.get(String(value))[0].headers});Object.defineProperty(response,'url',{value:String(value)});return response}})
 await assert.rejects(r.promise,/stream byte bound/);assert.equal(cancelled,true)
})
for(const[name,change]of[
 ['native Refresh navigation',(p,url)=>{if(url===ARCH)p.headers.refresh='0;url=https://unrelated.example/'}],
 ['closing restrictive CSP',(p,url,index)=>{if(url===ARCH&&index===1)p.headers['content-security-policy']="script-src 'none'; style-src 'none'; form-action 'none'"}],
 ['changed declared native charset',(p,url)=>{if(url===ARCH)p.headers['content-type']='text/html; charset=iso-8859-1'}],
 ['native download disposition',(p,url)=>{if(url===ARCH)p.headers['content-disposition']='attachment; filename="role.txt"'}],
 ['native Link stylesheet context',(p,url)=>{if(url===ARCH)p.headers.link='<https://unrelated.example/hide.css>; rel=stylesheet'}],
 ['native legacy CSP context',(p,url)=>{if(url===ARCH)p.headers['x-content-security-policy']="default-src 'none'"}],
 ['native WebKit CSP context',(p,url)=>{if(url===ARCH)p.headers['x-webkit-csp']="default-src 'none'"}],
 ['native report-only CSP context',(p,url)=>{if(url===ARCH)p.headers['content-security-policy-report-only']="default-src 'none'"}],
])test('review regression: '+name+' cannot inherit publication metadata',async()=>{
 const r=replay(change);await assert.rejects(r.promise,e=>e.softFailure===true&&e.lifecycleCleanupAllowed===false);assert.ok(r.mutations.length)
})
test('review regression: intrinsic native byte length rejects a decorated oversized first chunk',async()=>{
 const stats={reads:0,cancels:0,releases:0},chunk=new Uint8Array(4000001);Object.defineProperty(chunk,'byteLength',{value:1})
 const r=replay(undefined,{sourceDeadlineMs:60,fetchImpl:async value=>({status:200,url:String(value),headers:new Headers(grouped.get(String(value))[0].headers),body:{getReader(){return{read(){stats.reads++;return stats.reads===1?Promise.resolve({done:false,value:chunk}):new Promise(()=>{})},cancel(){stats.cancels++},releaseLock(){stats.releases++}}}}})})
 await assert.rejects(r.promise,/stream byte bound/);assert.deepEqual(stats,{reads:1,cancels:1,releases:1})
})
test('genuine bounded native byte chunks preserve positives even with a shadowed public length property',async()=>{
 const visits=new Map();let reads=0
 const r=replay(undefined,{fetchImpl:async value=>{
  const url=String(value),index=visits.get(url)||0;visits.set(url,index+1);const p=grouped.get(url)?.[index];assert.ok(p,'actual decorated current packet')
  const bytes=new Uint8Array(Buffer.from(p.bodyBase64,'base64'));Object.defineProperty(bytes,'byteLength',{value:1});let delivered=false
  reads++;return{status:p.status,url:p.url,headers:new Headers(p.headers),body:{getReader(){return{read:async()=>delivered?{done:true}:(delivered=true,{done:false,value:bytes}),cancel(){},releaseLock(){}}}}}
 }})
 assert.equal((await r.promise).length,2);assert.equal(reads,6)
})
